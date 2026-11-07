export const NS = 1_000_000_000n;
export const NEAR = 10n ** 24n;
const U64_MAX = (1n << 64n) - 1n;
export const U128_MAX = (1n << 128n) - 1n;
export const roles = ['owner', 'heir', 'rival'] as const;
export type Role = typeof roles[number];
export type Actor = Role | 'anyone';
export type Status = 'Idle' | 'Pending' | 'Challenged' | 'Finalized';
export type Outcome = 'None' | 'FalseAlarm' | 'Busted' | 'Uncontested' | 'SpiteBackfired';
export type Funds = Record<Role, bigint>;
export type Config = {
  owner: string; heir: string; rival: string;
  heartbeat: bigint; grace: bigint; extension: bigint; bond: bigint; assets: bigint;
};
export type Vault = {
  config: Config; status: Status; outcome: Outcome; lastCheckIn: bigint;
  claimedAt?: bigint; deadline?: bigint; lockedHeir: bigint; lockedRival: bigint;
  assets: bigint; credits: Funds; inFlight: Funds; withdrawn: Funds;
};
export type Call = 'check_in' | 'initiate_claim' | 'challenge_claim' | 'finalize_inheritance' | 'owner_withdraw_near' | 'withdraw_payout' | 'resolve_payout' | 'request_eth_release';
export type Action = { call: Call; actor: Actor; deposit?: bigint; amount?: bigint; success?: boolean };
export type ErrorCode = 'actors' | 'config' | 'overflow' | 'clock' | 'role' | 'state' | 'heartbeat' | 'deadline' | 'early' | 'bond' | 'amount' | 'credit' | 'flight' | 'simulation';
export class VaultError extends Error {
  constructor(public code: ErrorCode) { super(code); }
}
function assert(condition: unknown, code: ErrorCode): asserts condition {
  if (!condition) throw new VaultError(code);
}
export function addTime(a: bigint, b: bigint): bigint {
  assert(a >= 0n && b >= 0n && a <= U64_MAX && b <= U64_MAX - a, 'overflow');
  return a + b;
}
export function addAmount(a: bigint, b: bigint): bigint {
  assert(a >= 0n && b >= 0n && a <= U128_MAX && b <= U128_MAX - a, 'overflow');
  return a + b;
}
export function subtractAmount(a: bigint, b: bigint): bigint {
  addAmount(a, 0n); addAmount(b, 0n);
  assert(b <= a, 'amount');
  return a - b;
}
/** Completed withdrawals are history, not a current contract liability. */
export function totalLiability(v: Vault): bigint {
  return [v.assets, v.lockedHeir, v.lockedRival, ...Object.values(v.credits), ...Object.values(v.inFlight)]
    .reduce((sum, amount) => addAmount(sum, amount), 0n);
}
export const zeroFunds = (): Funds => ({ owner: 0n, heir: 0n, rival: 0n });
export const demoConfig: Config = {
  owner: 'owner.local', heir: 'heir.local', rival: 'rival.local',
  heartbeat: 120n * NS, grace: 60n * NS, extension: 60n * NS, bond: NEAR, assets: 10n * NEAR,
};
export function createVault(config: Config, now: bigint): Vault {
  assert(new Set([config.owner, config.heir, config.rival]).size === 3, 'actors');
  assert(config.heartbeat > 0n && config.grace > 0n && config.extension >= config.grace && config.bond > 0n && config.assets >= 0n, 'config');
  addTime(now, config.heartbeat); addTime(config.grace, config.extension);
  addAmount(config.bond, 0n); addAmount(config.assets, 0n);
  return { config: { ...config }, status: 'Idle', outcome: 'None', lastCheckIn: now,
    lockedHeir: 0n, lockedRival: 0n, assets: config.assets,
    credits: zeroFunds(), inFlight: zeroFunds(), withdrawn: zeroFunds() };
}
/** Pure transition: the caller supplies the clock; no wall time, RPC or mutation. */
export function transition(vault: Vault, action: Action, now: bigint): Vault {
  assert(now >= vault.lastCheckIn && now >= (vault.claimedAt ?? 0n), 'clock');
  addTime(now, 0n);
  const before = totalLiability(vault);
  let incoming = 0n; let outgoing = 0n;
  const v: Vault = { ...vault, credits: { ...vault.credits }, inFlight: { ...vault.inFlight }, withdrawn: { ...vault.withdrawn } };
  const active = v.status === 'Pending' || v.status === 'Challenged';
  const creditBonds = (actor: Role) => {
    v.credits[actor] = addAmount(v.credits[actor], addAmount(v.lockedHeir, v.lockedRival));
    v.lockedHeir = 0n; v.lockedRival = 0n;
  };
  switch (action.call) {
    case 'check_in':
      assert(action.actor === 'owner', 'role');
      assert(v.status !== 'Finalized', 'state');
      if (active) {
        assert(now < v.deadline!, 'deadline');
        v.outcome = v.status === 'Challenged' ? 'Busted' : 'FalseAlarm';
        creditBonds(v.status === 'Challenged' ? 'rival' : 'owner');
      }
      v.status = 'Idle'; v.lastCheckIn = now; v.deadline = undefined; v.claimedAt = undefined;
      break;
    case 'initiate_claim':
      assert(action.actor === 'heir', 'role'); assert(v.status === 'Idle', 'state');
      assert(now > addTime(v.lastCheckIn, v.config.heartbeat), 'heartbeat');
      assert(action.deposit === v.config.bond, 'bond');
      v.deadline = addTime(now, v.config.grace); v.claimedAt = now;
      v.lockedHeir = action.deposit; incoming = action.deposit; v.status = 'Pending';
      break;
    case 'challenge_claim':
      assert(action.actor === 'rival', 'role'); assert(v.status === 'Pending', 'state');
      assert(now < v.deadline!, 'deadline'); assert(action.deposit === v.config.bond, 'bond');
      v.deadline = addTime(v.deadline!, v.config.extension);
      v.lockedRival = action.deposit; incoming = action.deposit; v.status = 'Challenged';
      break;
    case 'finalize_inheritance':
      assert(active, 'state'); assert(now >= v.deadline!, 'early');
      v.outcome = v.status === 'Challenged' ? 'SpiteBackfired' : 'Uncontested';
      v.status = 'Finalized'; creditBonds('heir'); v.credits.heir = addAmount(v.credits.heir, v.assets); v.assets = 0n;
      v.claimedAt = undefined; v.deadline = undefined;
      break;
    case 'owner_withdraw_near':
      assert(action.actor === 'owner', 'role'); assert(v.status === 'Idle', 'state');
      assert(action.amount !== undefined && action.amount > 0n && action.amount <= v.assets, 'amount');
      v.assets = subtractAmount(v.assets, action.amount); v.credits.owner = addAmount(v.credits.owner, action.amount);
      break;
    case 'withdraw_payout':
      assert(action.actor !== 'anyone', 'role');
      assert(v.inFlight[action.actor] === 0n, 'flight'); assert(v.credits[action.actor] > 0n, 'credit');
      v.inFlight[action.actor] = v.credits[action.actor]; v.credits[action.actor] = 0n;
      break;
    case 'resolve_payout':
      // Local-only stand-in for the contract's private transfer callback.
      assert(action.actor !== 'anyone', 'role');
      assert(v.inFlight[action.actor] > 0n, 'credit');
      if (action.success) {
        outgoing = v.inFlight[action.actor];
        v.withdrawn[action.actor] = addAmount(v.withdrawn[action.actor], outgoing);
      } else v.credits[action.actor] = addAmount(v.credits[action.actor], v.inFlight[action.actor]);
      v.inFlight[action.actor] = 0n;
      break;
    case 'request_eth_release':
      assert(action.actor === 'heir', 'role'); assert(v.status === 'Finalized', 'state');
      throw new VaultError('simulation');
  }
  assert(totalLiability(v) === subtractAmount(addAmount(before, incoming), outgoing), 'config');
  return v;
}
export function formatNear(value: bigint, digits = 4): string {
  const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value;
  const fraction = (n % NEAR).toString().padStart(24, '0').slice(0, digits).replace(/0+$/, '');
  return `${sign}${n / NEAR}${fraction ? `.${fraction}` : ''}`;
}
export function parseNear(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,24})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * NEAR + BigInt(fraction.padEnd(24, '0'));
}
export function countdown(deadline: bigint, now: bigint): string {
  const seconds = deadline > now ? (deadline - now + NS - 1n) / NS : 0n;
  return [seconds / 3600n, seconds / 60n % 60n, seconds % 60n].map(n => n.toString().padStart(2, '0')).join(':');
}
export function available(vault: Vault, action: Action, now: bigint): ErrorCode | null {
  try { transition(vault, action, now); return null; }
  catch (error) { return error instanceof VaultError ? error.code : 'state'; }
}
