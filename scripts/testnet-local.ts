import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Account, KeyPair, KeyPairSigner, providers, transactions } from 'near-api-js';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { main as runCli } from './cli.js';
import { parseVault } from './model.js';
import { appendProof, proof } from './proofs.js';
import { bounded, ensure, output, parseOptions, record, safeMessage, testnetAccount } from './safety.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function localPaths(profile?: string) {
  ensure(profile === undefined || /^[a-z0-9][a-z0-9-]{0,31}$/.test(profile), 'Profile must be 1..32 lowercase letters, numbers or hyphens, without path separators.');
  const local = profile ? resolve(ROOT, '.rtk/testnet-profiles', profile) : resolve(ROOT, '.rtk/testnet');
  const secretDir = resolve(local, 'credentials');
  return { local, secretDir, envFile: resolve(secretDir, 'runtime.env'), publicFile: resolve(local, 'public.json') };
}
type LocalPaths = ReturnType<typeof localPaths>;
export const ROLES = ['owner', 'heir', 'rival', 'vault'] as const;
type Role = typeof ROLES[number];
export interface LocalConfig {
  network: 'testnet';
  nearRpc: string;
  sepoliaRpc: string;
  accounts: Record<Role, { accountId: string; publicKey: string }>;
  heirEthAddress: string;
}

export function validateLocal(value: unknown): LocalConfig {
  const config = record(value);
  ensure(config.network === 'testnet' && config.nearRpc === 'https://rpc.testnet.near.org' &&
    config.sepoliaRpc === 'https://ethereum-sepolia-rpc.publicnode.com', 'Local setup must use the fixed public testnet endpoints.');
  const accounts = record(config.accounts);
  const ids = ROLES.map(role => {
    const entry = record(accounts[role]);
    ensure(typeof entry.publicKey === 'string' && /^ed25519:[1-9A-HJ-NP-Za-km-z]+$/.test(entry.publicKey), 'Invalid local public key.');
    return testnetAccount(entry.accountId);
  });
  ensure(new Set(ids).size === 4, 'Local actors and vault must all be distinct.');
  ensure(typeof config.heirEthAddress === 'string' && /^0x[0-9a-fA-F]{40}$/.test(config.heirEthAddress) &&
    !/^0x0{40}$/.test(config.heirEthAddress), 'Invalid local heir ETH recipient.');
  return value as LocalConfig;
}

