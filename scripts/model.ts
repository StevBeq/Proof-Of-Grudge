import { addTime, ensure, record, testnetAccount, uint, type Scenario } from './safety.js';

export type Role = 'owner' | 'heir' | 'rival';
export type Status = 'Idle' | 'Pending' | 'Challenged' | 'Finalized';
export type Outcome = 'None' | 'FalseAlarm' | 'Busted' | 'Uncontested' | 'SpiteBackfired';
export interface ReleaseArgs {
  nonce: string;
  value_wei: string;
  max_fee_per_gas: string;
  max_priority_fee_per_gas: string;
  gas_limit: string;
}
export interface EthRelease extends ReleaseArgs {
  unsigned_tx_hex: string;
  payload_hex: string;
  signature: unknown;
}
export interface Vault {
  owner: string;
  heir: string;
  rival: string;
  heir_eth_address: number[];
  state: { status: Status; claimed_at_ns?: string; deadline_ns?: string };
  heartbeat_interval_ns: string;
  grace_period_ns: string;
  challenge_extension_ns: string;
  last_check_in_ns: string;
  required_bond: string;
  vault_assets: string;
  locked_heir_bond: string;
  locked_rival_bond: string;
  credits: Record<Role, string>;
  payouts_in_flight: Record<Role, string>;
  last_outcome: Outcome;
  eth_release: EthRelease | null;
  signing_in_flight: boolean;
  observed_at_ns: string;
}
export type Method = 'deposit_vault' | 'owner_withdraw_near' | 'withdraw_payout' | 'initiate_claim' |
  'challenge_claim' | 'check_in' | 'finalize_inheritance' | 'request_eth_release';
export interface VaultIO {
  state(): Promise<Vault>;
  now(): Promise<bigint>;
  call(role: Role, method: Method, args?: Record<string, unknown>, deposit?: bigint): Promise<unknown>;
  waitUntil(target: bigint): Promise<void>;
}
export function parseReleaseArgs(value: unknown): ReleaseArgs {
  const r = record(value);
  uint(r.nonce, 64); uint(r.gas_limit, 64);
  uint(r.value_wei); uint(r.max_fee_per_gas); uint(r.max_priority_fee_per_gas);
  ensure(BigInt(r.gas_limit as string) >= 21_000n && BigInt(r.gas_limit as string) <= 1_000_000n &&
    BigInt(r.max_fee_per_gas as string) > 0n && BigInt(r.max_priority_fee_per_gas as string) > 0n &&
    BigInt(r.max_priority_fee_per_gas as string) <= BigInt(r.max_fee_per_gas as string),
    'EIP-1559 gas must be 21000..1000000; both fee caps must be positive and priority must not exceed max fee.');
  return { nonce: r.nonce as string, value_wei: r.value_wei as string,
    max_fee_per_gas: r.max_fee_per_gas as string, max_priority_fee_per_gas: r.max_priority_fee_per_gas as string,
    gas_limit: r.gas_limit as string };
}
export function parseEthRelease(value: unknown): EthRelease {
  const e = record(value), args = parseReleaseArgs(e);
  ensure(typeof e.unsigned_tx_hex === 'string' && /^(?:0x)?02(?:[0-9a-fA-F]{2})+$/.test(e.unsigned_tx_hex) && e.unsigned_tx_hex.length <= 4096,
    'Invalid stored unsigned transaction.');
  ensure(typeof e.payload_hex === 'string' && /^(?:0x)?[0-9a-fA-F]{64}$/.test(e.payload_hex), 'Invalid stored payload hash.');
  return { ...args, unsigned_tx_hex: e.unsigned_tx_hex, payload_hex: e.payload_hex, signature: e.signature };
}
export function assertEthRequestAllowed(vault: Vault, role: Role, args: unknown, deposit: bigint): void {
  uint(deposit.toString());
  ensure(role === 'heir' && vault.state.status === 'Finalized' && !vault.signing_in_flight && deposit > 0n,
    'ETH signing requires Heir, Finalized, an explicit positive deposit, and no in-flight request.');
  // A failed payout's refund can arrive before its callback restores credit;
  // that temporary balance must not be treated as MPC operating surplus.
  ensure((['owner', 'heir', 'rival'] as const).every(role => uint(vault.payouts_in_flight[role]) === 0n),
    'Settle all payouts before MPC signing');
  // An existing release is intentionally allowed. Only a successful callback
  // replaces it; neither replacement nor failure revokes older valid signatures.
  parseReleaseArgs(args);
}
export type EthCallback = { success: true; release: EthRelease; refund_credited: '0' } |
  { success: false; release: null; refund_credited: string };
