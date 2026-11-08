import assert from 'node:assert/strict';
import { test } from 'node:test';
import bs58 from 'bs58';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes, parseTransaction, toHex } from 'viem';
import { publicKeyToAddress } from 'viem/accounts';
import { main } from './cli.js';
import { addTime, parseOptions, safeMessage, SafeError, scenarios, testnetAccount, uint } from './safety.js';
import { assertEthRequestAllowed, fixture, OfflineVault, parseEthCallback, parseReleaseArgs, parseVault, type EthRelease, type ReleaseArgs } from './model.js';
import { crossCheck, derivedAddress, mpcSignature, prepareRelease, signedRelease, unsigned, type SepoliaClient } from './ethereum.js';
import { runScenario } from './scenarios.js';
import { parseProofFile, proof } from './proofs.js';
import { NearVault } from './near.js';

test('Sepolia preflight explains an unfunded sender before attempting gas estimation', async () => {
  let estimates = 0;
  const client = { getChainId: async () => 11155111, getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n }),
    getBalance: async () => 0n, estimateGas: async () => { estimates++; throw new Error('RPC details must not leak'); },
  } as unknown as SepoliaClient;
  await assert.rejects(prepareRelease(client, '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222', '1'), error =>
    error instanceof SafeError && /Fund the vault-derived sender/.test(error.message));
  assert.equal(estimates, 0);
});

test('Sepolia preflight still requires the full padded gas reserve after the intrinsic check', async () => {
  const sender = '0x1111111111111111111111111111111111111111';
  const client = { getChainId: async () => 11155111, getTransactionCount: async () => 0,
    estimateFeesPerGas: async () => ({ maxFeePerGas: 2n, maxPriorityFeePerGas: 1n }),
    getBalance: async () => 42_001n, estimateGas: async () => 21_000n,
  } as unknown as SepoliaClient;
  await assert.rejects(prepareRelease(client, sender, sender, '1'), /maximum gas cost/);
  client.getBalance = (async () => 50_401n) as SepoliaClient['getBalance'];
  const args = await prepareRelease(client, sender, sender, '1');
  assert.equal(args.gas_limit, '25200');
  assert.equal(args.value_wei, '1');
});

test('v6 positional SDK provider makes one attempt and maps blockId to RPC block_id', async () => {
  const originalFetch = globalThis.fetch;
  const seen: { method: string; params: Record<string, unknown> }[] = [];
  const blockHash = bs58.encode(new Uint8Array(32).fill(9));
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    seen.push(request);
    const result = request.method === 'status' ? { chain_id: 'testnet' } : request.method === 'block' ?
      { header: { hash: blockHash, timestamp_nanosec: '42' } } :
      { result: Array.from(Buffer.from(JSON.stringify(fixture()), 'utf8')), block_hash: blockHash, block_height: 1 };
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), { status: 200 });
  };
  try {
    const options = parseOptions(['inspect', '--read-only', '--confirm-testnet']);
    const vault = new NearVault('vault.example.testnet', 'https://rpc.testnet.near.org', options, 10);
    assert.equal(vault.provider.options.retries, 1);
    await vault.verifyNetwork();
    const snapshot = await vault.snapshot();
    assert.equal(snapshot.now, 42n);
    const query = seen.find(r => r.method === 'query');
    assert.equal(query?.params.block_id, blockHash);
    assert.equal(query?.params.account_id, 'vault.example.testnet');
    assert.equal(query?.params.method_name, 'get_vault_state');
    assert(!seen.some(r => r.method === 'send_tx'));
  } finally { globalThis.fetch = originalFetch; }
});

test('MPC view uses the vault predecessor and never a human signing account', async () => {
  const originalFetch = globalThis.fetch;
  const { pub } = syntheticSignature();
  let observed: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    const request = JSON.parse(String(init?.body));
    observed = request.params;
    return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {
      result: Array.from(Buffer.from(JSON.stringify(`secp256k1:${bs58.encode(pub.slice(1))}`))),
      block_hash: bs58.encode(new Uint8Array(32).fill(9)), block_height: 1,
    } }), { status: 200 });
  };
  try {
    const options = parseOptions(['derive', '--read-only', '--confirm-testnet']);
    const vault = new NearVault('vault.example.testnet', 'https://rpc.testnet.near.org', options, 10);
    assert.equal(await vault.derive(), publicKeyToAddress(bytesToHex(pub)));
    assert.equal(observed.account_id, 'v1.signer-prod.testnet');
    assert.equal(observed.method_name, 'derived_public_key');
    const params = JSON.parse(Buffer.from(observed.args_base64 as string, 'base64').toString('utf8'));
    assert.deepEqual(params, { path: 'ethereum-1', predecessor: 'vault.example.testnet', domain_id: 0 });
  } finally { globalThis.fetch = originalFetch; }
});

