import { pathToFileURL } from 'node:url';
import { bounded, ensure, output, parseOptions, safeMessage, testnetAccount, uint, waitLimit, type Command, type Options } from './safety.js';
import { fixture, OfflineVault, parseEthCallback, parseReleaseArgs, publicSnapshot, type ReleaseArgs, type Role } from './model.js';
import { address, checkRelayFunding, crossCheck, derivedAddress, DERIVATION_PATH, DOMAIN_ID, lockedDestination,
  MPC_CONTRACT, prepareRelease, sepoliaClient, signedRelease, unsigned, verifySepolia } from './ethereum.js';
import { NearVault, publicConfig } from './near.js';
import { runScenario, scenarioRoles } from './scenarios.js';
import { appendProof, proof } from './proofs.js';


export const HELP = `Proof-of-Grudge CLI (English, NEAR Testnet / Ethereum Sepolia only)

Commands:
  demo            Rehearse one payoff branch; default: false-alarm
  inspect         Inspect a fixture, or explicitly read the deployed vault
  derive          Convert --public-key offline, or read MPC derived_public_key
  preview-eth     Build unsigned EIP-1559 bytes; optionally cross-check a live preview
  request-eth     Request a destination-locked signature, including explicit repeat requests
  relay-eth       Verify the stored signature and prepare its signed transaction hash
  release-eth     Request, verify, and optionally broadcast in one explicit execution
  deposit         Owner deposit_vault using --amount yoctoNEAR
  withdraw-payout Withdraw existing --role owner|heir|rival credits

Default: --dry-run, zero network, no environment/credential files, no signing.
  --scenario false-alarm|busted|inherit|spite|owner-withdraw
  --read-only --confirm-testnet       Enable views for inspect/derive/preview-eth
  --execute --confirm-testnet         Enable state-changing commands
  --broadcast --confirm-sepolia       Additional gate for relay-eth/release-eth broadcast
  --write-proofs                     Accumulate actual executed transaction links
  --timeout-seconds 600              Per chain-time wait, 1..3600
  --vault ID --near-rpc HTTPS --sepolia-rpc HTTPS
  --amount YOCTO --role owner|heir|rival
  --public-key secp256k1:BASE58       Offline derive conversion (public key only)
  --value-wei WEI                    Explicit release value; live fees/nonce estimated
  --to ADDRESS --nonce N --max-fee-per-gas WEI --max-priority-fee-per-gas WEI --gas-limit N
                                    Offline preview only; live destination comes from vault

Never deploys, initializes, resets Finalized, deletes keys, funds ETH, or uses mainnet.
No interactive prompts. Required confirmation flags are the authorization gates.
New signing requests do not revoke earlier valid signatures. Same locked destination only.
MPC failure credit requires an upfront vault operating-surplus reserve, not an async refund.
See scripts/README.md for runtime environment variables and recovery instructions.`;

