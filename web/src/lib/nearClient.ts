import type { Funds, Outcome, Status } from './vaultSimulator';
import { demoConfig, zeroFunds } from './vaultSimulator';
import type { Vault } from './vaultSimulator';

export type LiveSnapshot = {
  owner: string; heir: string; rival: string; heir_eth_address: number[];
  state: { status: Status; claimed_at_ns?: string; deadline_ns?: string };
  heartbeat_interval_ns: string; grace_period_ns: string; challenge_extension_ns: string;
  required_bond: string; locked_heir_bond: string; locked_rival_bond: string; vault_assets: string;
  last_check_in_ns: string; last_outcome: Outcome;
  credits: Record<keyof Funds, string>; payouts_in_flight: Record<keyof Funds, string>;
  signing_in_flight: boolean; observed_at_ns: string;
  eth_release: null | {
    nonce: string; value_wei: string; max_fee_per_gas: string; max_priority_fee_per_gas: string;
    gas_limit: string; unsigned_tx_hex: string; payload_hex: string; signature: unknown;
  };
};
export const publicConfig = {
  nearRpc: import.meta.env.VITE_NEAR_RPC_URL || 'https://test.rpc.fastnear.com',
  fallbackNearRpc: 'https://rpc.testnet.near.org',
  contractId: (import.meta.env.VITE_VAULT_CONTRACT_ID || 'pog-mw835qrr-1c82b2-vault.testnet').trim(),
  sepoliaRpc: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
  mpcContractId: 'v1.signer-prod.testnet',
};

export interface PresetVault {
  id: string;
  labelEn: string;
  labelId: string;
  derivedSepoliaSender?: string;
}

export const PRESET_VAULTS: PresetVault[] = [
  {
    id: 'pog-mw835qrr-1c82b2-vault.testnet',
    labelEn: 'Vault #1 · Spite Backfired + Sepolia ETH Release',
    labelId: 'Vault #1 · Kedengkian Berbalik + Rilis ETH Sepolia',
    derivedSepoliaSender: '0xeDbe670f69552C1D87394A33eB3A21e090bb3116',
  },
  {
    id: 'pog-mw83onmu-af46c1-vault.testnet',
    labelEn: 'Vault #2 · Uncontested + Owner Withdrawal',
    labelId: 'Vault #2 · Tanpa Tantangan + Penarikan Pemilik',
  },
];