test('non-testnet RPC is rejected and a failed RPC is attempted once', async () => {
  const originalFetch = globalThis.fetch;
  let count = 0;
  try {
    globalThis.fetch = async () => {
      count++;
      return new Response(JSON.stringify({ jsonrpc: '2.0', id: '1', result: { chain_id: 'mainnet' } }));
    };
    const options = parseOptions(['inspect', '--read-only', '--confirm-testnet']);
    const vault = new NearVault('vault.example.testnet', 'https://rpc.testnet.near.org', options, 10);
    await assert.rejects(vault.verifyNetwork(), /not testnet/);
    assert.equal(count, 1);
    count = 0;
    globalThis.fetch = async () => { count++; return new Response('untrusted RPC failure', { status: 503 }); };
    await assert.rejects(vault.verifyNetwork());
    assert.equal(count, 1);
  } finally { globalThis.fetch = originalFetch; }
});

// Authored only. No test in this file was executed during implementation.
for (const scenario of scenarios) {
  test(`offline payoff: ${scenario}`, async () => {
    const io = new OfflineVault(), initial = fixture(), bond = BigInt(initial.required_bond);
    const result = await runScenario(io, scenario, bond.toString());
    const expected = scenario === 'busted' ? bond * 2n : scenario === 'spite' ? BigInt(initial.vault_assets) + bond * 2n :
      scenario === 'inherit' ? BigInt(initial.vault_assets) + bond : bond;
    assert.equal(io.transfers[result.recipient], expected);
    assert.equal(result.state.credits[result.recipient], '0');
    assert.equal(result.state.locked_heir_bond, '0');
    assert.equal(result.state.locked_rival_bond, '0');
    assert.deepEqual(result.state.payouts_in_flight, { owner: '0', heir: '0', rival: '0' });
    if (scenario === 'inherit' || scenario === 'spite') {
      assert.equal(result.state.state.status, 'Finalized');
      await assert.rejects(io.call('owner', 'check_in'));
      await assert.rejects(runScenario(io, 'inherit'), /fresh, separately deployed vault/);
    }
  });
}

test('strict heartbeat, exact bonds, early finalize, and exact/late deadline', async () => {
  const io = new OfflineVault(), v = fixture(), heartbeat = BigInt(v.heartbeat_interval_ns), bond = BigInt(v.required_bond);
  await io.waitUntil(heartbeat);
  await assert.rejects(io.call('heir', 'initiate_claim', {}, bond));
  await io.waitUntil(heartbeat + 1n);
  await assert.rejects(io.call('heir', 'initiate_claim', {}, bond - 1n));
  await io.call('heir', 'initiate_claim', {}, bond);
  await assert.rejects(io.call('heir', 'finalize_inheritance'));
  await assert.rejects(io.call('rival', 'challenge_claim', {}, bond + 1n));
  const deadline = BigInt((await io.state()).state.deadline_ns!);
  await io.waitUntil(deadline);
  await assert.rejects(io.call('owner', 'check_in'));
  await assert.rejects(io.call('rival', 'challenge_claim', {}, bond));
  await io.waitUntil(deadline + 1n);
  await assert.rejects(io.call('owner', 'check_in'));
  await io.call('heir', 'finalize_inheritance');
});

test('challenge extends once, check-in before deadline pays Rival, not raw balance', async () => {
  const io = new OfflineVault(), v = fixture(), bond = BigInt(v.required_bond);
  await io.waitUntil(BigInt(v.heartbeat_interval_ns) + 1n);
  await io.call('heir', 'initiate_claim', {}, bond);
  const original = BigInt((await io.state()).state.deadline_ns!);
  await io.call('rival', 'challenge_claim', {}, bond);
  assert.equal(BigInt((await io.state()).state.deadline_ns!), original + BigInt(v.challenge_extension_ns));
  await assert.rejects(io.call('rival', 'challenge_claim', {}, bond));
  await io.waitUntil(original + BigInt(v.challenge_extension_ns) - 1n);
  await io.call('owner', 'check_in');
  const after = await io.state();
  assert.equal(after.credits.rival, (bond * 2n).toString());
  assert.equal(after.vault_assets, v.vault_assets);
  assert.equal(after.state.status, 'Idle');
  assert.equal(after.last_outcome, 'Busted');
});