export function parseEthCallback(value: unknown, deposit: bigint): EthCallback {
  const r = record(value);
  ensure(typeof r.success === 'boolean', 'Invalid release callback status. Inspect vault state before retrying.');
  uint(r.refund_credited);
  if (r.success) {
    ensure(r.refund_credited === '0', 'Successful signing callback unexpectedly reported a refund credit.');
    return { success: true, release: parseEthRelease(r.release), refund_credited: '0' };
  }
  ensure(r.release === null && r.refund_credited === deposit.toString(), 'Failed signing callback must report no new release and credit exactly the attached deposit.');
  return { success: false, release: null, refund_credited: r.refund_credited as string };
}
export function parseVault(value: unknown): Vault {
  const r = record(value), state = record(r.state), credits = record(r.credits), payouts = record(r.payouts_in_flight);
  const owner = testnetAccount(r.owner), heir = testnetAccount(r.heir), rival = testnetAccount(r.rival);
  ensure(new Set([owner, heir, rival]).size === 3, 'Vault actors must be distinct.');
  ensure(['Idle', 'Pending', 'Challenged', 'Finalized'].includes(state.status as string), 'Unknown vault status.');
  ensure(['None', 'FalseAlarm', 'Busted', 'Uncontested', 'SpiteBackfired'].includes(r.last_outcome as string), 'Unknown vault outcome.');
  ensure(Array.isArray(r.heir_eth_address) && r.heir_eth_address.length === 20 &&
    r.heir_eth_address.every(n => Number.isInteger(n) && n >= 0 && n <= 255), 'Expected a locked 20-byte heir address.');
  for (const key of ['heartbeat_interval_ns', 'grace_period_ns', 'challenge_extension_ns', 'last_check_in_ns', 'observed_at_ns']) uint(r[key], 64);
  for (const key of ['required_bond', 'vault_assets', 'locked_heir_bond', 'locked_rival_bond']) uint(r[key]);
  for (const role of ['owner', 'heir', 'rival'] as const) {
    uint(credits[role]); uint(payouts[role]);
  }
  ensure(typeof r.signing_in_flight === 'boolean', 'Missing signing status.');
  const parsedState: Vault['state'] = { status: state.status as Status };
  if (state.status === 'Pending' || state.status === 'Challenged') {
    uint(state.claimed_at_ns, 64); uint(state.deadline_ns, 64);
    parsedState.claimed_at_ns = state.claimed_at_ns as string;
    parsedState.deadline_ns = state.deadline_ns as string;
  }
  const release = r.eth_release === null ? null : parseEthRelease(r.eth_release);
  return {
    owner, heir, rival, heir_eth_address: [...r.heir_eth_address] as number[], state: parsedState,
    heartbeat_interval_ns: r.heartbeat_interval_ns as string, grace_period_ns: r.grace_period_ns as string,
    challenge_extension_ns: r.challenge_extension_ns as string, last_check_in_ns: r.last_check_in_ns as string,
    observed_at_ns: r.observed_at_ns as string, required_bond: r.required_bond as string,
    vault_assets: r.vault_assets as string, locked_heir_bond: r.locked_heir_bond as string,
    locked_rival_bond: r.locked_rival_bond as string, credits: { owner: credits.owner as string, heir: credits.heir as string, rival: credits.rival as string },
    payouts_in_flight: { owner: payouts.owner as string, heir: payouts.heir as string, rival: payouts.rival as string },
    last_outcome: r.last_outcome as Outcome, eth_release: release, signing_in_flight: r.signing_in_flight,
  };
}
export function publicSnapshot(vault: Vault): unknown {
  return { ...vault, eth_release: vault.eth_release ? {
    ...vault.eth_release, signature: vault.eth_release.signature != null ? 'present (not yet verified)' : null,
  } : null };
}
export function fixture(): Vault {
  return {
    owner: 'owner.example.testnet', heir: 'heir.example.testnet', rival: 'rival.example.testnet',
    heir_eth_address: Array.from({ length: 20 }, () => 17), state: { status: 'Idle' },
    heartbeat_interval_ns: '120000000000', grace_period_ns: '60000000000', challenge_extension_ns: '60000000000',
    last_check_in_ns: '0', observed_at_ns: '0', required_bond: '1000000000000000000000000',
    vault_assets: '5000000000000000000000000', locked_heir_bond: '0', locked_rival_bond: '0',
    credits: { owner: '0', heir: '0', rival: '0' }, payouts_in_flight: { owner: '0', heir: '0', rival: '0' },
    last_outcome: 'None', eth_release: null, signing_in_flight: false,
  };
}