function offlineArgs(options: Options): ReleaseArgs {
  return parseReleaseArgs({ nonce: options.values.get('nonce') ?? '0', value_wei: options.values.get('value-wei') ?? '1000000000000000',
    max_fee_per_gas: options.values.get('max-fee-per-gas') ?? '2000000000',
    max_priority_fee_per_gas: options.values.get('max-priority-fee-per-gas') ?? '1000000000', gas_limit: options.values.get('gas-limit') ?? '21000' });
}
async function offline(options: Options): Promise<void> {
  if (options.command === 'demo') {
    const io = new OfflineVault();
    const result = await runScenario(io, options.scenario, options.values.get('amount') ?? '1000000000000000000000000');
    output({ mode: 'Simulated: off-chain state machine', network_requests: 0, signed: false, proofs_written: false,
      transcript: io.transcript, ...result, transferred_yocto: io.transfers });
  } else if (options.command === 'inspect') {
    output({ mode: 'Offline fixture, not chain evidence', network_requests: 0, state: publicSnapshot(fixture()) });
  } else if (options.command === 'derive') {
    const key = options.values.get('public-key');
    output(key ? { mode: 'Offline public-key conversion; vault provenance not verified', address: derivedAddress(key) } : {
      mode: 'Offline derivation plan; no live MPC key invented', method: 'derived_public_key', contract: MPC_CONTRACT,
      args: { path: DERIVATION_PATH, predecessor: options.values.has('vault') ? testnetAccount(options.values.get('vault')) : 'VAULT_CONTRACT_ID (configure before a view)', domain_id: DOMAIN_ID },
      next: 'Use --read-only --confirm-testnet --vault your-vault.testnet, or --public-key with a previously verified public key.',
    });
  } else if (options.command === 'preview-eth') {
    const to = address(options.values.get('to') ?? '0x1111111111111111111111111111111111111111');
    output({ mode: 'Offline illustrative preview; not a live quote or contract verification', ...unsigned(offlineArgs(options), to), signature: null });
  } else {
    output({ mode: 'Dry-run plan only', network_requests: 0, signed: false, broadcast: false, proofs_written: false,
      command: options.command, steps: options.command === 'deposit' ? ['Owner Idle: deposit_vault with explicit --amount yoctoNEAR'] :
        options.command === 'withdraw-payout' ? ['Read role credits', 'Explicitly sign withdraw_payout', 'Check final receipts and remaining credit'] :
        ['Read Finalized vault and vault-predecessor derived_public_key', 'Read Sepolia nonce, estimated gas, fees, and balance',
          'Lock destination to stored heir address and chain 11155111', 'Cross-check unsigned bytes and hash against preview_eth_release',
          'Before requesting: vault needs extra operating surplus at least equal to the MPC deposit for a reserved failure credit',
          'For request: Heir calls request_eth_release with explicit MPC_SIGN_DEPOSIT_YOCTO and 300 Tgas',
          'Explicit repeat requests are allowed after callback; they do not revoke older valid signatures and keep the same locked destination',
          'Parse callback: success replaces stored release; failure credits the deposit from the reserve and preserves the prior release', 'Recover vault-derived sender, serialize signature, print transaction hash',
          'Only relay/release with --broadcast --confirm-sepolia sends to Sepolia'],
      next: 'Execution is opt-in: --execute --confirm-testnet. No .env file is loaded.',
    });
  }
}
function requiredValue(options: Options): string {
  const value = options.values.get('value-wei');
  ensure(value !== undefined && uint(value) > 0n, 'A positive explicit --value-wei is required.');
  return value;
}
function noLiveOverrides(options: Options): void {
  for (const field of ['to', 'nonce', 'max-fee-per-gas', 'max-priority-fee-per-gas', 'gas-limit', 'public-key']) {
    ensure(!options.values.has(field), 'Live ETH commands use the stored destination, MPC view, and RPC-estimated parameters; offline overrides are forbidden.');
  }
}

async function relay(vault: NearVault, options: Options, sepoliaRpc: string): Promise<void> {
  const state = await vault.state();
  ensure(state.state.status === 'Finalized' && !state.signing_in_flight && state.eth_release !== null,
    'Relay requires a Finalized vault with a completed stored ETH release.');
  const sender = await vault.derive(), to = lockedDestination(state);
  const client = sepoliaClient(sepoliaRpc);
  await verifySepolia(client);
  const prepared = await signedRelease(state.eth_release, to, sender);
  // The hash is shown BEFORE any broadcast. No serialized signature is logged.
  output({ mode: 'Cryptographically verified stored release', sender: prepared.sender, to: prepared.to,
    chainId: 11155111, args: prepared.args, sepoliaTxHash: prepared.hash, broadcast: false });
  if (!options.flags.has('broadcast')) {
    output({ next: 'Nothing broadcast. Use relay-eth --execute --confirm-testnet --broadcast --confirm-sepolia to send this stored release.' });
    return;
  }
  ensure(options.flags.has('execute') && options.flags.has('confirm-testnet') && options.flags.has('confirm-sepolia'), 'Sepolia broadcast gate is closed.');
  await checkRelayFunding(client, sender, prepared.args);
  // Re-read NEAR immediately before broadcast. Do not broadcast a superseded release.
  const fresh = await vault.state();
  ensure(fresh.state.status === 'Finalized' && !fresh.signing_in_flight && fresh.eth_release,
    'Stored release changed before broadcast.');
  const checked = await signedRelease(fresh.eth_release, lockedDestination(fresh), sender);
  ensure(checked.hash === prepared.hash, 'Stored release changed before broadcast.');
  await verifySepolia(client);
  const hash = await bounded(() => client.sendRawTransaction({ serializedTransaction: prepared.serializedTransaction }));
  ensure(hash.toLowerCase() === prepared.hash.toLowerCase(), 'RPC returned a different transaction hash. Inspect before retrying.');
  const entry = proof('Sepolia ETH release', hash, 'sepolia');
  output({ sepoliaTxHash: hash, url: entry.url, broadcast: true, receipt_confirmed: false });
  const receipt = await bounded(() => client.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000, pollingInterval: 2000 }), 125_000);
  ensure(receipt.status === 'success' && receipt.transactionHash.toLowerCase() === hash.toLowerCase(), 'Sepolia receipt did not report success. No automatic replacement or replay was attempted.');
  output({ sepoliaTxHash: hash, receipt_confirmed: true, confirmations: 1, blockNumber: receipt.blockNumber,
    note: 'One confirmation is not a claim of consensus finality.' });
  if (options.flags.has('write-proofs')) await appendProof(entry);
}