test('owner deposit ledger and pull-payment withdrawal', async () => {
  const io = new OfflineVault(), v = fixture();
  await io.call('owner', 'deposit_vault', {}, 50n);
  await assert.rejects(io.call('heir', 'owner_withdraw_near', { amount: '50' }));
  await io.call('owner', 'owner_withdraw_near', { amount: '50' });
  assert.equal((await io.state()).vault_assets, v.vault_assets);
  assert.equal(io.transfers.owner, 0n);
  assert.equal((await io.state()).credits.owner, '50');
  await io.call('owner', 'withdraw_payout');
  assert.equal(io.transfers.owner, 50n);
  await assert.rejects(io.call('owner', 'withdraw_payout'));
});

test('flag combinations fail closed before configuration or signing', () => {
  for (const args of [
    ['demo', '--execute'], ['demo', '--execute', '--dry-run', '--confirm-testnet'],
    ['inspect', '--execute', '--confirm-testnet'], ['demo', '--read-only', '--confirm-testnet'],
    ['inspect', '--dry-run', '--read-only', '--confirm-testnet'],
    ['relay-eth', '--execute', '--confirm-testnet', '--broadcast'],
    ['request-eth', '--execute', '--confirm-testnet', '--broadcast', '--confirm-sepolia'],
    ['demo', '--write-proofs'], ['demo', '--unknown'], ['demo', '--execute', '--execute'],
  ]) assert.throws(() => parseOptions(args), SafeError);
  assert.equal(parseOptions([]).flags.size, 0);
  assert.equal(parseOptions(['demo', '--dry-run']).scenario, 'false-alarm');
  assert.equal(parseOptions(['relay-eth', '--execute', '--confirm-testnet', '--broadcast', '--confirm-sepolia']).command, 'relay-eth');
});

test('all default command paths use no fetch, signing, or credential lookup', async () => {
  const originalFetch = globalThis.fetch, originalLog = console.log;
  globalThis.fetch = async () => { assert.fail('Offline command attempted network access'); };
  const printed: string[] = [];
  console.log = (...args: unknown[]) => { printed.push(args.join(' ')); };
  // Dry-run returns before publicConfig/preflight; poison values would fail live validation.
  const oldVault = process.env.VAULT_CONTRACT_ID;
  process.env.VAULT_CONTRACT_ID = 'not-a-valid-vault';
  try {
    for (const command of ['demo', 'inspect', 'derive', 'preview-eth', 'request-eth', 'relay-eth', 'release-eth', 'deposit', 'withdraw-payout']) await main([command]);
    for (const scenario of scenarios) await main(['demo', '--scenario', scenario, '--dry-run']);
    assert(printed.every(line => !line.includes('not-a-valid-vault')));
  } finally {
    globalThis.fetch = originalFetch; console.log = originalLog;
    if (oldVault === undefined) delete process.env.VAULT_CONTRACT_ID; else process.env.VAULT_CONTRACT_ID = oldVault;
  }
});

test('untrusted failure details never reach safe error messages', () => {
  const marker = 'sensitive-rpc-response-marker';
  assert(!safeMessage(new Error(marker)).includes(marker));
  assert(!safeMessage({ message: marker }).includes(marker));
  const external = new Error(marker, { cause: { response: marker, privateKey: marker } });
  external.stack = `Error: ${marker}\n    at ${marker}`;
  assert(!safeMessage(external).includes(marker));
  const controlled = new SafeError('Controlled public message.', { cause: external });
  controlled.stack = marker;
  assert.equal(safeMessage(controlled), 'Controlled public message.');
});

test('numeric precision, overflow, actor distinctness and mainnet refusal', () => {
  assert.throws(() => uint('01'));
  assert.throws(() => uint('-1'));
  assert.throws(() => uint((1n << 128n).toString()));
  assert.throws(() => addTime((1n << 64n) - 1n, 1n));
  assert.throws(() => testnetAccount('owner.near'));
  assert.throws(() => testnetAccount('a'.repeat(64)));
  assert.throws(() => parseVault({ ...fixture(), heir: fixture().owner }));
  assert.deepEqual(parseVault(fixture()), fixture());
});

test('vault snapshots require canonical payout-in-flight amounts for every role', () => {
  const zero = { owner: '0', heir: '0', rival: '0' };
  assert.deepEqual(fixture().payouts_in_flight, zero);
  assert.throws(() => parseVault({ ...fixture(), payouts_in_flight: undefined }), SafeError);
  assert.throws(() => parseVault({ ...fixture(), payouts_in_flight: null }), SafeError);
  for (const role of ['owner', 'heir', 'rival'] as const) {
    const payouts = { ...zero, [role]: '9007199254740993' };
    assert.deepEqual(parseVault({ ...fixture(), payouts_in_flight: payouts }).payouts_in_flight, payouts);
    for (const invalid of [undefined, 0, '-1', '01', (1n << 128n).toString()]) {
      assert.throws(() => parseVault({ ...fixture(), payouts_in_flight: { ...zero, [role]: invalid } }), SafeError);
    }
  }
});