async function protectDirectory(paths: LocalPaths): Promise<void> {
  await mkdir(paths.secretDir, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') {
    // Windows ignores POSIX mode bits. Restrict this new, dedicated directory's ACL.
    const identity = execFileSync(resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const sid = identity.match(/S-1-[0-9-]+/)?.[0];
    ensure(sid, 'Could not determine Windows identity for private credential storage.');
    execFileSync(resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/icacls.exe'), [paths.secretDir, '/grant:r', `*${sid}:(OI)(CI)F`], { stdio: 'pipe' });
    execFileSync(resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/icacls.exe'), [paths.secretDir, '/inheritance:r'], { stdio: 'pipe' });
  }
}

export async function prepare(paths: LocalPaths = localPaths()): Promise<void> {
  // Exclusive writes preserve any pre-existing local setup, including partial setup.
  await protectDirectory(paths);
  const tag = `pog-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const accounts = {} as LocalConfig['accounts'];
  const env: Record<string, string> = {};
  for (const role of ROLES) {
    const pair = KeyPair.fromRandom('ed25519');
    const accountId = testnetAccount(`${tag}-${role}.testnet`);
    accounts[role] = { accountId, publicKey: pair.getPublicKey().toString() };
    env[`${role.toUpperCase()}_ACCOUNT_ID`] = accountId;
    env[`${role.toUpperCase()}_PRIVATE_KEY`] = pair.toString();
  }
  const recipientKey = generatePrivateKey();
  const config: LocalConfig = { network: 'testnet', nearRpc: 'https://rpc.testnet.near.org',
    sepoliaRpc: 'https://ethereum-sepolia-rpc.publicnode.com', accounts,
    heirEthAddress: privateKeyToAccount(recipientKey).address };
  env.VAULT_CONTRACT_ID = accounts.vault.accountId;
  env.NEAR_RPC_URL = config.nearRpc;
  env.SEPOLIA_RPC_URL = config.sepoliaRpc;
  env.HEIR_ETH_PRIVATE_KEY = recipientKey;
  env.HEIR_ETH_ADDRESS = config.heirEthAddress;
  // Pinned upstream deposits.rs specifies 1 yocto; live execution still verifies success.
  env.MPC_SIGN_DEPOSIT_YOCTO = '1';
  await writeFile(paths.envFile, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  await writeFile(paths.publicFile, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  output({ prepared: true, on_chain_accounts_created: false, config, credentials_stored_locally: true,
    note: 'Dedicated faucet-only test keys. No private key was printed. Back up the credential file securely; never commit it.' });
}

async function publicConfig(paths: LocalPaths): Promise<LocalConfig> {
  return validateLocal(JSON.parse(await readFile(paths.publicFile, 'utf8')));
}
async function secrets(config: LocalConfig, paths: LocalPaths): Promise<Record<string, string>> {
  const env = parseEnv(await readFile(paths.envFile, 'utf8'));
  for (const role of ROLES) {
    const prefix = role.toUpperCase();
    ensure(env[`${prefix}_ACCOUNT_ID`] === config.accounts[role].accountId, 'Local signer account does not match public configuration.');
    const signer = KeyPairSigner.fromSecretKey(env[`${prefix}_PRIVATE_KEY`] as `ed25519:${string}`);
    ensure((await signer.getPublicKey()).toString() === config.accounts[role].publicKey, 'Local signer public key mismatch.');
  }
  ensure(env.HEIR_ETH_ADDRESS === config.heirEthAddress &&
    privateKeyToAccount(env.HEIR_ETH_PRIVATE_KEY as `0x${string}`).address === config.heirEthAddress, 'Heir recipient key mismatch.');
  ensure(Object.values(env).every(value => typeof value === 'string'), 'Invalid local environment file.');
  return env as Record<string, string>;
}
async function providerFor(config: LocalConfig) {
  const provider = new providers.JsonRpcProvider({ url: config.nearRpc }, { retries: 1 });
  ensure((await bounded(() => provider.viewNodeStatus())).chain_id === 'testnet', 'NEAR RPC is not testnet.');
  return provider;
}
async function accountExists(provider: InstanceType<typeof providers.JsonRpcProvider>, id: string): Promise<boolean> {
  try { await bounded(() => provider.viewAccount(id, { finality: 'final' })); return true; }
  catch (error) {
    // Only an explicit chain response means absent; a timeout/outage is not absence.
    if (error && typeof error === 'object' && 'type' in error && error.type === 'AccountDoesNotExist') return false;
    throw error;
  }
}


export function initArgs(config: LocalConfig) {
  return { owner: config.accounts.owner.accountId, heir: config.accounts.heir.accountId, rival: config.accounts.rival.accountId,
    heir_eth_address: Array.from(Buffer.from(config.heirEthAddress.slice(2), 'hex')),
    heartbeat_interval_ns: '15000000000', grace_period_ns: '90000000000', challenge_extension_ns: '90000000000',
    required_bond: '1000000000000000000000000' };
}

async function inspect(config: LocalConfig): Promise<void> {
  const provider = await providerFor(config);
  for (const role of ROLES) {
    const { accountId } = config.accounts[role];
    if (!await accountExists(provider, accountId)) { output({ role, accountId, exists: false }); continue; }
    const account = await bounded(() => provider.viewAccount(accountId, { finality: 'final' }));
    output({ role, accountId, exists: true, amount: account.amount, code_hash: account.code_hash });
  }
}

async function faucet(config: LocalConfig): Promise<void> {
  const provider = await providerFor(config);
  for (const role of ROLES) {
    const { accountId, publicKey } = config.accounts[role];
    if (await accountExists(provider, accountId)) {
      const keys = await bounded(() => provider.viewAccessKeyList(accountId, { finality: 'final' }));
      ensure(keys.keys.some(key => key.public_key === publicKey && key.access_key.permission === 'FullAccess'),
        'Existing account does not contain the generated FullAccess key; refusing to treat it as provisioned.');
      output({ role, accountId, skipped: 'Account and generated key already exist; no duplicate faucet request.' }); continue;
    }
    // Official near-cli-rs v0.31.1 sponsor-by-faucet-service request and endpoint.
    const response = await fetch('https://helper.nearprotocol.com/account', { method: 'POST',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ newAccountId: accountId, newAccountPublicKey: publicKey }),
      signal: AbortSignal.timeout(60_000) });
    output({ role, accountId, faucet_http_status: response.status });
    ensure(response.ok, 'Faucet did not accept account creation. No automatic retry; inspect chain state before retrying. Browser funding may be necessary.');
    // Treat HTTP success as untrusted; establish actual account/key on the chain.
    ensure(await accountExists(provider, accountId), 'Faucet response was not verified on-chain. Inspect before retrying.');
    const keys = await bounded(() => provider.viewAccessKeyList(accountId, { finality: 'final' }));
    ensure(keys.keys.some(key => key.public_key === publicKey && key.access_key.permission === 'FullAccess'),
      'Faucet-created account is missing the generated FullAccess key.');
    output({ role, accountId, created_on_testnet: true });
  }
}

async function deploy(config: LocalConfig, paths: LocalPaths): Promise<void> {
  const provider = await providerFor(config);
  const env = await secrets(config, paths);
  const signers = {} as Record<Role, Account>;
  for (const role of ROLES) {
    const { accountId } = config.accounts[role];
    const signer = KeyPairSigner.fromSecretKey(env[`${role.toUpperCase()}_PRIVATE_KEY`] as `ed25519:${string}`);
    const publicKey = await signer.getPublicKey();
    const key = await bounded(() => provider.viewAccessKey(accountId, publicKey, { finality: 'final' }));
    ensure(key.permission === 'FullAccess', 'Local demo account requires its generated FullAccess key.');
    signers[role] = new Account(accountId, provider, signer);
  }
  const vaultId = config.accounts.vault.accountId;
  const account = await bounded(() => provider.viewAccount(vaultId, { finality: 'final' }));
  ensure(account.code_hash === '11111111111111111111111111111111', 'Refusing to overwrite an existing vault deployment.');
  ensure(BigInt(account.amount) >= 4_000_000_000_000_000_000_000_000n, 'Vault needs at least 4 test NEAR for code/storage, buffer and surplus.');
  const wasm = await readFile(resolve(ROOT, 'contract/target/near/proof_of_grudge.wasm'));
  const result = await bounded(() => signers.vault.signAndSendTransaction({ receiverId: vaultId,
    actions: [transactions.deployContract(wasm), transactions.functionCall('init', initArgs(config), 100_000_000_000_000n, 0n)],
    waitUntil: 'FINAL', throwOnFailure: false }), 120_000);
  const tx = record(result), transaction = record(tx.transaction);
  output({ vaultId, nearTxHash: transaction.hash, url: `https://testnet.nearblocks.io/txns/${transaction.hash}`, full_access_key_retained: true });
  ensure(typeof record(tx.status).SuccessValue === 'string', 'Deployment did not report final success. Inspect printed transaction before retrying.');
  const state = parseVault(await bounded(() => provider.callFunction(vaultId, 'get_vault_state', {}, { finality: 'final' })));
  ensure(state.owner === config.accounts.owner.accountId && state.heir === config.accounts.heir.accountId &&
    state.rival === config.accounts.rival.accountId && state.state.status === 'Idle' && state.vault_assets === '0' &&
    JSON.stringify(state.heir_eth_address) === JSON.stringify(initArgs(config).heir_eth_address), 'Deployed initialization differs from local configuration.');
  const entry = proof('Deploy and init: vault', String(transaction.hash), 'near');
  await writeFile(resolve(paths.local, 'deployment.json'), JSON.stringify({ ...entry, vaultId, full_access_key_retained: true }, null, 2) + '\n', { flag: 'wx' });
  await appendProof(entry);
  output({ deployed_and_initialized: true, state });
}


export async function localMain(args: string[]): Promise<void> {
  const argv = [...args];
  const profile = argv[0] === '--profile' ? (argv.shift(), argv.shift()) : undefined;
  ensure(args[0] !== '--profile' || profile !== undefined, 'Profile name is required.');
  const paths = localPaths(profile);
  const [command, ...rest] = argv;
  if (command === 'prepare') {
    ensure(rest.length === 0, 'prepare accepts no flags and never contacts a network.');
    await prepare(paths); return;
  }
  ensure(command === 'inspect' || command === 'faucet' || command === 'deploy' || command === 'run',
    'Use [--profile NAME] prepare | inspect --read-only --confirm-testnet | faucet/deploy --execute --confirm-testnet | run <CLI command and flags>.');
  if (command === 'run') {
    const options = parseOptions(rest);
    if (!options.flags.has('execute') && !options.flags.has('read-only')) { await runCli(rest); return; }
    const config = await publicConfig(paths);
    process.env.VAULT_CONTRACT_ID = config.accounts.vault.accountId;
    process.env.NEAR_RPC_URL = config.nearRpc;
    process.env.SEPOLIA_RPC_URL = config.sepoliaRpc;
    if (options.flags.has('execute')) {
      const env = await secrets(config, paths);
      for (const role of ['owner', 'heir', 'rival'] as const) {
        const prefix = role.toUpperCase();
        process.env[`${prefix}_ACCOUNT_ID`] = env[`${prefix}_ACCOUNT_ID`];
        process.env[`${prefix}_PRIVATE_KEY`] = env[`${prefix}_PRIVATE_KEY`];
      }
      process.env.MPC_SIGN_DEPOSIT_YOCTO = env.MPC_SIGN_DEPOSIT_YOCTO;
    }
    await runCli(rest); return;
  }
  const expected = command === 'inspect' ? ['--read-only', '--confirm-testnet'] : ['--execute', '--confirm-testnet'];
  ensure(rest.length === 2 && expected.every(flag => rest.includes(flag)), 'Explicit testnet flags required; no unknown options are accepted.');
  const config = await publicConfig(paths);
  if (command === 'inspect') await inspect(config);
  else if (command === 'faucet') await faucet(config);
  else await deploy(config, paths);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const watchdog = setTimeout(() => { console.error('Local setup time limit expired. Inspect chain state before retrying.'); process.exit(1); }, 600_000);
  localMain(process.argv.slice(2)).catch(error => { console.error(safeMessage(error)); process.exitCode = 1; }).finally(() => clearTimeout(watchdog));
}