export function isValidTestnetAccount(accountId: string): boolean {
  return /^(?:[a-z0-9]+(?:[-_.][a-z0-9]+)*\.testnet|[a-f0-9]{64})$/.test(accountId.trim());
}
export function publicEndpoint(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Public HTTPS endpoint required');
  return url.href;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid contract response');
  return value as Record<string, unknown>;
}
function decimal(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new Error('Invalid decimal field');
}
export function parseSnapshot(value: unknown): LiveSnapshot {
  const v = record(value); const state = record(v.state);
  for (const key of ['owner', 'heir', 'rival']) if (typeof v[key] !== 'string') throw new Error('Invalid account');
  if (!['Idle', 'Pending', 'Challenged', 'Finalized'].includes(String(state.status))) throw new Error('Invalid status');
  for (const key of ['heartbeat_interval_ns', 'grace_period_ns', 'challenge_extension_ns', 'required_bond', 'locked_heir_bond', 'locked_rival_bond', 'vault_assets', 'last_check_in_ns', 'observed_at_ns']) decimal(v[key]);
  for (const key of ['claimed_at_ns', 'deadline_ns']) if (state[key] !== undefined) decimal(state[key]);
  if (state.status === 'Pending' || state.status === 'Challenged') { decimal(state.claimed_at_ns); decimal(state.deadline_ns); }
  for (const field of ['credits', 'payouts_in_flight']) {
    const funds = record(v[field]); for (const actor of ['owner', 'heir', 'rival']) decimal(funds[actor]);
  }
  if (!['None', 'FalseAlarm', 'Busted', 'Uncontested', 'SpiteBackfired'].includes(String(v.last_outcome))) throw new Error('Invalid outcome');
  if (typeof v.signing_in_flight !== 'boolean') throw new Error('Invalid signing flag');
  if (!Array.isArray(v.heir_eth_address) || v.heir_eth_address.length !== 20 || !v.heir_eth_address.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) throw new Error('Invalid ETH destination');
  if (v.eth_release !== null) {
    const release = record(v.eth_release);
    for (const key of ['nonce', 'value_wei', 'max_fee_per_gas', 'max_priority_fee_per_gas', 'gas_limit']) decimal(release[key]);
    for (const key of ['unsigned_tx_hex', 'payload_hex']) if (typeof release[key] !== 'string' || !/^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(release[key] as string)) throw new Error('Invalid release payload');
    if (!('signature' in release)) throw new Error('Missing signature field');
  }
  return v as unknown as LiveSnapshot;
}
export function decodeCallResult(raw: unknown): unknown {
  const payload = record(raw);
  if (!Array.isArray(payload.result) || !payload.result.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) {
    throw new Error('Invalid RPC query result bytes');
  }
  const text = new TextDecoder().decode(new Uint8Array(payload.result));
  return JSON.parse(text);
}
async function withTestnetProvider<T>(fn: (provider: { query: (params: Record<string, unknown>) => Promise<unknown>; getNetworkId: () => Promise<string> }) => Promise<T>): Promise<T> {
  const { providers } = await import('near-api-js');
  const endpoints = Array.from(new Set([publicEndpoint(publicConfig.nearRpc), publicEndpoint(publicConfig.fallbackNearRpc)]));
  let lastErr: unknown;
  for (const url of endpoints) {
    try {
      const provider = new providers.JsonRpcProvider({ url }, { retries: 1, wait: 400, backoff: 1 });
      if (await provider.getNetworkId() !== 'testnet') throw new Error('NEAR Testnet required');
      return await fn(provider as unknown as { query: (params: Record<string, unknown>) => Promise<unknown>; getNetworkId: () => Promise<string> });
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('NEAR Testnet RPC unavailable');
}

/** Uses only provider view APIs without Node Buffer globals. No Account, signer or key store is created. */
export async function getVaultState(customContractId?: string): Promise<LiveSnapshot> {
  const targetId = (customContractId ?? publicConfig.contractId).trim();
  if (!targetId || !isValidTestnetAccount(targetId)) throw new Error('Configure a testnet account');
  return withTestnetProvider(async provider => {
    const raw = await provider.query({
      finality: 'final',
      request_type: 'call_function',
      account_id: targetId,
      method_name: 'get_vault_state',
      args_base64: 'e30=',
    });
    return parseSnapshot(decodeCallResult(raw));
  });
}

export async function getAccountBalanceYocto(accountId: string): Promise<bigint> {
  const targetId = accountId.trim();
  if (!targetId || !isValidTestnetAccount(targetId)) throw new Error('Invalid testnet account');
  return withTestnetProvider(async provider => {
    const raw = await provider.query({
      finality: 'final',
      request_type: 'view_account',
      account_id: targetId,
    });
    const obj = record(raw);
    decimal(obj.amount);
    return BigInt(obj.amount);
  });
}

export interface ReleasePreviewResult {
  nonce: string;
  value_wei: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
  gas_limit: string;
  unsigned_tx_hex: string;
  payload_hex: string;
}

export async function previewEthReleaseOnChain(
  params: {
    nonce: string;
    value_wei: string;
    max_fee_per_gas: string;
    max_priority_fee_per_gas: string;
    gas_limit: string;
  },
  customContractId?: string,
): Promise<ReleasePreviewResult> {
  const targetId = (customContractId ?? publicConfig.contractId).trim();
  if (!targetId || !isValidTestnetAccount(targetId)) throw new Error('Configure a testnet account');
  for (const k of ['nonce', 'value_wei', 'max_fee_per_gas', 'max_priority_fee_per_gas', 'gas_limit'] as const) {
    decimal(params[k]);
  }
  const argsJson = JSON.stringify(params);
  const argsBytes = new TextEncoder().encode(argsJson);
  let binary = '';
  for (let i = 0; i < argsBytes.length; i++) binary += String.fromCharCode(argsBytes[i]);
  const argsBase64 = btoa(binary);

  return withTestnetProvider(async provider => {
    const raw = await provider.query({
      finality: 'final',
      request_type: 'call_function',
      account_id: targetId,
      method_name: 'preview_eth_release',
      args_base64: argsBase64,
    });
    const decoded = record(decodeCallResult(raw));
    for (const k of ['nonce', 'value_wei', 'max_fee_per_gas', 'max_priority_fee_per_gas', 'gas_limit']) {
      decimal(decoded[k]);
    }
    for (const k of ['unsigned_tx_hex', 'payload_hex']) {
      if (typeof decoded[k] !== 'string' || !/^(?:0x)?(?:[0-9a-fA-F]{2})+$/.test(decoded[k] as string)) {
        throw new Error('Invalid preview payload');
      }
    }
    return decoded as unknown as ReleasePreviewResult;
  });
}
export function toVault(v: LiveSnapshot): Vault {
  const convert = (funds: Record<keyof Funds, string>): Funds => ({ owner: BigInt(funds.owner), heir: BigInt(funds.heir), rival: BigInt(funds.rival) });
  return {
    config: { ...demoConfig, owner: v.owner, heir: v.heir, rival: v.rival, heartbeat: BigInt(v.heartbeat_interval_ns), grace: BigInt(v.grace_period_ns), extension: BigInt(v.challenge_extension_ns), bond: BigInt(v.required_bond), assets: BigInt(v.vault_assets) },
    status: v.state.status, outcome: v.last_outcome, lastCheckIn: BigInt(v.last_check_in_ns),
    claimedAt: v.state.claimed_at_ns === undefined ? undefined : BigInt(v.state.claimed_at_ns),
    deadline: v.state.deadline_ns === undefined ? undefined : BigInt(v.state.deadline_ns),
    lockedHeir: BigInt(v.locked_heir_bond), lockedRival: BigInt(v.locked_rival_bond), assets: BigInt(v.vault_assets),
    credits: convert(v.credits), inFlight: convert(v.payouts_in_flight), withdrawn: zeroFunds(),
  };
}
export const ethAddress = (bytes: number[]) => `0x${bytes.map(n => n.toString(16).padStart(2, '0')).join('')}`;
type ProofLink = { network: 'near-testnet' | 'sepolia'; url: string };
export type Proof = ProofLink & { label: string; createdAt: string; nearTxHash?: string; sepoliaTxHash?: string };
export type ProofManifest = { network: 'testnet'; verified: boolean; proofs: Proof[]; invalid: boolean };
export function safeProof(value: unknown): ProofLink | null {
  try {
    const item = record(value); if (typeof item.url !== 'string') return null;
    const u = new URL(item.url);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || u.port) return null;
    if (u.hostname === 'testnet.nearblocks.io' && /^\/txns\/[1-9A-HJ-NP-Za-km-z]{32,44}\/?$/.test(u.pathname)) return { network: 'near-testnet', url: u.href };
    if (u.hostname === 'sepolia.etherscan.io' && /^\/tx\/0x[0-9a-fA-F]{64}\/?$/.test(u.pathname)) return { network: 'sepolia', url: u.href };
    return null;
  } catch { return null; }
}
export function parseProofManifest(value: unknown): ProofManifest {
  const data = record(value);
  if (data.network !== 'testnet' || typeof data.verified !== 'boolean' || !Array.isArray(data.proofs)) throw new Error('Invalid evidence manifest');
  const valid: Proof[] = [];
  for (const entry of data.proofs) {
    const link = safeProof(entry);
    if (!link) continue;
    const item = record(entry);
    if (typeof item.label !== 'string' || !item.label.trim() || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) continue;
    if (item.nearTxHash !== undefined && (typeof item.nearTxHash !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(item.nearTxHash))) continue;
    if (item.sepoliaTxHash !== undefined && (typeof item.sepoliaTxHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(item.sepoliaTxHash))) continue;
    const hash = new URL(link.url).pathname.split('/').filter(Boolean).at(-1);
    if (link.network === 'near-testnet' && item.nearTxHash !== undefined && item.nearTxHash !== hash) continue;
    if (link.network === 'sepolia' && item.sepoliaTxHash !== undefined && (item.sepoliaTxHash as string).toLowerCase() !== hash?.toLowerCase()) continue;
    valid.push({ ...link, label: item.label, createdAt: item.createdAt,
      nearTxHash: item.nearTxHash as string | undefined, sepoliaTxHash: item.sepoliaTxHash as string | undefined });
  }
  return { network: 'testnet', verified: data.verified, proofs: valid, invalid: valid.length !== data.proofs.length };
}
export async function getProofs(signal: AbortSignal): Promise<ProofManifest> {
  const response = await fetch(`${import.meta.env.BASE_URL}proofs.json`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error('Evidence unavailable');
  return parseProofManifest(await response.json());
}