// This simulator is a CLI rehearsal, not evidence of deployed-contract behavior.
// Payouts succeed immediately; it does not simulate asynchronous payout receipts
// or callbacks, and the default fixture keeps all payouts_in_flight amounts zero.
export class OfflineVault implements VaultIO {
  private vault: Vault;
  private clock = 0n;
  readonly transfers: Record<Role, bigint> = { owner: 0n, heir: 0n, rival: 0n };
  readonly transcript: unknown[] = [];
  constructor(initial = fixture()) { this.vault = structuredClone(initial); this.clock = BigInt(initial.observed_at_ns); }
  async state(): Promise<Vault> { return structuredClone({ ...this.vault, observed_at_ns: this.clock.toString() }); }
  async now(): Promise<bigint> { return this.clock; }
  async waitUntil(target: bigint): Promise<void> { if (target > this.clock) this.clock = target; }
  async call(role: Role, method: Method, args: Record<string, unknown> = {}, deposit = 0n): Promise<void> {
    const v = this.vault, status = v.state.status, bond = BigInt(v.required_bond);
    const active = status === 'Pending' || status === 'Challenged';
    const credit = (who: Role, amount: bigint) => { v.credits[who] = (BigInt(v.credits[who]) + amount).toString(); };
    ensure(method === 'deposit_vault' || method === 'initiate_claim' || method === 'challenge_claim' || deposit === 0n, 'Unexpected attached deposit.');
    if (method === 'deposit_vault') {
      ensure(role === 'owner' && status === 'Idle' && deposit > 0n, 'Deposit requires Owner in Idle.');
      v.vault_assets = (BigInt(v.vault_assets) + deposit).toString();
    } else if (method === 'owner_withdraw_near') {
      const amount = uint(args.amount);
      ensure(role === 'owner' && status === 'Idle' && amount > 0n && amount <= BigInt(v.vault_assets), 'Owner withdrawal requires sufficient Idle vault assets.');
      v.vault_assets = (BigInt(v.vault_assets) - amount).toString(); credit('owner', amount);
    } else if (method === 'withdraw_payout') {
      const amount = BigInt(v.credits[role]); ensure(amount > 0n, 'No payout credit.');
      v.credits[role] = '0'; this.transfers[role] += amount;
    } else if (method === 'initiate_claim') {
      ensure(role === 'heir' && status === 'Idle' && this.clock > addTime(BigInt(v.last_check_in_ns), BigInt(v.heartbeat_interval_ns)) && deposit === bond, 'Claim requires missed heartbeat and exact Heir bond.');
      v.state = { status: 'Pending', claimed_at_ns: this.clock.toString(), deadline_ns: addTime(this.clock, BigInt(v.grace_period_ns)).toString() };
      v.locked_heir_bond = bond.toString();
    } else if (method === 'challenge_claim') {
      ensure(role === 'rival' && status === 'Pending' && this.clock < BigInt(v.state.deadline_ns!) && deposit === bond, 'Challenge requires Pending before deadline and exact Rival bond.');
      const deadline = addTime(BigInt(v.state.deadline_ns!), BigInt(v.challenge_extension_ns));
      v.state = { ...v.state, status: 'Challenged', deadline_ns: deadline.toString() }; v.locked_rival_bond = bond.toString();
    } else if (method === 'check_in') {
      ensure(role === 'owner' && status !== 'Finalized' && (!active || this.clock < BigInt(v.state.deadline_ns!)), 'Owner check-in is forbidden at/after deadline or after Finalized.');
      if (active) {
        credit(status === 'Pending' ? 'owner' : 'rival', BigInt(v.locked_heir_bond) + BigInt(v.locked_rival_bond));
        v.last_outcome = status === 'Pending' ? 'FalseAlarm' : 'Busted';
        v.locked_heir_bond = '0'; v.locked_rival_bond = '0';
      }
      v.state = { status: 'Idle' }; v.last_check_in_ns = this.clock.toString();
    } else if (method === 'finalize_inheritance') {
      ensure(active && this.clock >= BigInt(v.state.deadline_ns!), 'Finalize requires an active claim at/after deadline.');
      credit('heir', BigInt(v.vault_assets) + BigInt(v.locked_heir_bond) + BigInt(v.locked_rival_bond));
      v.last_outcome = status === 'Pending' ? 'Uncontested' : 'SpiteBackfired';
      v.state = { status: 'Finalized' }; v.vault_assets = '0'; v.locked_heir_bond = '0'; v.locked_rival_bond = '0';
    } else ensure(false, 'MPC signing is never simulated as a real signature.');
    this.transcript.push({ at_ns: this.clock.toString(), role, method, args, deposit_yocto: deposit.toString(), status: v.state.status });
  }
}
export const expectedOutcome: Record<Scenario, Outcome> = {
  'false-alarm': 'FalseAlarm', busted: 'Busted', inherit: 'Uncontested', spite: 'SpiteBackfired', 'owner-withdraw': 'None',
};