export async function main(argv: string[], defaultCommand: Command = 'demo'): Promise<void> {
  const options = parseOptions(argv, defaultCommand);
  if (options.flags.has('help')) { console.log(HELP); return; }
  // Critically, return before reading ANY environment value or making a provider.
  if (!options.flags.has('execute') && !options.flags.has('read-only')) { await offline(options); return; }
  if (['preview-eth', 'request-eth', 'relay-eth', 'release-eth'].includes(options.command)) noLiveOverrides(options);
  const config = publicConfig(options), vault = new NearVault(config.vault, config.nearRpc, options, waitLimit(options));
  await vault.verifyNetwork();
  if (options.command === 'inspect') {
    const snapshot = await vault.snapshot();
    output({ mode: 'Read-only NEAR Testnet RPC', block_timestamp_ns: snapshot.now, state: publicSnapshot(snapshot.state) }); return;
  }
  if (options.command === 'derive') {
    ensure(!options.values.has('public-key'), 'Use --public-key without network flags for offline conversion.');
    output({ mode: 'Read-only MPC derivation', predecessor: config.vault, path: DERIVATION_PATH, domain_id: DOMAIN_ID,
      mpc_contract: MPC_CONTRACT, address: await vault.derive() }); return;
  }
  if (options.command === 'demo') {
    await vault.preflight(scenarioRoles(options.scenario));
    const result = await runScenario(vault, options.scenario, options.values.get('amount'));
    output({ mode: 'Executed on NEAR Testnet', ...result, state: publicSnapshot(result.state),
      next: result.state.state.status === 'Finalized' ? 'ETH release is separate and opt-in. This vault cannot be reinitialized; use a fresh vault for another inheritance scenario.' : 'Payoff credit was withdrawn. Inspect final receipts on the printed explorer links.' }); return;
  }
  if (options.command === 'deposit') {
    const amount = options.values.get('amount');
    ensure(amount !== undefined && uint(amount) > 0n, 'Deposit requires a positive --amount in yoctoNEAR.');
    await vault.preflight(['owner']);
    const before = await vault.state();
    await vault.call('owner', 'deposit_vault', {}, BigInt(amount));
    const after = await vault.state();
    ensure(BigInt(after.vault_assets) === BigInt(before.vault_assets) + BigInt(amount), 'Deposit ledger differs from expected amount; inspect before retrying.');
    output({ state: publicSnapshot(after) }); return;
  }
  if (options.command === 'withdraw-payout') {
    const role = options.values.get('role');
    ensure(role === 'owner' || role === 'heir' || role === 'rival', 'Specify --role owner, heir, or rival.');
    await vault.preflight([role as Role]); await vault.call(role, 'withdraw_payout');
    const after = await vault.state();
    ensure(after.credits[role] === '0', 'Credit remains after withdrawal. Inspect before retrying.');
    output({ state: publicSnapshot(after) }); return;
  }
  if (options.command === 'relay-eth') { await relay(vault, options, config.sepoliaRpc); return; }
  const state = await vault.state();
  ensure(state.state.status === 'Finalized' && !state.signing_in_flight, 'ETH release requires Finalized and no in-flight signing request.');
  const sender = await vault.derive(), to = lockedDestination(state), client = sepoliaClient(config.sepoliaRpc);
  const args = await prepareRelease(client, sender, to, requiredValue(options));
  const preview = crossCheck(await vault.view('preview_eth_release', { ...args }), args, to);
  output({ mode: 'Live destination-locked preview cross-checked byte-for-byte', sender, to, chainId: 11155111, args,
    unsigned_tx_hex: preview.unsigned_tx_hex, payload_hex: preview.payload_hex });
  if (options.command === 'preview-eth') return;

  const deposit = process.env.MPC_SIGN_DEPOSIT_YOCTO;
  ensure(deposit !== undefined && uint(deposit) > 0n, 'Set MPC_SIGN_DEPOSIT_YOCTO explicitly in the runtime environment. No live MPC fee is assumed.');
  await vault.preflight(['heir']);
  // Check again after signer preflight to reduce nonce/balance races.
  await checkRelayFunding(client, sender, args);
  crossCheck(await vault.view('preview_eth_release', { ...args }), args, to);
  const beforeRequest = await vault.state();
  const callback = parseEthCallback(await vault.call('heir', 'request_eth_release', { ...args }, BigInt(deposit)), BigInt(deposit));
  const after = await vault.state();
  ensure(after.state.status === 'Finalized' && !after.signing_in_flight, 'Signing callback has not settled in vault state. Inspect before retrying.');
  output({ mpc_callback_success: callback.success, refund_credited_yocto: callback.refund_credited,
    note: 'Failure credit is backed by the vault operating-surplus reserve, not an assumed asynchronous MPC refund. Credit is not a confirmed payout transfer.' });
  if (!callback.success) {
    ensure(JSON.stringify(after.eth_release) === JSON.stringify(beforeRequest.eth_release),
      'Failed signing callback did not preserve the observed prior release. Inspect for concurrent requests; do not retry automatically.');
  }
  ensure(callback.success, 'MPC signing failed; the prior stored release remains. Inspect Heir credits and withdraw-payout separately. Earlier valid signatures are not revoked; no automatic retry was attempted.');
  crossCheck(callback.release, args, to);
  ensure(after.eth_release, 'Signature is not available in vault state. Inspect before retrying.');
  const signed = await signedRelease(after.eth_release, to, sender);
  crossCheck(after.eth_release, args, to);
  ensure(after.eth_release.nonce === args.nonce && after.eth_release.value_wei === args.value_wei &&
    after.eth_release.max_fee_per_gas === args.max_fee_per_gas && after.eth_release.max_priority_fee_per_gas === args.max_priority_fee_per_gas &&
    after.eth_release.gas_limit === args.gas_limit, 'Stored release arguments differ from the requested transaction.');
  output({ signature_verified: true, sender: signed.sender, sepoliaTxHash: signed.hash, broadcast: false });
  if (options.command === 'release-eth') await relay(vault, options, config.sepoliaRpc);
  else output({ next: 'Signature stored. relay-eth prepares the hash; broadcast additionally requires --broadcast --confirm-sepolia.' });
}

export async function entry(defaultCommand: Command = 'demo'): Promise<void> {
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const options = parseOptions(process.argv.slice(2), defaultCommand);
    watchdog = setTimeout(() => {
      console.error('CLI time budget expired. A submitted transaction may still complete; inspect before retrying.');
      process.exit(1);
    }, waitLimit(options) * 2 + 300_000);
    await main(process.argv.slice(2), defaultCommand);
  } catch (error) {
    console.error(safeMessage(error));
    // Stop any SDK request still pending after a timeout. Never continue signing.
    process.exit(1);
  } finally { if (watchdog) clearTimeout(watchdog); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void entry();
