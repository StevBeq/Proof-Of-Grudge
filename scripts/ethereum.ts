import bs58 from 'bs58';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, createPublicClient, getAddress, hexToBytes, http, keccak256, recoverAddress,
  serializeTransaction, toHex, type Address, type Hex } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { bounded, endpoint, ensure, record, uint } from './safety.js';
import { parseReleaseArgs, type EthRelease, type ReleaseArgs, type Vault } from './model.js';

export const MPC_CONTRACT = 'v1.signer-prod.testnet';
export const DERIVATION_PATH = 'ethereum-1';
export const DOMAIN_ID = 0;
export const CHAIN_ID = 11155111;
export function hex(value: unknown, bytes?: number): Hex {
  ensure(typeof value === 'string', 'Expected hexadecimal bytes.');
  const raw = value.startsWith('0x') ? value.slice(2) : value;
  ensure(/^(?:[0-9a-fA-F]{2})+$/.test(raw) && (bytes === undefined || raw.length === bytes * 2), 'Invalid hexadecimal byte length.');
  return `0x${raw.toLowerCase()}`;
}
export function address(value: unknown): Address {
  ensure(typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value), 'Expected a 20-byte Ethereum address.');
  return getAddress(value);
}
export function lockedDestination(vault: Vault): Address { return address(bytesToHex(Uint8Array.from(vault.heir_eth_address))); }

export function derivedAddress(publicKey: unknown): Address {
  ensure(typeof publicKey === 'string' && /^secp256k1:[1-9A-HJ-NP-Za-km-z]{1,90}$/.test(publicKey), 'Expected the MPC secp256k1:base58 public key.');
  const raw = bs58.decode(publicKey.slice('secp256k1:'.length));
  ensure(raw.length === 64, 'MPC public key must contain exactly 64 bytes.');
  const uncompressed = hex(`04${Buffer.from(raw).toString('hex')}`, 65);
  secp256k1.ProjectivePoint.fromHex(uncompressed.slice(2)).assertValidity();
  return publicKeyToAddress(uncompressed);
}

export function transaction(args: ReleaseArgs, to: Address) {
  const a = parseReleaseArgs(args), nonce = uint(a.nonce, 64);
  // viem represents nonce as a JS number; fail closed instead of rounding a u64.
  ensure(nonce <= BigInt(Number.MAX_SAFE_INTEGER), 'Nonce exceeds viem safe integer range.');
  return { type: 'eip1559' as const, chainId: CHAIN_ID, nonce: Number(nonce),
    to: address(to), value: BigInt(a.value_wei), gas: BigInt(a.gas_limit), maxFeePerGas: BigInt(a.max_fee_per_gas),
    maxPriorityFeePerGas: BigInt(a.max_priority_fee_per_gas), data: '0x' as const, accessList: [] };
}
export function unsigned(args: ReleaseArgs, to: Address) {
  const tx = transaction(args, to), unsigned_tx_hex = serializeTransaction(tx);
  return { tx, unsigned_tx_hex, payload_hex: keccak256(unsigned_tx_hex) };
}
export function crossCheck(preview: unknown, args: ReleaseArgs, to: Address): ReturnType<typeof unsigned> {
  const p = record(preview), local = unsigned(args, to);
  ensure(hex(p.unsigned_tx_hex) === local.unsigned_tx_hex && hex(p.payload_hex, 32) === local.payload_hex,
    'Contract preview differs byte-for-byte from the destination-locked Sepolia transaction. Signing stopped.');
  return local;
}

