import { describe, expect, it } from 'vitest';
import { addAmount, addTime, available, countdown, createVault, demoConfig, formatNear, NEAR, NS, parseNear, totalLiability, transition, U128_MAX, VaultError } from './vaultSimulator';
import type { Action, Config, Outcome, Role, Vault } from './vaultSimulator';
import { minimumBond, rivalExpectedValue } from './finance';

const config: Config = { ...demoConfig };
const start = () => createVault(config, 0n);
const claimAt = 120n * NS + 1n;
const claim = (v = start()) => transition(v, { call: 'initiate_claim', actor: 'heir', deposit: config.bond }, claimAt);
const challenge = (v: Vault) => transition(v, { call: 'challenge_claim', actor: 'rival', deposit: config.bond }, claimAt + NS);
function rejects(v: Vault, action: Action, time: bigint, code: string) {
  expect(() => transition(v, action, time)).toThrow(VaultError);
  expect(available(v, action, time)).toBe(code);
}
const branchVectors: { outcome: Outcome; challenged: boolean; returns: boolean; recipient: Role; credited: bigint; vault: bigint; state: string }[] = [
  { outcome: 'FalseAlarm', challenged: false, returns: true, recipient: 'owner', credited: NEAR, vault: 10n * NEAR, state: 'Idle' },
  { outcome: 'Busted', challenged: true, returns: true, recipient: 'rival', credited: 2n * NEAR, vault: 10n * NEAR, state: 'Idle' },
  { outcome: 'Uncontested', challenged: false, returns: false, recipient: 'heir', credited: 11n * NEAR, vault: 0n, state: 'Finalized' },
  { outcome: 'SpiteBackfired', challenged: true, returns: false, recipient: 'heir', credited: 12n * NEAR, vault: 0n, state: 'Finalized' },
];
describe('four deterministic payoff branches (standalone vectors)', () => {
  for (const vector of branchVectors) it(vector.outcome, () => {
    let v = claim(); if (vector.challenged) v = challenge(v);
    const before = structuredClone(v);
    const result = transition(v, vector.returns ? { call: 'check_in', actor: 'owner' } : { call: 'finalize_inheritance', actor: 'rival' }, vector.returns ? claimAt + 2n * NS : v.deadline!);
    expect(result.status).toBe(vector.state); expect(result.outcome).toBe(vector.outcome);
    expect(result.assets).toBe(vector.vault); expect(result.credits[vector.recipient]).toBe(vector.credited);
    expect(result.lockedHeir).toBe(0n); expect(result.lockedRival).toBe(0n);
    for (const actor of ['owner', 'heir', 'rival'] as const) {
      if (actor !== vector.recipient) expect(result.credits[actor]).toBe(0n);
      expect(result.inFlight[actor]).toBe(0n); expect(result.withdrawn[actor]).toBe(0n);
    }
    expect(v).toEqual(before);
    expect(result.assets + Object.values(result.credits).reduce((a, b) => a + b, 0n)).toBe(config.assets + config.bond * (vector.challenged ? 2n : 1n));
  });
});
describe('clock and authorization boundaries', () => {
  it('requires strictly more than the heartbeat interval', () => {
    rejects(start(), { call: 'initiate_claim', actor: 'heir', deposit: NEAR }, 120n * NS, 'heartbeat');
    expect(claim().status).toBe('Pending');
  });
  it('rejects check-in at exactly the deadline, without changing anything', () => {
    const v = claim(); const before = structuredClone(v);
    rejects(v, { call: 'check_in', actor: 'owner' }, v.deadline!, 'deadline'); expect(v).toEqual(before);
    expect(transition(v, { call: 'check_in', actor: 'owner' }, v.deadline! - 1n).outcome).toBe('FalseAlarm');
  });
  it('rejects check-in after Finalized', () => {
    const v = claim(); const finalized = transition(v, { call: 'finalize_inheritance', actor: 'heir' }, v.deadline!);
    rejects(finalized, { call: 'check_in', actor: 'owner' }, v.deadline! + NS, 'state');
  });
  it('rejects early finalize', () => { const v = claim(); rejects(v, { call: 'finalize_inheritance', actor: 'rival' }, v.deadline! - 1n, 'early'); });
  it('extends the original deadline exactly once, not from the challenge time', () => {
    const v = claim(); const next = challenge(v);
    expect(next.deadline).toBe(v.deadline! + config.extension); expect(next.claimedAt).toBe(v.claimedAt);
    rejects(next, { call: 'challenge_claim', actor: 'rival', deposit: NEAR }, claimAt + 2n * NS, 'state');
    rejects(v, { call: 'challenge_claim', actor: 'rival', deposit: NEAR }, v.deadline!, 'deadline');
  });
  it('requires exact deposits from the correct roles', () => {
    for (const deposit of [0n, NEAR - 1n, NEAR + 1n]) {
      rejects(start(), { call: 'initiate_claim', actor: 'heir', deposit }, claimAt, 'bond');
      rejects(claim(), { call: 'challenge_claim', actor: 'rival', deposit }, claimAt + NS, 'bond');
    }
    rejects(start(), { call: 'initiate_claim', actor: 'owner', deposit: NEAR }, claimAt, 'role');
    rejects(claim(), { call: 'challenge_claim', actor: 'owner', deposit: NEAR }, claimAt + NS, 'role');
    rejects(claim(), { call: 'check_in', actor: 'heir' }, claimAt + NS, 'role');
  });
  it('retains the last outcome separately when an Idle heartbeat is refreshed', () => {
    const v = transition(claim(), { call: 'check_in', actor: 'owner' }, claimAt + NS);
    const next = transition(v, { call: 'check_in', actor: 'owner' }, claimAt + 2n * NS);
    expect(next.status).toBe('Idle'); expect(next.outcome).toBe('FalseAlarm');
  });
  it('validates distinct actors, checked timestamp additions and monotonic time', () => {
    expect(() => createVault({ ...config, heir: config.owner }, 0n)).toThrow(VaultError);
    expect(() => addTime((1n << 64n) - 1n, 1n)).toThrow(VaultError);
    rejects(createVault(config, NS), { call: 'check_in', actor: 'owner' }, 0n, 'clock');
  });
});
describe('pull payments', () => {
  it('owner withdrawal credits assets, not raw account balance or an immediate send', () => {
    const v = transition(start(), { call: 'owner_withdraw_near', actor: 'owner', amount: NEAR }, 0n);
    expect(v.assets).toBe(9n * NEAR); expect(v.credits.owner).toBe(NEAR); expect(v.withdrawn.owner).toBe(0n);
    rejects(claim(), { call: 'owner_withdraw_near', actor: 'owner', amount: NEAR }, claimAt, 'state');
    rejects(start(), { call: 'owner_withdraw_near', actor: 'rival', amount: NEAR }, 0n, 'role');
  });
  it('restores failed transfer credit and permits a retry', () => {
    let v = transition(start(), { call: 'owner_withdraw_near', actor: 'owner', amount: NEAR }, 0n);
    v = transition(v, { call: 'withdraw_payout', actor: 'owner' }, 0n);
    expect(v.credits.owner).toBe(0n); expect(v.inFlight.owner).toBe(NEAR);
    rejects(v, { call: 'withdraw_payout', actor: 'owner' }, 0n, 'flight');
    v = transition(v, { call: 'owner_withdraw_near', actor: 'owner', amount: NEAR }, 0n);
    v = transition(v, { call: 'resolve_payout', actor: 'owner', success: false }, 0n);
    expect(v.credits.owner).toBe(2n * NEAR); expect(v.inFlight.owner).toBe(0n);
    v = transition(v, { call: 'withdraw_payout', actor: 'owner' }, 0n);
    v = transition(v, { call: 'resolve_payout', actor: 'owner', success: true }, 0n);
    expect(v.withdrawn.owner).toBe(2n * NEAR); expect(v.credits.owner).toBe(0n);
  });
  it('never produces a real ETH signature', () => {
    const pending = claim(); const v = transition(pending, { call: 'finalize_inheritance', actor: 'heir' }, pending.deadline!);
    rejects(v, { call: 'request_eth_release', actor: 'heir' }, pending.deadline!, 'simulation');
    rejects(v, { call: 'request_eth_release', actor: 'rival' }, pending.deadline!, 'role');
  });
});
describe('u128 liabilities and conservation', () => {
  it('checks individual amounts and additions at the u128 boundary', () => {
    expect(addAmount(U128_MAX - 1n, 1n)).toBe(U128_MAX);
    expect(() => addAmount(U128_MAX, 1n)).toThrow(VaultError);
    expect(() => addAmount(-1n, 0n)).toThrow(VaultError);
    expect(() => createVault({ ...config, assets: U128_MAX + 1n }, 0n)).toThrow(VaultError);
    expect(() => createVault({ ...config, bond: U128_MAX + 1n }, 0n)).toThrow(VaultError);
  });
  it('rejects aggregate liability overflow even when each locked bond fits', () => {
    const v = createVault({ ...config, bond: 1n, assets: U128_MAX - 1n }, 0n);
    const pending = transition(v, { call: 'initiate_claim', actor: 'heir', deposit: 1n }, claimAt);
    expect(totalLiability(pending)).toBe(U128_MAX);
    const before = structuredClone(pending);
    rejects(pending, { call: 'challenge_claim', actor: 'rival', deposit: 1n }, claimAt + NS, 'overflow');
    expect(pending).toEqual(before);
  });
  it('keeps credits and in-flight amounts in liabilities, removing only a successful transfer', () => {
    const initial = start();
    const credited = transition(initial, { call: 'owner_withdraw_near', actor: 'owner', amount: NEAR }, 0n);
    const inFlight = transition(credited, { call: 'withdraw_payout', actor: 'owner' }, 0n);
    const restored = transition(inFlight, { call: 'resolve_payout', actor: 'owner', success: false }, 0n);
    const paid = transition(inFlight, { call: 'resolve_payout', actor: 'owner', success: true }, 0n);
    expect(totalLiability(credited)).toBe(totalLiability(initial));
    expect(totalLiability(inFlight)).toBe(totalLiability(initial));
    expect(totalLiability(restored)).toBe(totalLiability(initial));
    expect(totalLiability(paid)).toBe(totalLiability(initial) - NEAR);
  });
  it('models anyone as an outsider, not an alias for one of the funded actors', () => {
    const pending = claim();
    rejects(pending, { call: 'check_in', actor: 'anyone' }, claimAt + NS, 'role');
    rejects(pending, { call: 'challenge_claim', actor: 'anyone', deposit: NEAR }, claimAt + NS, 'role');
    rejects(pending, { call: 'withdraw_payout', actor: 'anyone' }, claimAt + NS, 'role');
    expect(transition(pending, { call: 'finalize_inheritance', actor: 'anyone' }, pending.deadline!).status).toBe('Finalized');
  });
});
describe('precision and game theory', () => {
  it('preserves all 24 decimal places in money parsing', () => {
    expect(parseNear('1.000000000000000000000001')).toBe(NEAR + 1n);
    expect(parseNear('1e5')).toBeNull(); expect(parseNear('-1')).toBeNull(); expect(parseNear('NaN')).toBeNull();
    expect(formatNear(10n * NEAR)).toBe('10'); expect(formatNear(-NEAR / 2n)).toBe('-0.5');
  });
  it('rounds countdown up rather than showing zero before the deadline', () => { expect(countdown(1n, 0n)).toBe('00:00:01'); expect(countdown(NS, NS)).toBe('00:00:00'); });
  it('crosses zero at 50% and computes the minimum bond with integer ceiling', () => {
    expect(rivalExpectedValue(NEAR, 50n)).toBe(0n); expect(rivalExpectedValue(NEAR, 65n)).toBe(NEAR * 30n / 100n);
    const min = minimumBond(100n * NEAR, 90n); expect(min * 90n).toBeGreaterThanOrEqual(100n * NEAR * 10n);
    expect(minimumBond(100n * NEAR, 50n)).toBe(100n * NEAR); expect(() => minimumBond(NEAR, 0n)).toThrow(RangeError);
  });
});
