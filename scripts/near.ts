import { Account, KeyPairSigner, providers, transactions } from 'near-api-js';

import { addTime, bounded, endpoint, ensure, output, record, SafeError, testnetAccount, uint, type Options } from './safety.js';
import { assertEthRequestAllowed, parseVault, type Method, type Role, type Vault, type VaultIO } from './model.js';
import { DERIVATION_PATH, DOMAIN_ID, derivedAddress, MPC_CONTRACT } from './ethereum.js';
import { appendProof, proof } from './proofs.js';

const { JsonRpcProvider } = providers;
type KeyPairString = Parameters<typeof KeyPairSigner.fromSecretKey>[0];

export function publicConfig(options: Options) {
  return {
    vault: testnetAccount(options.values.get('vault') ?? process.env.VAULT_CONTRACT_ID),
    nearRpc: endpoint(options.values.get('near-rpc') ?? process.env.NEAR_RPC_URL ?? 'https://rpc.testnet.near.org'),
    sepoliaRpc: endpoint(options.values.get('sepolia-rpc') ?? process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com'),
  };
}
export class NearVault implements VaultIO {
  readonly provider: InstanceType<typeof JsonRpcProvider>;
  private accounts = new Map<Role, Account>();
  constructor(readonly vault: string, rpc: string, readonly options: Options, readonly waitMilliseconds: number) {
    ensure(options.flags.has('confirm-testnet') && (options.flags.has('execute') || options.flags.has('read-only')), 'Network gate is not open.');
    // In v6.5.1 provider retries means TOTAL HTTP attempts.
    this.provider = new JsonRpcProvider({ url: endpoint(rpc) }, { retries: 1 });
  }
  async verifyNetwork(): Promise<void> {
    const status = await bounded(() => this.provider.viewNodeStatus());
    ensure(status.chain_id === 'testnet', 'NEAR RPC is not testnet.');
  }
  async view(method: 'get_vault_state' | 'preview_eth_release' | 'derived_public_key', args: Record<string, unknown> = {}, blockHash?: string): Promise<unknown> {
    return bounded(() => this.provider.callFunction(
      method === 'derived_public_key' ? MPC_CONTRACT : this.vault, method, args,
      blockHash ? { blockId: blockHash } : { finality: 'final' },
    ));
  }
  async state(): Promise<Vault> { return parseVault(await this.view('get_vault_state')); }
  async snapshot(): Promise<{ state: Vault; now: bigint }> {
    const block = await bounded(() => this.provider.viewBlock({ finality: 'final' }));
    // timestamp_nanosec is a decimal string; timestamp (number) is not precise.
    const now = uint(block.header.timestamp_nanosec, 64);
    return { state: parseVault(await this.view('get_vault_state', {}, block.header.hash)), now };
  }
  async now(): Promise<bigint> {
    const block = await bounded(() => this.provider.viewBlock({ finality: 'final' }));
    return uint(block.header.timestamp_nanosec, 64);
  }
  async derive() {
    return derivedAddress(await this.view('derived_public_key', { path: DERIVATION_PATH, predecessor: this.vault, domain_id: DOMAIN_ID }));
  }
  async preflight(roles: Role[]): Promise<void> {
    ensure(this.options.flags.has('execute') && this.options.flags.has('confirm-testnet'), 'Signing requires explicit testnet execution flags.');
    const state = await this.state();
    // Credentials are read only here, never at import time, in dry-run, or in views.
    for (const role of roles) {
      const prefix = role.toUpperCase();
      const id = testnetAccount(process.env[`${prefix}_ACCOUNT_ID`]);
      ensure(id === state[role] && id !== this.vault, 'Configured signer does not match its distinct vault role.');
      const secret = process.env[`${prefix}_PRIVATE_KEY`];
      ensure(typeof secret === 'string' && /^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(secret), 'Missing or invalid role signing key in the runtime environment.');
      let signer: KeyPairSigner;
      try { signer = KeyPairSigner.fromSecretKey(secret as KeyPairString); }
      catch { throw new SafeError('Role signing key could not be decoded.'); }
      const publicKey = await signer.getPublicKey();
      const key = await bounded(() => this.provider.viewAccessKey(id, publicKey, { finality: 'final' }));
      ensure(key.permission === 'FullAccess', 'Payable CLI workflows require a funded testnet FullAccess signer key.');
      this.accounts.set(role, new Account(id, this.provider, signer));
    }
  }
  async call(role: Role, method: Method, args: Record<string, unknown> = {}, deposit = 0n): Promise<unknown> {
    ensure(this.options.flags.has('execute') && this.options.flags.has('confirm-testnet'), 'Signing gate is closed.');
    const account = this.accounts.get(role);
    ensure(account, 'Signer was not preflighted.');
    await this.verifyNetwork();
    const { state, now } = await this.snapshot();
    ensure(account.accountId === state[role], 'Vault actor changed since preflight.');
    const active = state.state.status === 'Pending' || state.state.status === 'Challenged';
    if (method === 'check_in' || method === 'challenge_claim') {
      ensure(state.state.status !== 'Finalized' && (!active || now < BigInt(state.state.deadline_ns!)), 'Claim deadline expired; the requested action is no longer safe.');
    }
    uint(deposit.toString());
    if (method === 'initiate_claim') ensure(role === 'heir' && state.state.status === 'Idle' && now > addTime(BigInt(state.last_check_in_ns), BigInt(state.heartbeat_interval_ns)), 'Heir claim requires an expired heartbeat and Idle vault.');
    if (method === 'initiate_claim' || method === 'challenge_claim') ensure(deposit === BigInt(state.required_bond), 'An exact bond deposit is required.');
    if (method === 'challenge_claim') ensure(role === 'rival' && state.state.status === 'Pending', 'Only Rival may challenge Pending.');
    if (method === 'check_in') ensure(role === 'owner', 'Only Owner may check in.');
    if (method === 'finalize_inheritance') ensure(active && now >= BigInt(state.state.deadline_ns!), 'Claim is not ready to finalize.');
    if (method === 'deposit_vault' || method === 'owner_withdraw_near') ensure(role === 'owner' && state.state.status === 'Idle', 'Owner ledger actions require Idle.');
    if (method === 'request_eth_release') {
      assertEthRequestAllowed(state, role, args, deposit);
      output({ warning: 'This destination-locked request does not revoke any earlier valid signature. A successful callback replaces only the stored release; earlier signatures can still execute if their Sepolia nonce remains valid.',
        replaces_stored_release_on_success: state.eth_release !== null,
        funding: 'The vault must already have extra operating surplus of at least the MPC deposit for the failure-credit reserve. An asynchronous MPC refund is not assumed.' });
    }
    if (method === 'deposit_vault') ensure(deposit > 0n, 'Deposit must be positive.');
    if (method === 'owner_withdraw_near') ensure(uint(args.amount) > 0n && uint(args.amount) <= BigInt(state.vault_assets), 'Withdrawal exceeds accounted vault assets.');
    if (!['deposit_vault', 'initiate_claim', 'challenge_claim', 'request_eth_release'].includes(method)) ensure(deposit === 0n, 'Unexpected attached deposit.');
    if (method === 'withdraw_payout') ensure(BigInt(state.credits[role]) > 0n, 'No payout credit for this role.');
    output({ action: method, role, attached_deposit_yocto: deposit.toString(), network: 'testnet' });
    // The verified v6 non-legacy method sends once and has no retries option.
    // Do not use signAndSendTransactionLegacy, which retries and logs failures.
    const result = await bounded(() => account.signAndSendTransaction({ receiverId: this.vault,
      actions: [transactions.functionCall(method, args, method === 'request_eth_release' ? 300_000_000_000_000n : 100_000_000_000_000n, deposit)],
      waitUntil: 'FINAL', throwOnFailure: false,
    }), 120_000);
    const r = record(result), transaction = record(r.transaction);
    ensure(typeof transaction.hash === 'string', 'NEAR result is missing a transaction hash. Inspect before retrying.');
    const entry = proof(`${role}: ${method}`, transaction.hash, 'near');
    output({ nearTxHash: entry.nearTxHash, url: entry.url });
    const status = record(r.status);
    ensure(typeof status.SuccessValue === 'string' && !('Failure' in status), 'NEAR transaction did not report final success. Inspect the printed transaction before retrying.');
    // A downstream transfer can fail even if the contract method returns success.
    const receipts = Array.isArray(r.receipts_outcome) ? r.receipts_outcome : [];
    const failedReceipt = receipts.some(item => {
      const outcome = record(record(item).outcome), s = outcome.status;
      return s === 'Failure' || (s !== null && typeof s === 'object' && 'Failure' in s);
    });
    let returned: unknown = null;
    if (status.SuccessValue) {
      try { returned = JSON.parse(Buffer.from(status.SuccessValue, 'base64').toString('utf8')); }
      catch { throw new SafeError('Contract success response was not JSON. Inspect before retrying.'); }
    }
    if (this.options.flags.has('write-proofs')) await appendProof(entry);
    if (method !== 'request_eth_release') ensure(!failedReceipt, 'A downstream receipt failed. Inspect credits and the printed transaction; no automatic retry was attempted.');
    return returned;
  }
  async waitUntil(target: bigint): Promise<void> {
    uint(target.toString(), 64);
    const start = performance.now();
    for (;;) {
      const now = await this.now();
      if (now >= target) return;
      ensure(performance.now() - start < this.waitMilliseconds, 'Bounded chain-time wait expired. No next action was sent. Inspect current state before resuming.');
      output({ waiting_for_block_timestamp_ns: target.toString(), observed_block_timestamp_ns: now.toString() });
      await new Promise(resolve => setTimeout(resolve, Math.min(2000, this.waitMilliseconds - (performance.now() - start))));
    }
  }
}