const args: ReleaseArgs = { nonce: '0', value_wei: '1', max_fee_per_gas: '2', max_priority_fee_per_gas: '1', gas_limit: '21000' };
const to = '0x1111111111111111111111111111111111111111' as const;

test('contract gas and positive EIP-1559 fee boundaries fail closed', () => {
  for (const gas_limit of ['21000', '1000000']) {
    assert.equal(parseReleaseArgs({ ...args, gas_limit }).gas_limit, gas_limit);
  }
  for (const invalid of [
    { gas_limit: '20999' }, { gas_limit: '1000001' },
    { max_fee_per_gas: '0' }, { max_priority_fee_per_gas: '0' },
    { max_priority_fee_per_gas: '3' },
  ]) assert.throws(() => parseReleaseArgs({ ...args, ...invalid }), SafeError);
});

test('an existing release permits an explicit new settled Heir request, never an in-flight one', () => {
  const built = unsigned(args, to);
  const prior: EthRelease = { ...args, unsigned_tx_hex: built.unsigned_tx_hex, payload_hex: built.payload_hex, signature: null };
  const vault = { ...fixture(), state: { status: 'Finalized' as const }, eth_release: prior };
  assert.doesNotThrow(() => assertEthRequestAllowed(vault, 'heir', args, 1n));
  assert.doesNotThrow(() => assertEthRequestAllowed(vault, 'heir', { ...args, nonce: '1' }, 1n));
  assert.doesNotThrow(() => assertEthRequestAllowed({ ...vault, eth_release: null }, 'heir', args, 1n));
  assert.equal(vault.eth_release, prior); // Preflight itself never replaces a release.
  for (const role of ['owner', 'rival'] as const) {
    assert.throws(() => assertEthRequestAllowed(vault, role, args, 1n), SafeError);
  }
  assert.throws(() => assertEthRequestAllowed({ ...vault, signing_in_flight: true }, 'heir', args, 1n), SafeError);
  assert.throws(() => assertEthRequestAllowed(fixture(), 'heir', args, 1n), SafeError);
  assert.throws(() => assertEthRequestAllowed(vault, 'heir', args, 0n), SafeError);
  assert.throws(() => assertEthRequestAllowed(vault, 'heir', args, -1n), SafeError);
  assert.throws(() => assertEthRequestAllowed(vault, 'heir', { ...args, gas_limit: '1000001' }, 1n), SafeError);
});

test('MPC signing is blocked by any role payout until all payouts settle', () => {
  const vault = { ...fixture(), state: { status: 'Finalized' as const } };
  assert.doesNotThrow(() => assertEthRequestAllowed(vault, 'heir', args, 1n));
  for (const role of ['owner', 'heir', 'rival'] as const) {
    for (const amount of ['1', '9007199254740993']) {
      const pending = parseVault({ ...vault, payouts_in_flight: { ...vault.payouts_in_flight, [role]: amount } });
      // Zero credits do not make refunded funds spendable before the payout callback settles.
      assert.deepEqual(pending.credits, { owner: '0', heir: '0', rival: '0' });
      assert.throws(() => assertEthRequestAllowed(pending, 'heir', args, 1n),
        { name: 'Error', message: 'Settle all payouts before MPC signing' });
      const settled = parseVault({ ...pending, payouts_in_flight: { owner: '0', heir: '0', rival: '0' } });
      assert.doesNotThrow(() => assertEthRequestAllowed(settled, 'heir', args, 1n));
    }
  }
});

test('callback parser requires a new release on success or exactly the deposit credit on failure', () => {
  const built = unsigned(args, to);
  const release: EthRelease = { ...args, unsigned_tx_hex: built.unsigned_tx_hex, payload_hex: built.payload_hex, signature: null };
  // Signature verification is a separate cryptographic step, not a parser guarantee.
  assert.deepEqual(parseEthCallback({ success: true, release, refund_credited: '0' }, 7n),
    { success: true, release, refund_credited: '0' });
  assert.deepEqual(parseEthCallback({ success: false, release: null, refund_credited: '7' }, 7n),
    { success: false, release: null, refund_credited: '7' });
  for (const invalid of [
    { success: true, release, refund_credited: '7' },
    { success: true, release: null, refund_credited: '0' },
    { success: false, release, refund_credited: '7' },
    { success: false, release: null, refund_credited: '0' },
    { success: false, release: null, refund_credited: '6' },
    { success: false, release: null, refund_credited: '07' },
    { success: 'false', release: null, refund_credited: '7' },
  ]) assert.throws(() => parseEthCallback(invalid, 7n), SafeError);
});

