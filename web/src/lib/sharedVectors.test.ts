import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createVault, demoConfig, roles, totalLiability, transition, VaultError } from './vaultSimulator';
import type { Action, Call, Funds, Outcome, Status } from './vaultSimulator';

type SharedStep = {
  at_ns: string; actor: Action['actor']; call: string;
  deposit?: string; amount?: string; reject?: boolean;
};
type SharedVectors = {
  config: { heartbeat_ns: string; grace_ns: string; extension_ns: string; bond_yocto: string; vault_yocto: string };
  cases: {
    name: string; steps: SharedStep[];
    expected: { status: Status; outcome: Outcome; credits: Record<keyof Funds, string>; vault_assets: string };
  }[];
};
const publicCalls: readonly Call[] = [
  'check_in', 'initiate_claim', 'challenge_claim', 'finalize_inheritance',
  'owner_withdraw_near', 'withdraw_payout', 'request_eth_release',
];

// lib -> src -> web -> repository root. This is read only when the test runs.
const vectorsUrl = new URL('../../../test-vectors/branches.json', import.meta.url);

describe('shared contract/frontend branch vectors', () => {
  it('replays every root vector and preserves rejected state atomically', () => {
    // Missing vectors fail loudly when testing is authorized; no silent skip or fallback.
    const vectors = JSON.parse(readFileSync(vectorsUrl, 'utf8')) as SharedVectors;
    expect(Array.isArray(vectors.cases)).toBe(true);
    expect(vectors.cases.length).toBeGreaterThan(0);
    const config = {
      ...demoConfig,
      heartbeat: BigInt(vectors.config.heartbeat_ns), grace: BigInt(vectors.config.grace_ns),
      extension: BigInt(vectors.config.extension_ns), bond: BigInt(vectors.config.bond_yocto),
      assets: BigInt(vectors.config.vault_yocto),
    };
    for (const vector of vectors.cases) {
      let vault = createVault(config, 0n);
      for (const [index, step] of vector.steps.entries()) {
        const context = `${vector.name}: step ${index + 1}, ${step.actor}.${step.call}`;
        expect(publicCalls.includes(step.call as Call), context).toBe(true);
        expect([...roles, 'anyone'].includes(step.actor), context).toBe(true);
        const action: Action = {
          actor: step.actor, call: step.call as Call,
          deposit: step.deposit === undefined ? undefined : BigInt(step.deposit),
          amount: step.amount === undefined ? undefined : BigInt(step.amount),
        };
        const before = structuredClone(vault);
        if (step.reject) {
          expect(() => transition(vault, action, BigInt(step.at_ns)), context).toThrow(VaultError);
          expect(vault, context).toEqual(before);
        } else {
          const next = transition(vault, action, BigInt(step.at_ns));
          const deposit = action.call === 'initiate_claim' || action.call === 'challenge_claim' ? action.deposit ?? 0n : 0n;
          expect(totalLiability(next), context).toBe(totalLiability(before) + deposit);
          expect(vault, context).toEqual(before);
          vault = next;
        }
      }
      expect(vault.status, vector.name).toBe(vector.expected.status);
      expect(vault.outcome, vector.name).toBe(vector.expected.outcome);
      expect(vault.assets, vector.name).toBe(BigInt(vector.expected.vault_assets));
      for (const role of roles) expect(vault.credits[role], `${vector.name}: ${role} credit`).toBe(BigInt(vector.expected.credits[role]));
    }
  });
});