// Upstream primitives.rs uses #[serde(tag = "scheme")]. K256Signature is the
// untagged inner struct. No guessed externally-tagged wrappers are accepted.
export function mpcSignature(value: unknown) {
  const sig = record(value);
  const keys = Object.keys(sig).sort().join(',');
  ensure(keys === 'big_r,recovery_id,s' || (keys === 'big_r,recovery_id,s,scheme' && sig.scheme === 'Secp256k1'),
    'Unsupported MPC signature shape. Expected verified Secp256k1 scheme or inner K256Signature.');
  const point = hex(record(sig.big_r).affine_point, 33);
  ensure(point.startsWith('0x02') || point.startsWith('0x03'), 'Invalid compressed MPC R point.');
  secp256k1.ProjectivePoint.fromHex(point.slice(2)).assertValidity();
  const x = BigInt(`0x${point.slice(4)}`), order = secp256k1.CURVE.n;
  let s = BigInt(hex(record(sig.s).scalar, 32));
  ensure(x > 0n && x < order && s > 0n && s < order, 'Invalid MPC signature scalar.');
  // Ethereum only encodes parity, not recovery IDs 2/3 (x-reduced bit).
  ensure(sig.recovery_id === 0 || sig.recovery_id === 1, 'Unsupported EVM recovery ID. Request a new signature; do not truncate it.');
  let parity: 0 | 1 = sig.recovery_id;
  if (s > order / 2n) { s = order - s; parity = parity === 0 ? 1 : 0; }
  return { r: toHex(x, { size: 32 }), s: toHex(s, { size: 32 }), yParity: parity };
}
export async function signedRelease(release: EthRelease, to: Address, expectedSender: Address) {
  const local = crossCheck(release, release, to), signature = mpcSignature(release.signature);
  const recovered = await recoverAddress({ hash: local.payload_hex, signature });
  ensure(recovered.toLowerCase() === expectedSender.toLowerCase(), 'MPC signature did not recover the vault-derived Ethereum address.');
  const serializedTransaction = serializeTransaction(local.tx, signature);
  return { serializedTransaction, hash: keccak256(serializedTransaction), sender: recovered, to, args: parseReleaseArgs(release) };
}
export function sepoliaClient(url: string) {
  return createPublicClient({ chain: sepolia, transport: http(endpoint(url), { timeout: 20_000, retryCount: 0 }) });
}
export type SepoliaClient = ReturnType<typeof sepoliaClient>;
export async function verifySepolia(client: SepoliaClient): Promise<void> {
  ensure(await bounded(() => client.getChainId()) === CHAIN_ID, 'Ethereum RPC is not Sepolia (11155111).');
}
export async function prepareRelease(client: SepoliaClient, sender: Address, to: Address, value: string): Promise<ReleaseArgs> {
  await verifySepolia(client);
  const valueWei = uint(value);
  ensure(valueWei > 0n, 'Release value must be positive.');
  const [nonce, fees, balance] = await Promise.all([
    bounded(() => client.getTransactionCount({ address: sender, blockTag: 'pending' })),
    bounded(() => client.estimateFeesPerGas({ type: 'eip1559' })),
    bounded(() => client.getBalance({ address: sender, blockTag: 'pending' })),
  ]);
  // An unfunded sender may make eth_estimateGas fail before it can explain the
  // missing funds. Check the intrinsic minimum first, then the padded estimate.
  ensure(balance >= valueWei + 21_000n * fees.maxFeePerGas, 'Derived Sepolia address cannot cover release value plus the maximum gas cost. Fund the vault-derived sender with Sepolia test ETH.');
  const gas = await bounded(() => client.estimateGas({ account: sender, to, value: valueWei, data: '0x' }));
  const gasLimit = (gas * 120n + 99n) / 100n;
  ensure(balance >= valueWei + gasLimit * fees.maxFeePerGas, 'Derived Sepolia address cannot cover release value plus the maximum gas cost.');
  return parseReleaseArgs({ nonce: nonce.toString(), value_wei: value,
    max_fee_per_gas: fees.maxFeePerGas.toString(), max_priority_fee_per_gas: fees.maxPriorityFeePerGas.toString(), gas_limit: gasLimit.toString() });
}
export async function checkRelayFunding(client: SepoliaClient, sender: Address, args: ReleaseArgs): Promise<void> {
  await verifySepolia(client);
  const [nonce, balance, block] = await Promise.all([
    bounded(() => client.getTransactionCount({ address: sender, blockTag: 'pending' })),
    bounded(() => client.getBalance({ address: sender, blockTag: 'pending' })),
    bounded(() => client.getBlock({ blockTag: 'latest' })),
  ]);
  ensure(BigInt(nonce) === BigInt(args.nonce), 'Stored release nonce is stale or already pending/mined. Inspect before requesting another signature.');
  ensure(balance >= BigInt(args.value_wei) + BigInt(args.gas_limit) * BigInt(args.max_fee_per_gas), 'Insufficient Sepolia balance for the stored release and maximum gas cost.');
  ensure(block.baseFeePerGas !== null && block.baseFeePerGas <= BigInt(args.max_fee_per_gas), 'Stored fee cap is below the current Sepolia base fee.');
}
