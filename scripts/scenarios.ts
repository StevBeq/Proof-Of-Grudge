import { addTime, ensure, type Scenario } from './safety.js';
import { expectedOutcome, type Role, type VaultIO } from './model.js';

export function scenarioRoles(scenario: Scenario): Role[] {
  if (scenario === 'owner-withdraw') return ['owner'];
  if (scenario === 'false-alarm') return ['heir', 'owner'];
  if (scenario === 'busted') return ['heir', 'rival', 'owner'];
  return scenario === 'spite' ? ['heir', 'rival'] : ['heir'];
}
export async function runScenario(io: VaultIO, scenario: Scenario, withdrawal?: string) {
  const before = await io.state();
  ensure(before.state.status !== 'Finalized', 'Finalized vaults cannot be reinitialized. Use a fresh, separately deployed vault for another inheritance scenario.');
  ensure(before.state.status === 'Idle', 'Demo scenarios start only from Idle. Inspect an existing claim rather than automatically resetting it.');
  let recipient: Role;
  let expectedCredit: bigint;
  if (scenario === 'owner-withdraw') {
    ensure(withdrawal !== undefined && /^(0|[1-9][0-9]*)$/.test(withdrawal), 'Owner withdrawal requires --amount in yoctoNEAR.');
    const amount = BigInt(withdrawal);
    ensure(amount > 0n && amount <= BigInt(before.vault_assets), 'Withdrawal exceeds the accounted vault assets.');
    await io.call('owner', 'owner_withdraw_near', { amount: withdrawal });
    recipient = 'owner'; expectedCredit = amount;
  } else {
    const target = addTime(addTime(BigInt(before.last_check_in_ns), BigInt(before.heartbeat_interval_ns)), 1n);
    await io.waitUntil(target);
    const ready = await io.state();
    ensure(ready.state.status === 'Idle' && ready.last_check_in_ns === before.last_check_in_ns && ready.required_bond === before.required_bond,
      'Vault changed while waiting for heartbeat. No claim was sent.');
    await io.call('heir', 'initiate_claim', {}, BigInt(before.required_bond));
    if (scenario === 'busted' || scenario === 'spite') await io.call('rival', 'challenge_claim', {}, BigInt(before.required_bond));
    if (scenario === 'false-alarm' || scenario === 'busted') await io.call('owner', 'check_in');
    else {
      const pending = await io.state();
      ensure(pending.state.deadline_ns, 'Expected a claim deadline.');
      await io.waitUntil(BigInt(pending.state.deadline_ns));
      await io.call('heir', 'finalize_inheritance');
    }
    recipient = scenario === 'false-alarm' ? 'owner' : scenario === 'busted' ? 'rival' : 'heir';
    const bonds = BigInt(before.required_bond) * (scenario === 'busted' || scenario === 'spite' ? 2n : 1n);
    expectedCredit = bonds + (recipient === 'heir' ? BigInt(before.vault_assets) : 0n);
  }
  const credited = await io.state();
  ensure(credited.state.status === (scenario === 'inherit' || scenario === 'spite' ? 'Finalized' : 'Idle'), 'Unexpected final scenario status.');
  ensure(credited.last_outcome === (scenario === 'owner-withdraw' ? before.last_outcome : expectedOutcome[scenario]), 'Unexpected payoff outcome.');
  ensure(credited.locked_heir_bond === '0' && credited.locked_rival_bond === '0', 'Scenario left a locked bond.');
  for (const role of ['owner', 'heir', 'rival'] as const) {
    ensure(BigInt(credited.credits[role]) === BigInt(before.credits[role]) + (role === recipient ? expectedCredit : 0n),
      'Observed payoff credits do not match the scenario ledger.');
  }
  const assets = scenario === 'owner-withdraw' ? BigInt(before.vault_assets) - expectedCredit :
    recipient === 'heir' ? 0n : BigInt(before.vault_assets);
  ensure(BigInt(credited.vault_assets) === assets, 'Observed vault assets do not match the scenario ledger.');
  await io.call(recipient, 'withdraw_payout');
  const after = await io.state();
  ensure(after.credits[recipient] === '0', 'Payout credit remains after withdrawal; inspect before retrying.');
  return { scenario, recipient, new_credit_yocto: expectedCredit.toString(), prior_credit_yocto: before.credits[recipient], state: after };
}
