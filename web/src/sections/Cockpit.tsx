import { useEffect, useId, useRef, useState } from 'react';
import { ArrowSquareOut, Clock, LockSimple, WarningCircle, ArrowsClockwise } from '@phosphor-icons/react';
import type { Copy, Locale } from '../lib/copy';
import { actionLabel, errorLabel, outcomeLabel, outcomePayout, statusLabel } from '../lib/copy';
import { available, countdown, createVault, demoConfig, formatNear, NS, parseNear, roles, transition, VaultError } from '../lib/vaultSimulator';
import type { Action, Call, ErrorCode, Outcome, Role, Status, Vault } from '../lib/vaultSimulator';
import { ethAddress, publicConfig, toVault } from '../lib/nearClient';
import { useLiveVault } from '../lib/useLiveVault';
import { ExpectedValue } from './ExpectedValue';
import { Amount } from './Amount';

type Entry = { id: number; at: bigint; call?: Call; actor?: Action['actor']; error?: ErrorCode; kind?: 'reset' | 'time'; success?: boolean };
type Props = { c: Copy; locale: Locale; onScene: (state: Status, outcome: Outcome) => void; role?: Role; onRoleChange?: (role: Role) => void; scenarioRequest?: { id: number; outcome: Outcome } | null };
function ActionButton({ label, tip, reason, actor, onClick }: { label: string; tip: string; reason?: string; actor?: Role; onClick: () => void }) {
  const id = useId();
  return <span className="action-wrap" tabIndex={reason ? 0 : undefined} aria-describedby={reason ? id : undefined}>
    <button type="button" className={actor ? `actor-button button-${actor}` : 'button-secondary'} disabled={Boolean(reason)} onClick={onClick} title={tip} aria-describedby={id}>{label}</button>
    <span id={id} className="action-tip" role="tooltip">{reason || tip}</span>
  </span>;
}
export function Cockpit({ c, locale, onScene, role: roleProp, onRoleChange, scenarioRequest }: Props) {
  const [mode, setMode] = useState<'local' | 'live'>('local');
  const [roleState, setRoleState] = useState<Role>('heir');
  const role = roleProp ?? roleState;
  const setRole = onRoleChange ?? setRoleState;
  const [vault, setVault] = useState(() => createVault(demoConfig, 0n)); const vaultRef = useRef(vault);
  const origin = useRef(performance.now()); const offset = useRef(0n);
  const clock = () => BigInt(Math.floor(performance.now() - origin.current)) * 1_000_000n + offset.current;
  const [now, setNow] = useState(0n); const [amount, setAmount] = useState('1');
  const [log, setLog] = useState<Entry[]>([]); const sequence = useRef(0);
  const [reverted, setReverted] = useState(false); const [lastError, setLastError] = useState<ErrorCode | null>(null);
  const [releaseNotice, setReleaseNotice] = useState(false);
  const live = useLiveVault(mode === 'live');
  const liveVault = live.snapshot ? toVault(live.snapshot) : null;
  const shown: Vault = mode === 'live' && liveVault ? liveVault : vault;
  const shownNow = mode === 'live' && live.snapshot ? BigInt(live.snapshot.observed_at_ns) : now;
  const isActive = shown.status === 'Pending' || shown.status === 'Challenged';
  const timerDeadline = isActive ? shown.deadline! : shown.lastCheckIn + shown.config.heartbeat;
  const heartbeatMissed = shownNow > timerDeadline;
  const ready = isActive && shownNow >= timerDeadline;
  useEffect(() => {
    if (mode !== 'local') return;
    const timer = setInterval(() => setNow(clock()), 200);
    return () => clearInterval(timer);
  }, [mode]);
  useEffect(() => {
    if (mode === 'live' && !liveVault) onScene('Idle', 'None');
    else onScene(shown.status, shown.outcome);
  }, [mode, shown.status, shown.outcome, Boolean(liveVault), onScene]);
  const append = (entry: Omit<Entry, 'id'>) => {
    const next = { ...entry, id: ++sequence.current };
    setLog(previous => [...previous, next]);
  };
  const doAction = (action: Action): boolean => {
    const at = clock(); setNow(at); setReleaseNotice(false);
    try {
      const next = transition(vaultRef.current, action, at); vaultRef.current = next; setVault(next);
      setReverted(false); setLastError(null); append({ at, call: action.call, actor: action.actor, success: action.success });
      return true;
    } catch (error) {
      const code = error instanceof VaultError ? error.code : 'state';
      setLastError(code);
      if (action.call === 'check_in' && code === 'deadline') setReverted(true);
      append({ at, call: action.call, actor: action.actor, error: code });
      return false;
    }
  };
  const perform = (action: Action) => {
    if (mode !== 'local') return;
    doAction(action);
  };
  const advanceTo = (target: bigint) => {
    const at = clock();
    if (target > at) { offset.current += target - at; setNow(target); append({ at: target, kind: 'time' }); }
  };
  const advance = (toDeadline = false) => {
    const at = clock(); const v = vaultRef.current;
    const boundary = v.deadline ?? v.lastCheckIn + v.config.heartbeat + 1n;
    const target = toDeadline ? (boundary > at ? boundary : at) : at + 30n * NS;
    advanceTo(target);
  };
  const reset = () => {
    origin.current = performance.now(); offset.current = 0n;
    const next = createVault(demoConfig, 0n); vaultRef.current = next; setVault(next); setNow(0n);
    setReverted(false); setLastError(null); setReleaseNotice(false); append({ at: 0n, kind: 'reset' });
  };
  const runScenario = (targetOutcome: Outcome) => {
    setMode('local');
    reset();
    const bond = vaultRef.current.config.bond;
    const pastHeartbeat = () => vaultRef.current.lastCheckIn + vaultRef.current.config.heartbeat + 5n * NS;
    const pastDeadline = () => (vaultRef.current.deadline ?? 0n) + NS;
    switch (targetOutcome) {
      case 'FalseAlarm':
        advanceTo(pastHeartbeat());
        doAction({ call: 'initiate_claim', actor: 'heir', deposit: bond });
        doAction({ call: 'check_in', actor: 'owner' });
        break;
      case 'Busted':
        advanceTo(pastHeartbeat());
        doAction({ call: 'initiate_claim', actor: 'heir', deposit: bond });
        doAction({ call: 'challenge_claim', actor: 'rival', deposit: bond });
        doAction({ call: 'check_in', actor: 'owner' });
        break;
      case 'Uncontested':
        advanceTo(pastHeartbeat());
        doAction({ call: 'initiate_claim', actor: 'heir', deposit: bond });
        advanceTo(pastDeadline());
        doAction({ call: 'finalize_inheritance', actor: 'anyone' });
        break;
      case 'SpiteBackfired':
        advanceTo(pastHeartbeat());
        doAction({ call: 'initiate_claim', actor: 'heir', deposit: bond });
        doAction({ call: 'challenge_claim', actor: 'rival', deposit: bond });
        advanceTo(pastDeadline());
        doAction({ call: 'finalize_inheritance', actor: 'anyone' });
        break;
      default:
        break;
    }
  };
  useEffect(() => {
    if (scenarioRequest) runScenario(scenarioRequest.outcome);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioRequest?.id]);
  const reasonFor = (action: Action) => {
    const reason = available(vault, action, now); return reason ? errorLabel(c, reason) : undefined;
  };
  const bond = vault.config.bond;
  const withdrawAmount = parseNear(amount.replace(',', '.')) ?? 0n;
  const call = (name: Call, extra: Partial<Action> = {}): Action => ({ call: name, actor: role, ...extra });
  const date = (value: number | null) => value === null ? '' : new Date(value).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', { timeZoneName: 'short' });
  const snapshotReady = mode === 'local' || Boolean(live.snapshot);
  return <section id="cockpit" className="section cockpit-section" aria-labelledby="cockpit-heading">
    <div className="section-heading"><h2 id="cockpit-heading">{c.cockpitTitle}</h2><p>{c.cockpitIntro}</p></div>
    <div className="cockpit-shell">
      <div className="cockpit-toolbar">
        <div className="segmented" role="group" aria-label={c.cockpit}>
          <button type="button" aria-pressed={mode === 'local'} onClick={() => setMode('local')}>{c.local}</button>
          <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>{c.live}</button>
        </div>
        <span className="mode-badge"><LockSimple size={16} aria-hidden="true" />{mode === 'local' ? c.simulated : c.readonly}</span>
      </div>
      {mode === 'local' ? <div className="role-toolbar">
        <fieldset><legend>{c.role}</legend><div className="role-choices">{roles.map(actor => <button key={actor} type="button" aria-pressed={role === actor} className={`role-choice role-${actor}`} onClick={() => setRole(actor)}>{c[actor]}</button>)}</div></fieldset>
        <fieldset><legend>{c.time}</legend><div className="time-choices"><button type="button" onClick={() => advance()}><Clock size={16} aria-hidden="true" />{c.advance}</button><button type="button" onClick={() => advance(true)} disabled={vault.status === 'Finalized'}>{c.deadlineButton}</button><button type="button" onClick={reset}><ArrowsClockwise size={16} aria-hidden="true" />{c.reset}</button></div></fieldset>
      </div> : <div className="live-toolbar"><p className="caption">{c.liveNote}</p><button type="button" onClick={live.refresh} disabled={live.loading || !publicConfig.contractId}>{live.loading ? c.refreshing : c.refresh}</button></div>}
      {mode === 'live' && <div className="live-status">
        {!publicConfig.contractId ? <><h3>{c.configure}</h3><p>{c.configureHelp}</p></> : <>
          <p>{c.contract}: <code className="break-anywhere">{publicConfig.contractId}</code></p>
          {live.error && <p role="alert"><WarningCircle aria-hidden="true" size={18} /> {c.rpcError} {live.snapshot ? c.stale : ''}</p>}
          {!live.snapshot && !live.error && <p role="status">{c.initialRead}</p>}
          {live.receivedAt && <p className="caption">{c.snapshot}: <time dateTime={new Date(live.receivedAt).toISOString()}>{date(live.receivedAt)}</time></p>}
        </>}
      </div>}
      <div className="cockpit-main">
        <div className="cockpit-visual">
          <div id="cockpit-scene" className="scene-anchor" role="img" aria-label={c.scene} />
          {snapshotReady && <div className="clock-readout">
            <span className="caption">{shown.status === 'Finalized' ? c.final : isActive ? c.deadline : c.heartbeat}</span>
            <strong className="mono">{shown.status === 'Finalized' ? '00:00:00' : countdown(timerDeadline, shownNow)}</strong>
            <span className="caption">{ready ? c.expired : !isActive && heartbeatMissed && shown.status !== 'Finalized' ? c.eligible : mode === 'local' ? c.noKeys : c.readonly}</span>
          </div>}
          <div className="actor-legend">{roles.map(actor => <span className={`actor-${actor}`} key={actor}><i aria-hidden="true" />{c[actor]}</span>)}</div>
        </div>
        <div className="cockpit-data" aria-busy={mode === 'live' && live.loading}>
          {snapshotReady ? <>
            <div className="state-row"><div><span className="caption">{c.state}</span><h3 className="state-value">{statusLabel(c, shown.status)}</h3></div><div className={`outcome-stamp outcome-${shown.outcome}`} key={`${shown.outcome}-${mode}`}><span className="caption">{c.lastOutcome}</span><strong>{outcomeLabel(c, shown.outcome)}</strong>{shown.outcome !== 'None' && <span>{outcomePayout(c, shown.outcome)}</span>}</div></div>
            <dl className="balances"><div><dt>{c.heirBond}</dt><dd className="mono actor-heir"><Amount value={shown.lockedHeir} animate={mode === 'local'} /> <small>NEAR</small></dd></div><div><dt>{c.rivalBond}</dt><dd className="mono actor-rival"><Amount value={shown.lockedRival} animate={mode === 'local'} /> <small>NEAR</small></dd></div><div><dt>{c.vault}</dt><dd className="mono"><Amount value={shown.assets} animate={mode === 'local'} /> <small>NEAR</small></dd></div></dl>
            <p className="caption">{c.required}: <span className="mono">{formatNear(shown.config.bond)} NEAR</span>. H = R = B.</p>
            <ExpectedValue c={c} bond={shown.config.bond} />
            {mode === 'local' && <section className="actions-panel" aria-labelledby="actions-heading">
              <h3 id="actions-heading">{c.actions}: <span className={`actor-${role}`}>{c[role]}</span></h3>
              <div className="action-list">
                {role === 'owner' && <ActionButton label={c.checkIn} actor="owner" tip={`check_in(): ${c.checkTip}`} reason={vault.status === 'Finalized' ? c.errorState : undefined} onClick={() => perform(call('check_in'))} />}
                {role === 'heir' && vault.status === 'Idle' && <ActionButton label={c.initiate} actor="heir" tip={`initiate_claim(): ${c.initiateTip}`} reason={reasonFor(call('initiate_claim', { deposit: bond }))} onClick={() => perform(call('initiate_claim', { deposit: bond }))} />}
                {role === 'rival' && <ActionButton label={c.challenge} actor="rival" tip={`challenge_claim(): ${c.challengeTip}`} reason={reasonFor(call('challenge_claim', { deposit: bond }))} onClick={() => perform(call('challenge_claim', { deposit: bond }))} />}
                <ActionButton label={c.finalize} tip={`finalize_inheritance(): ${c.finalizeTip}`} reason={reasonFor(call('finalize_inheritance'))} onClick={() => perform(call('finalize_inheritance'))} />
                {role === 'heir' && vault.status === 'Finalized' && <ActionButton label={c.release} actor="heir" tip={`request_eth_release(): ${c.releaseNote}`} onClick={() => setReleaseNotice(true)} />}
              </div>
              {role === 'owner' && vault.status === 'Idle' && <div className="withdraw-row"><label htmlFor="withdraw-amount">{c.amount}<input id="withdraw-amount" type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={withdrawAmount <= 0n || withdrawAmount > vault.assets} /></label><ActionButton label={c.withdraw} actor="owner" tip={`owner_withdraw_near(amount): ${c.withdrawTip}`} reason={reasonFor(call('owner_withdraw_near', { amount: withdrawAmount }))} onClick={() => perform(call('owner_withdraw_near', { amount: withdrawAmount }))} /></div>}
              {reverted && <div className="reverted-stamp" role="status"><WarningCircle size={20} aria-hidden="true" /><strong>{c.reverted}</strong><span>{c.revertStamp}</span></div>}
              {lastError && <p role="alert" className="feedback">{errorLabel(c, lastError)}</p>}
              {releaseNotice && <p role="status" className="feedback">{c.releaseSimulation}</p>}
              {vault.status === 'Finalized' && <p className="caption">{c.releaseNote}</p>}
            </section>}
            <section className="credits-panel" aria-labelledby="credits-heading"><h3 id="credits-heading">{c.credits}</h3><div className="credit-table-wrap" tabIndex={0} role="region" aria-label={c.credits}><table className="credit-table"><thead><tr><th scope="col">{c.role}</th><th scope="col">{c.credits}</th><th scope="col">{c.inFlight}</th>{mode === 'local' && <th scope="col">{c.withdrawn}</th>}</tr></thead><tbody>{roles.map(actor => <tr key={actor}><th scope="row" className={`actor-${actor}`}>{c[actor]}</th><td className="mono">{formatNear(shown.credits[actor])}</td><td className="mono">{formatNear(shown.inFlight[actor])}</td>{mode === 'local' && <td className="mono">{formatNear(shown.withdrawn[actor])}</td>}</tr>)}</tbody></table></div><p className="caption">NEAR. {c.payoutNote}</p>
              {mode === 'local' && <div className="action-list">
                <ActionButton label={c.payout} actor={role} tip={`withdraw_payout(): ${c.payoutTip}`} reason={reasonFor(call('withdraw_payout'))} onClick={() => perform(call('withdraw_payout'))} />
                {vault.inFlight[role] > 0n && <><button type="button" onClick={() => perform(call('resolve_payout', { success: true }))}>{c.succeed}</button><button type="button" onClick={() => perform(call('resolve_payout', { success: false }))}>{c.fail}</button></>}
              </div>}
            </section>
            {mode === 'live' && live.snapshot && <div className="snapshot-details"><dl>{roles.map(actor => <div key={actor}><dt>{c[actor]}</dt><dd className="mono break-anywhere">{live.snapshot![actor]}</dd></div>)}<div><dt>{c.heirAddress}</dt><dd className="mono break-anywhere">{ethAddress(live.snapshot.heir_eth_address)}</dd></div><div><dt>{c.observed}</dt><dd className="mono">{live.snapshot.observed_at_ns} ns</dd></div></dl><h3>{c.ethRelease}</h3><p>{live.snapshot.signing_in_flight ? c.signing : live.snapshot.eth_release === null ? c.notRequested : live.snapshot.eth_release.signature != null ? c.signatureStored : c.awaitingSignature}</p><p className="caption">{c.releaseNote}</p></div>}
          </> : <p className="empty-readout">{publicConfig.contractId ? c.initialRead : c.configure}</p>}
        </div>
      </div>
      <div className="event-panel">
        {mode === 'local' ? <>
          <h3>{c.log}</h3>
          {log.length === 0 ? <p className="caption">{c.logEmpty}</p> : (
            <ol className="event-log" aria-label={c.log}>
              {log.map(entry => (
                <li key={entry.id}>
                  <span className="mono log-time">{countdown(entry.at, 0n)}</span>
                  <span>
                    {entry.kind === 'reset' ? c.resetLog : entry.kind === 'time' ? c.timeLog : <>
                      <span className={`actor-${entry.actor}`}>{entry.actor ? c[entry.actor] : ''}</span>: {entry.call ? actionLabel(c, entry.call) : ''}. {entry.error ? `${c.rejected}: ${errorLabel(c, entry.error)}` : entry.call === 'resolve_payout' ? (entry.success ? c.succeed : c.fail) : c.completed}
                    </>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </> : <>
          <h3>{c.proofs}</h3>
          {live.proofError && <p role="alert">{live.proofError}</p>}
          {live.proofs.length ? <ul className="proof-list">{live.proofs.map(proof => <li key={proof.url}><a href={proof.url} target="_blank" rel="noopener noreferrer">{proof.network === 'near-testnet' ? c.nearProof : c.ethProof}<ArrowSquareOut size={18} aria-hidden="true" /><span className="mono break-anywhere">{proof.url.split('/').filter(Boolean).at(-1)}</span></a></li>)}</ul> : <p>{c.noProofs}</p>}
          <p className="caption">{c.proofHelp}</p>
        </>}
      </div>
    </div>
  </section>;
}