test('fixed EIP-1559 RLP reference bytes and locked fields', () => {
  const built = unsigned(args, to);
  // Hand-audited nine-field unsigned RLP; viem is the reference serializer.
  const golden = `0x02e283aa36a780010282520894${'11'.repeat(20)}0180c0`;
  assert.equal(built.unsigned_tx_hex, golden);
  const parsed = parseTransaction(built.unsigned_tx_hex);
  assert.equal(parsed.chainId, 11155111);
  assert.equal(parsed.to?.toLowerCase(), to);
  assert.equal(parsed.data ?? '0x', '0x');
  assert.deepEqual(parsed.accessList ?? [], []);
  assert.deepEqual(crossCheck(built, args, to), built);
  assert.throws(() => crossCheck({ ...built, payload_hex: `0x${'00'.repeat(32)}` }, args, to));
  assert.throws(() => crossCheck(built, { ...args, value_wei: '2' }, to));
  assert.throws(() => unsigned({ ...args, nonce: '9007199254740992' }, to));
});

// Deterministic test-only scalar generated in memory. No credentials or real signing accounts.
function syntheticSignature() {
  const scalar = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
  const pub = secp256k1.getPublicKey(scalar, false);
  const built = unsigned(args, to);
  const signature = secp256k1.sign(hexToBytes(built.payload_hex), scalar);
  const inner = { big_r: { affine_point: `${signature.recovery === 0 ? '02' : '03'}${toHex(signature.r, { size: 32 }).slice(2)}` },
    s: { scalar: toHex(signature.s, { size: 32 }).slice(2) }, recovery_id: signature.recovery };
  return { scalar, pub, built, inner };
}

test('64-byte NEAR MPC key converts via 04 prefix and viem', () => {
  const { pub } = syntheticSignature();
  const nearKey = `secp256k1:${bs58.encode(pub.slice(1))}`;
  assert.equal(derivedAddress(nearKey), publicKeyToAddress(bytesToHex(pub)));
  assert.throws(() => derivedAddress(`ed25519:${bs58.encode(pub.slice(1))}`));
  assert.throws(() => derivedAddress(`secp256k1:${bs58.encode(pub)}`));
});

test('verified MPC JSON shapes, recovery, high-s normalization, signed hash', async () => {
  const { pub, built, inner } = syntheticSignature(), sender = publicKeyToAddress(bytesToHex(pub));
  const release: EthRelease = { ...args, unsigned_tx_hex: built.unsigned_tx_hex, payload_hex: built.payload_hex, signature: inner };
  const signed = await signedRelease(release, to, sender);
  assert.equal(signed.sender, sender);
  assert.equal(parseTransaction(signed.serializedTransaction).chainId, 11155111);
  const tagged = await signedRelease({ ...release, signature: { scheme: 'Secp256k1', ...inner } }, to, sender);
  assert.equal(tagged.hash, signed.hash);
  const highS = { ...inner, s: { scalar: toHex(secp256k1.CURVE.n - BigInt(`0x${inner.s.scalar}`), { size: 32 }).slice(2) }, recovery_id: inner.recovery_id === 0 ? 1 : 0 };
  assert.equal((await signedRelease({ ...release, signature: highS }, to, sender)).hash, signed.hash);
  await assert.rejects(signedRelease(release, to, '0x2222222222222222222222222222222222222222'));
  assert.throws(() => mpcSignature({ Secp256k1: inner }));
  assert.throws(() => mpcSignature({ scheme: 'Ed25519', ...inner }));
  assert.throws(() => mpcSignature({ ...inner, recovery_id: 2 }));
  assert.throws(() => mpcSignature({ ...inner, s: { scalar: '00'.repeat(32) } }));
});

test('proof schema accumulates real-hash links without claiming verification', () => {
  const entry = proof('Heir: finalize_inheritance', '0x' + 'ab'.repeat(32), 'sepolia');
  const file = parseProofFile({ network: 'testnet', verified: false, proofs: [entry] });
  assert.equal(file.proofs.length, 1);
  assert.equal(file.verified, false);
  assert.throws(() => parseProofFile({ ...file, verified: true }));
  assert.throws(() => parseProofFile({ ...file, proofs: [{ ...entry, url: 'https://etherscan.io/tx/example' }] }));
  assert.throws(() => parseProofFile([]));
});
