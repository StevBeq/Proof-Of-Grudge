import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowSquareOut,
  Clock,
  LockSimple,
  WarningCircle,
  ArrowsClockwise,
  Wallet,
  CheckCircle,
  SpinnerGap,
  ShieldCheck,
  Globe,
  Plus,
} from '@phosphor-icons/react';
import type { Copy, Locale } from '../lib/copy';
import { actionLabel, errorLabel, outcomeLabel, outcomePayout, statusLabel } from '../lib/copy';
import { available, countdown, createVault, demoConfig, formatNear, NS, parseNear, roles, transition, VaultError } from '../lib/vaultSimulator';
import type { Action, Call, ErrorCode, Outcome, Role, Status, Vault } from '../lib/vaultSimulator';
import { PRESET_VAULTS, ethAddress, isValidTestnetAccount, publicConfig, toVault } from '../lib/nearClient';
import { useLiveVault } from '../lib/useLiveVault';
import { useNearWallet } from '../lib/useNearWallet';
import { resetSceneRotation } from '../lib/sceneInput';
import { ExpectedValue } from './ExpectedValue';
import { Amount } from './Amount';
import { EvidencePanel } from './EvidencePanel';
import { CreateVaultModal } from './CreateVaultModal';

type Entry = { id: number; at: bigint; call?: Call; actor?: Action['actor']; error?: ErrorCode; kind?: 'reset' | 'time'; success?: boolean };
type Props = {
  c: Copy;
  locale: Locale;
  onScene: (state: Status, outcome: Outcome) => void;
  role?: Role;
  onRoleChange?: (role: Role) => void;
  scenarioRequest?: { id: number; outcome: Outcome } | null;
  entered?: boolean;
};

function ActionButton({ label, tip, reason, actor, onClick }: { label: string; tip: string; reason?: string; actor?: Role; onClick: () => void }) {
  const id = useId();
  return <span className="action-wrap" tabIndex={reason ? 0 : undefined} aria-describedby={reason ? id : undefined}>
    <button type="button" className={actor ? `actor-button button-${actor}` : 'button-secondary'} disabled={Boolean(reason)} onClick={onClick} title={tip} aria-describedby={id}>{label}</button>
    <span id={id} className="action-tip" role="tooltip">{reason || tip}</span>
  </span>;
}

export function Cockpit({ c, locale, onScene, role: roleProp, onRoleChange, scenarioRequest, entered }: Props) {
  const [mode, setMode] = useState<'local' | 'live'>('local');
  const [roleState, setRoleState] = useState<Role>('heir');
  const role = roleProp ?? roleState;
  const setRole = onRoleChange ?? setRoleState;

  // Local simulation state
  const [vault, setVault] = useState(() => createVault(demoConfig, 0n));
  const vaultRef = useRef(vault);
  const origin = useRef(performance.now());
  const offset = useRef(0n);
  const clock = () => BigInt(Math.floor(performance.now() - origin.current)) * 1_000_000n + offset.current;
  const [now, setNow] = useState(0n);
  const [hasStarted, setHasStarted] = useState(false);
  const cockpitRef = useRef<HTMLElement>(null);
  const [amount, setAmount] = useState('1');
  const [log, setLog] = useState<Entry[]>([]);
  const sequence = useRef(0);
  const [reverted, setReverted] = useState(false);
  const [lastError, setLastError] = useState<ErrorCode | null>(null);
  const [releaseNotice, setReleaseNotice] = useState(false);

  // Live testnet state & wallet
  const [targetContractId, setTargetContractId] = useState<string>(
    publicConfig.contractId || PRESET_VAULTS[0].id
  );
  const [customVaultInput, setCustomVaultInput] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customVaults, setCustomVaults] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pog-custom-vaults') || '[]');
    } catch {
      return [];
    }
  });
  const [sessionTxns, setSessionTxns] = useState<Array<{ hash: string; label: string; at: number }>>([]);

  const live = useLiveVault(mode === 'live', targetContractId);
  const wallet = useNearWallet();

  const liveVault = live.snapshot ? toVault(live.snapshot) : null;
  const shown: Vault = mode === 'live' && liveVault ? liveVault : vault;
  const shownNow = mode === 'live' && live.snapshot ? BigInt(live.snapshot.observed_at_ns) : now;
  const isActive = shown.status === 'Pending' || shown.status === 'Challenged';
  const timerDeadline = isActive ? shown.deadline! : shown.lastCheckIn + shown.config.heartbeat;
  const heartbeatMissed = shownNow > timerDeadline;
  const ready = isActive && shownNow >= timerDeadline;

  // Role match detection in live mode
  const connectedRole: Role | 'observer' | null = !wallet.accountId
    ? null
    : live.snapshot && wallet.accountId.toLowerCase() === live.snapshot.owner.toLowerCase()
    ? 'owner'
    : live.snapshot && wallet.accountId.toLowerCase() === live.snapshot.heir.toLowerCase()
    ? 'heir'
    : live.snapshot && wallet.accountId.toLowerCase() === live.snapshot.rival.toLowerCase()
    ? 'rival'
    : 'observer';

  // Automatically focus on user's role when connecting
  useEffect(() => {
    if (mode === 'live' && connectedRole && connectedRole !== 'observer') {
      setRole(connectedRole);
    }
  }, [mode, connectedRole, setRole]);

  useEffect(() => {
    if (entered && !hasStarted) {
      setHasStarted(true);
      origin.current = performance.now();
      offset.current = 0n;
      setNow(0n);
    }
  }, [entered, hasStarted]);

  useEffect(() => {
    if (hasStarted || !cockpitRef.current) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setHasStarted(true);
          origin.current = performance.now();
          offset.current = 0n;
          setNow(0n);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(cockpitRef.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (mode !== 'local' || !hasStarted) return;
    const timer = setInterval(() => setNow(clock()), 200);
    return () => clearInterval(timer);
  }, [mode, hasStarted]);

  useEffect(() => {
    if (mode === 'live' && !liveVault) onScene('Idle', 'None');
    else onScene(shown.status, shown.outcome);
  }, [mode, shown.status, shown.outcome, Boolean(liveVault), onScene]);

  const append = (entry: Omit<Entry, 'id'>) => {
    const next = { ...entry, id: ++sequence.current };
    setLog(previous => [...previous, next]);
  };

  const doAction = (action: Action): boolean => {
    if (!hasStarted) {
      setHasStarted(true);
      origin.current = performance.now();
    }
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
    if (!hasStarted) {
      setHasStarted(true);
      origin.current = performance.now();
    }
    const at = clock();
    if (target > at) { offset.current += target - at; setNow(target); append({ at: target, kind: 'time' }); }
  };

  const advance = (toDeadline = false) => {
    if (!hasStarted) {
      setHasStarted(true);
      origin.current = performance.now();
    }
    const at = clock(); const v = vaultRef.current;
    const boundary = v.deadline ?? v.lastCheckIn + v.config.heartbeat + 1n;
    const target = toDeadline ? (boundary > at ? boundary : at) : at + 30n * NS;
    advanceTo(target);
  };

  const reset = () => {
    setHasStarted(true);
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

  // Live transaction dispatcher
  const sendLiveAction = async (
    callName: Call,
    extraArgs: Record<string, unknown> = {},
    depositYocto: bigint = 0n,
    gasTgas: number = 30,
  ) => {
    if (!wallet.accountId) {
      await wallet.connectWallet();
      return;
    }
    const result = await wallet.sendContractTransaction({
      contractId: targetContractId,
      methodName: callName,
      args: extraArgs,
      gasTgas,
      depositYocto,
    });
    if (result.ok && result.txHash) {
      setSessionTxns(prev => [{ hash: result.txHash!, label: actionLabel(c, callName), at: Date.now() }, ...prev]);
      live.refresh();
    }
  };

  const reasonFor = (action: Action) => {
    if (mode === 'live') {
      if (!live.snapshot) return c.initialRead;
      if (!wallet.accountId) return c.readOnlyWarning;

      // Permission checks on-chain
      const snap = live.snapshot;
      if (action.actor === 'owner' && wallet.accountId.toLowerCase() !== snap.owner.toLowerCase()) {
        return `${c.mustConnectRole} (${snap.owner})`;
      }
      if (action.actor === 'heir' && wallet.accountId.toLowerCase() !== snap.heir.toLowerCase()) {
        return `${c.mustConnectRole} (${snap.heir})`;
      }
      if (action.actor === 'rival' && wallet.accountId.toLowerCase() !== snap.rival.toLowerCase()) {
        return `${c.mustConnectRole} (${snap.rival})`;
      }

      // State & timing checks on-chain
      if (action.call === 'check_in') {
        if (snap.state.status === 'Finalized') return c.errorState;
        if (snap.state.deadline_ns && BigInt(snap.observed_at_ns) >= BigInt(snap.state.deadline_ns)) return c.errorDeadline;
      }
      if (action.call === 'initiate_claim') {
        if (snap.state.status !== 'Idle') return c.errorState;
        const hbDeadline = BigInt(snap.last_check_in_ns) + BigInt(snap.heartbeat_interval_ns);
        if (BigInt(snap.observed_at_ns) <= hbDeadline) return c.errorHeartbeat;
      }
      if (action.call === 'challenge_claim') {
        if (snap.state.status !== 'Pending') return c.errorState;
        if (snap.state.deadline_ns && BigInt(snap.observed_at_ns) >= BigInt(snap.state.deadline_ns)) return c.errorDeadline;
      }
      if (action.call === 'finalize_inheritance') {
        if (snap.state.status !== 'Pending' && snap.state.status !== 'Challenged') return c.errorState;
        if (snap.state.deadline_ns && BigInt(snap.observed_at_ns) < BigInt(snap.state.deadline_ns)) return c.errorEarly;
      }
      if (action.call === 'owner_withdraw_near') {
        if (snap.state.status !== 'Idle') return c.errorState;
        if (withdrawAmount <= 0n || withdrawAmount > BigInt(snap.vault_assets)) return c.errorAmount;
      }
      if (action.call === 'withdraw_payout') {
        const actorKey = action.actor as 'owner' | 'heir' | 'rival';
        if (BigInt(snap.credits[actorKey] ?? '0') <= 0n) return c.errorCredit;
        if (BigInt(snap.payouts_in_flight[actorKey] ?? '0') > 0n) return c.errorFlight;
      }
      if (action.call === 'request_eth_release') {
        if (snap.state.status !== 'Finalized') return c.errorState;
        if (snap.signing_in_flight) return c.signing;
      }
      return undefined;
    }
    const reason = available(vault, action, now);
    return reason ? errorLabel(c, reason) : undefined;
  };

  const bond = shown.config.bond;
  const withdrawAmount = parseNear(amount.replace(',', '.')) ?? 0n;
  const call = (name: Call, extra: Partial<Action> = {}): Action => ({ call: name, actor: role, ...extra });
  const date = (value: number | null) => value === null ? '' : new Date(value).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', { timeZoneName: 'short' });
  const snapshotReady = mode === 'local' || Boolean(live.snapshot);

  return <section id="cockpit" ref={cockpitRef} className="section cockpit-section" aria-labelledby="cockpit-heading">
    <div className="section-heading"><h2 id="cockpit-heading">{c.cockpitTitle}</h2><p>{c.cockpitIntro}</p></div>
    <div className="cockpit-shell">
      {/* Top Cockpit Mode Switcher */}
      <div className="cockpit-toolbar">
        <div className="segmented mode-segmented" role="group" aria-label={c.cockpit}>
          <button type="button" aria-pressed={mode === 'local'} onClick={() => setMode('local')}>
            {c.modeSimulation}
          </button>
          <button type="button" aria-pressed={mode === 'live'} onClick={() => setMode('live')}>
            <Globe size={16} aria-hidden="true" style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '5px' }} />
            {c.modeTestnet}
          </button>
        </div>
        <span className="mode-badge">
          {mode === 'local' ? (
            <>
              <LockSimple size={16} aria-hidden="true" />
              {c.simulated}
            </>
          ) : (
            <>
              <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--owner)' }} />
              NEAR Testnet · Chain ID: <strong>testnet</strong>
            </>
          )}
        </span>
      </div>

      {/* Mode Sub-toolbars */}
      {mode === 'local' ? (
        <div className="role-toolbar">
          <fieldset>
            <legend>{c.role}</legend>
            <div className="role-choices">
              {roles.map(actor => (
                <button
                  key={actor}
                  type="button"
                  aria-pressed={role === actor}
                  className={`role-choice role-${actor}`}
                  onClick={() => setRole(actor)}
                >
                  {c[actor]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{c.time}</legend>
            <div className="time-choices">
              <button type="button" onClick={() => advance()}>
                <Clock size={16} aria-hidden="true" />
                {c.advance}
              </button>
              <button type="button" onClick={() => advance(true)} disabled={vault.status === 'Finalized'}>
                {c.deadlineButton}
              </button>
              <button type="button" onClick={reset}>
                <ArrowsClockwise size={16} aria-hidden="true" />
                {c.reset}
              </button>
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="live-controls">
          {/* Vault Selector & RPC status */}
          <div className="vault-selector-bar">
            <div className="vault-selector-left">
              <label htmlFor="vault-dropdown" className="caption">
                <strong>{c.selectVault}:</strong>
              </label>
              <select
                id="vault-dropdown"
                value={isCustomMode ? 'custom' : targetContractId}
                onChange={e => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsCustomMode(true);
                  } else {
                    setIsCustomMode(false);
                    setTargetContractId(val);
                  }
                }}
                className="vault-select"
              >
                {PRESET_VAULTS.map(pv => (
                  <option key={pv.id} value={pv.id}>
                    {locale === 'id' ? pv.labelId : pv.labelEn}
                  </option>
                ))}
                {customVaults.map(cv => (
                  <option key={cv} value={cv}>
                    ⭐ {cv}
                  </option>
                ))}
                <option value="custom">✏️ {c.customVault}</option>
              </select>

              {isCustomMode && (
                <div className="custom-vault-form">
                  <input
                    type="text"
                    placeholder={c.enterContractId}
                    value={customVaultInput}
                    onChange={e => setCustomVaultInput(e.target.value)}
                    className="custom-vault-input mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (isValidTestnetAccount(customVaultInput)) {
                        const trimmed = customVaultInput.trim();
                        setTargetContractId(trimmed);
                        setCustomVaults(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
                      }
                    }}
                    disabled={!isValidTestnetAccount(customVaultInput)}
                    className="button-secondary"
                  >
                    {c.applyCustomVault}
                  </button>
                </div>
              )}
            </div>

            <div className="vault-selector-right">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsCreateModalOpen(true)}
                title={locale === 'id' ? 'Buat Vault Baru di NEAR Testnet' : 'Create New Vault on NEAR Testnet'}
              >
                <Plus size={15} aria-hidden="true" />
                {c.createVaultBtn}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={live.refresh}
                disabled={live.loading || !targetContractId}
              >
                <ArrowsClockwise size={15} aria-hidden="true" className={live.loading ? 'spin' : ''} />
                {live.loading ? c.refreshing : c.refresh}
              </button>
            </div>
          </div>

          {/* NEAR Testnet Wallet Connection Bar */}
          <div className="wallet-toolbar">
            {!wallet.accountId ? (
              <div className="wallet-connect-card">
                <div className="wallet-connect-info">
                  <Wallet size={24} aria-hidden="true" style={{ color: 'var(--owner)' }} />
                  <div>
                    <strong>{c.connectWallet}</strong>
                    <p className="caption">{c.readOnlyWarning}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={wallet.connectWallet}
                  disabled={wallet.isConnecting}
                  className="actor-button button-owner"
                >
                  {wallet.isConnecting ? (
                    <>
                      <SpinnerGap size={16} className="spin" /> {c.connectingWallet}
                    </>
                  ) : (
                    <>
                      <Wallet size={16} /> {c.connectWallet}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="wallet-connected-bar">
                <div className="wallet-account-details">
                  <span className="online-indicator" aria-label="Connected" />
                  <span className="caption">{c.connectedAs}:</span>
                  <code className="mono wallet-account-badge">{wallet.accountId}</code>
                  {wallet.walletName && <span className="wallet-name-pill">{wallet.walletName}</span>}
                  {wallet.balanceYocto !== null && (
                    <span className="wallet-balance-pill mono">
                      {formatNear(wallet.balanceYocto)} NEAR
                    </span>
                  )}
                  {connectedRole && (
                    <span className={`role-tag role-tag-${connectedRole}`}>
                      {connectedRole === 'observer' ? c.liveRoleObserver : `${c[connectedRole]} (${c.liveRoleMatch})`}
                    </span>
                  )}
                </div>
                <button type="button" onClick={wallet.disconnectWallet} className="button-secondary disconnect-btn">
                  {c.disconnectWallet}
                </button>
              </div>
            )}

            {/* Notification & Transaction Status */}
            {wallet.isSending && (
              <div className="tx-status-banner sending" role="status">
                <SpinnerGap size={18} className="spin" aria-hidden="true" />
                <span>{c.sendingTx}</span>
              </div>
            )}
            {wallet.txHash && (
              <div className="tx-status-banner success" role="status">
                <CheckCircle size={20} aria-hidden="true" style={{ color: '#00853D' }} />
                <span>
                  <strong>{c.liveTxSuccess}:</strong>{' '}
                  <a
                    href={`https://testnet.nearblocks.io/txns/${wallet.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono break-anywhere"
                  >
                    {wallet.txHash} <ArrowSquareOut size={14} aria-hidden="true" />
                  </a>
                </span>
                <button type="button" onClick={wallet.clearTxStatus} aria-label="Dismiss">
                  &times;
                </button>
              </div>
            )}
            {wallet.txError && (
              <div className="tx-status-banner error" role="alert">
                <WarningCircle size={20} aria-hidden="true" style={{ color: 'var(--rival)' }} />
                <span>
                  <strong>{c.liveTxFailed}:</strong> {wallet.txError}
                </span>
                <button type="button" onClick={wallet.clearTxStatus} aria-label="Dismiss">
                  &times;
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live status contract metadata header */}
      {mode === 'live' && (
        <div className="live-status">
          {!targetContractId ? (
            <>
              <h3>{c.configure}</h3>
              <p>{c.configureHelp}</p>
            </>
          ) : (
            <>
              <p>
                {c.contract}: <code className="break-anywhere">{targetContractId}</code>
              </p>
              {live.error && (
                <p role="alert">
                  <WarningCircle aria-hidden="true" size={18} /> {c.rpcError} {live.snapshot ? c.stale : ''}
                </p>
              )}
              {!live.snapshot && !live.error && <p role="status">{c.initialRead}</p>}
              {live.receivedAt && (
                <p className="caption">
                  {c.snapshot}:{' '}
                  <time dateTime={new Date(live.receivedAt).toISOString()}>{date(live.receivedAt)}</time>
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Timer Bar */}
      {snapshotReady && (() => {
        const start = isActive && shown.claimedAt !== undefined ? shown.claimedAt : shown.lastCheckIn;
        const span = timerDeadline > start ? timerDeadline - start : 1n;
        const elapsed = shownNow > start ? shownNow - start : 0n;
        const pct = Math.min(100, Number((elapsed * 1000n) / span) / 10);
        const chip = shown.status === 'Finalized' ? c.final : ready ? c.expired : !isActive && heartbeatMissed ? c.eligible : isActive ? c.deadline : c.heartbeat;
        return <div className="timer-strip" role="status">
          <div className="timer-meta">
            <span className="caption">{c.timerStart}</span>
            <strong className="mono timer-big">{shown.status === 'Finalized' ? '00:00:00' : countdown(timerDeadline, shownNow)}</strong>
            <span className="timer-chip">{chip}</span>
          </div>
          <div className="timer-track" aria-hidden="true">
            <span className="timer-fill" style={{ width: pct + '%' }} />
            <span className="timer-tick" style={{ left: '0%' }} />
            <span className="timer-tick" style={{ left: '50%' }} />
            <span className="timer-tick end" style={{ left: '100%' }} />
          </div>
          <div className="timer-ends">
            <span className="caption">{c.timerStart}</span>
            <span className="caption">{c.timerEnd}</span>
          </div>
          <p className="caption timer-mode">{mode === 'local' ? c.noKeys : c.readonly}</p>
        </div>;
      })()}

      {/* Main Cockpit Split: Left 3D View, Right Data & Actions */}
      <div className="cockpit-main">
        <div className="cockpit-visual">
          <div className="cockpit-visual-sticky">
            <div id="cockpit-scene" className="scene-anchor" role="img" aria-label={c.scene} />
            {snapshotReady && <div className="cockpit-now">
              <span className="caption">{c.state}</span>
              <strong className={shown.status === 'Finalized' ? 'actor-heir' : 'actor-owner'}>{statusLabel(c, shown.status)}</strong>
              <span className="caption">{c.lastOutcome}: {outcomeLabel(c, shown.outcome)}</span>
              <span className="caption">{c.watchingAs}: <span className={`actor-${role}`}>{c[role]}</span></span>
            </div>}
            <div className="cockpit-help">
              <span className="drag-hint">{c.dragHint}</span>
              <button type="button" className="button-secondary" onClick={() => resetSceneRotation()}>{c.resetView}</button>
            </div>
            <div className="actor-legend" aria-label={c.watchingAs}>
              {roles.map(actor => (
                <span className={`actor-${actor}`} key={actor}>
                  <i aria-hidden="true" />
                  {c[actor]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="cockpit-data" aria-busy={mode === 'live' && live.loading}>
          {snapshotReady ? <>
            <div className="state-row">
              <div>
                <span className="caption">{c.state}</span>
                <h3 className="state-value">{statusLabel(c, shown.status)}</h3>
              </div>
              <div className={`outcome-stamp outcome-${shown.outcome}`} key={`${shown.outcome}-${mode}`}>
                <span className="caption">{c.lastOutcome}</span>
                <strong>{outcomeLabel(c, shown.outcome)}</strong>
                {shown.outcome !== 'None' && <span>{outcomePayout(c, shown.outcome)}</span>}
              </div>
            </div>

            <dl className="balances">
              <div>
                <dt>{c.heirBond}</dt>
                <dd className="mono actor-heir">
                  <Amount value={shown.lockedHeir} animate={mode === 'local'} /> <small>NEAR</small>
                </dd>
              </div>
              <div>
                <dt>{c.rivalBond}</dt>
                <dd className="mono actor-rival">
                  <Amount value={shown.lockedRival} animate={mode === 'local'} /> <small>NEAR</small>
                </dd>
              </div>
              <div>
                <dt>{c.vault}</dt>
                <dd className="mono">
                  <Amount value={shown.assets} animate={mode === 'local'} /> <small>NEAR</small>
                </dd>
              </div>
            </dl>
            <p className="caption">{c.required}: <span className="mono">{formatNear(shown.config.bond)} NEAR</span>. H = R = B.</p>
            <ExpectedValue c={c} bond={shown.config.bond} />

            {/* Actions Panel (Local Simulation Mode) */}
            {mode === 'local' && (
              <section className="actions-panel" aria-labelledby="actions-heading">
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
              </section>
            )}

            {/* Actions Panel (Live NEAR Testnet On-Chain Mode) */}
            {mode === 'live' && (
              <section className="actions-panel live-actions-panel" aria-labelledby="live-actions-heading">
                <div className="live-actions-header">
                  <h3 id="live-actions-heading">
                    {c.actions} (NEAR Testnet): <span className={`actor-${role}`}>{c[role]}</span>
                  </h3>
                  {connectedRole && (
                    <span className="caption">
                      {c.connectedAs}: <strong className={`actor-${connectedRole}`}>{c[connectedRole as Role] ?? connectedRole}</strong>
                    </span>
                  )}
                </div>

                {/* Archival Case Notice if Finalized */}
                {shown.status === 'Finalized' && (
                  <div className="case-archive-banner">
                    <div className="case-archive-header">
                      <span className="case-archive-pill mono">{c.archivedCase}</span>
                      <strong>{shown.outcome !== 'None' ? outcomeLabel(c, shown.outcome) : 'Finalized'}</strong>
                    </div>
                    <p className="caption">{c.archivedDesc}</p>
                  </div>
                )}

                {/* Observer Guidance Notice if Connected Wallet is Observer */}
                {connectedRole === 'observer' && (
                  <div className="observer-guidance-card">
                    <div className="observer-header">
                      <span className="role-tag role-tag-observer">{c.liveRoleObserver}</span>
                      <code className="mono">{wallet.accountId}</code>
                    </div>
                    <p className="caption">{c.observerGuidance}</p>
                  </div>
                )}

                <div className="action-list">
                  {/* Owner Check-in */}
                  {role === 'owner' && (
                    <ActionButton
                      label={c.checkIn}
                      actor="owner"
                      tip={`check_in(): ${c.checkTip}`}
                      reason={reasonFor(call('check_in'))}
                      onClick={() => sendLiveAction('check_in', {}, 0n, 30)}
                    />
                  )}

                  {/* Heir Initiate Claim */}
                  {role === 'heir' && shown.status === 'Idle' && (
                    <ActionButton
                      label={`${c.initiate} (1 NEAR)`}
                      actor="heir"
                      tip={`initiate_claim(): ${c.initiateTip} (${c.depositBond})`}
                      reason={reasonFor(call('initiate_claim', { deposit: bond }))}
                      onClick={() => sendLiveAction('initiate_claim', {}, BigInt(live.snapshot?.required_bond ?? '1000000000000000000000000'), 30)}
                    />
                  )}

                  {/* Rival Challenge Claim */}
                  {role === 'rival' && shown.status === 'Pending' && (
                    <ActionButton
                      label={`${c.challenge} (1 NEAR)`}
                      actor="rival"
                      tip={`challenge_claim(): ${c.challengeTip} (${c.depositBond})`}
                      reason={reasonFor(call('challenge_claim', { deposit: bond }))}
                      onClick={() => sendLiveAction('challenge_claim', {}, BigInt(live.snapshot?.required_bond ?? '1000000000000000000000000'), 30)}
                    />
                  )}

                  {/* Anyone Finalize Claim */}
                  <ActionButton
                    label={c.finalize}
                    tip={`finalize_inheritance(): ${c.finalizeTip}`}
                    reason={reasonFor(call('finalize_inheritance'))}
                    onClick={() => sendLiveAction('finalize_inheritance', {}, 0n, 30)}
                  />

                  {/* Heir Request ETH Release via Chain Signatures */}
                  {role === 'heir' && shown.status === 'Finalized' && (
                    <ActionButton
                      label={`${c.release} (0.05 NEAR)`}
                      actor="heir"
                      tip={`request_eth_release(): ${c.releaseNote} (${c.depositMpc})`}
                      reason={reasonFor(call('request_eth_release'))}
                      onClick={() =>
                        sendLiveAction(
                          'request_eth_release',
                          {
                            nonce: '0',
                            value_wei: '10000000000000000',
                            max_fee_per_gas: '30000000000',
                            max_priority_fee_per_gas: '2000000000',
                            gas_limit: '21000',
                          },
                          50000000000000000000000n, // 0.05 NEAR attached MPC deposit
                          300, // 300 Tgas for MPC signing + callback
                        )
                      }
                    />
                  )}
                </div>

                {/* Owner Withdraw NEAR Assets */}
                {role === 'owner' && shown.status === 'Idle' && (
                  <div className="withdraw-row">
                    <label htmlFor="withdraw-amount-live">
                      {c.amount}
                      <input
                        id="withdraw-amount-live"
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        aria-invalid={withdrawAmount <= 0n || withdrawAmount > shown.assets}
                      />
                    </label>
                    <ActionButton
                      label={c.withdraw}
                      actor="owner"
                      tip={`owner_withdraw_near(amount): ${c.withdrawTip}`}
                      reason={reasonFor(call('owner_withdraw_near', { amount: withdrawAmount }))}
                      onClick={() =>
                        sendLiveAction('owner_withdraw_near', { amount: withdrawAmount.toString() }, 0n, 30)
                      }
                    />
                  </div>
                )}

                {shown.status === 'Finalized' && <p className="caption">{c.releaseNote}</p>}
              </section>
            )}

            {/* Credits Panel */}
            <section className="credits-panel" aria-labelledby="credits-heading">
              <h3 id="credits-heading">{c.credits}</h3>
              <div className="credit-table-wrap" tabIndex={0} role="region" aria-label={c.credits}>
                <table className="credit-table">
                  <thead>
                    <tr>
                      <th scope="col">{c.role}</th>
                      <th scope="col">{c.credits}</th>
                      <th scope="col">{c.inFlight}</th>
                      {mode === 'local' && <th scope="col">{c.withdrawn}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(actor => (
                      <tr key={actor}>
                        <th scope="row" className={`actor-${actor}`}>
                          {c[actor]}
                        </th>
                        <td className="mono">{formatNear(shown.credits[actor])}</td>
                        <td className="mono">{formatNear(shown.inFlight[actor])}</td>
                        {mode === 'local' && <td className="mono">{formatNear(shown.withdrawn[actor])}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="caption">NEAR. {c.payoutNote}</p>

              {/* Local Payout simulation buttons */}
              {mode === 'local' && (
                <div className="action-list">
                  <ActionButton
                    label={c.payout}
                    actor={role}
                    tip={`withdraw_payout(): ${c.payoutTip}`}
                    reason={reasonFor(call('withdraw_payout'))}
                    onClick={() => perform(call('withdraw_payout'))}
                  />
                  {vault.inFlight[role] > 0n && (
                    <>
                      <button type="button" onClick={() => perform(call('resolve_payout', { success: true }))}>
                        {c.succeed}
                      </button>
                      <button type="button" onClick={() => perform(call('resolve_payout', { success: false }))}>
                        {c.fail}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Live On-chain Payout button */}
              {mode === 'live' && (
                <div className="action-list">
                  <ActionButton
                    label={c.payout}
                    actor={role}
                    tip={`withdraw_payout(): ${c.payoutTip}`}
                    reason={reasonFor(call('withdraw_payout'))}
                    onClick={() => sendLiveAction('withdraw_payout', {}, 0n, 50)}
                  />
                </div>
              )}
            </section>

            {/* Live Snapshot On-Chain Details */}
            {mode === 'live' && live.snapshot && (
              <div className="snapshot-details">
                <dl>
                  {roles.map(actor => (
                    <div key={actor}>
                      <dt>{c[actor]}</dt>
                      <dd className="mono break-anywhere">{live.snapshot![actor]}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>{c.heirAddress}</dt>
                    <dd className="mono break-anywhere">{ethAddress(live.snapshot.heir_eth_address)}</dd>
                  </div>
                  <div>
                    <dt>{c.observed}</dt>
                    <dd className="mono">{live.snapshot.observed_at_ns} ns</dd>
                  </div>
                </dl>
                <h3>{c.ethRelease}</h3>
                <p>
                  {live.snapshot.signing_in_flight
                    ? c.signing
                    : live.snapshot.eth_release === null
                    ? c.notRequested
                    : live.snapshot.eth_release.signature != null
                    ? c.signatureStored
                    : c.awaitingSignature}
                </p>
                <p className="caption">{c.releaseNote}</p>
              </div>
            )}
          </> : (
            <p className="empty-readout">{targetContractId ? c.initialRead : c.configure}</p>
          )}
        </div>
      </div>

      {/* Event / Proof Panel */}
      <div className="event-panel">
        {mode === 'local' ? (
          <>
            <h3>{c.log}</h3>
            {log.length === 0 ? (
              <p className="caption">{c.logEmpty}</p>
            ) : (
              <ol className="event-log" aria-label={c.log}>
                {log.map(entry => (
                  <li key={entry.id}>
                    <span className="mono log-time">{countdown(entry.at, 0n)}</span>
                    <span>
                      {entry.kind === 'reset' ? (
                        c.resetLog
                      ) : entry.kind === 'time' ? (
                        c.timeLog
                      ) : (
                        <>
                          <span className={`actor-${entry.actor}`}>{entry.actor ? c[entry.actor] : ''}</span>:{' '}
                          {entry.call ? actionLabel(c, entry.call) : ''}.{' '}
                          {entry.error
                            ? `${c.rejected}: ${errorLabel(c, entry.error)}`
                            : entry.call === 'resolve_payout'
                            ? entry.success
                              ? c.succeed
                              : c.fail
                            : c.completed}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <EvidencePanel
            c={c}
            locale={locale}
            proofs={live.proofs}
            proofError={live.proofError}
            sessionTxns={sessionTxns}
          />
        )}
      </div>
    </div>

    <CreateVaultModal
      isOpen={isCreateModalOpen}
      onClose={() => setIsCreateModalOpen(false)}
      c={c}
      locale={locale}
      connectedAccountId={wallet.accountId}
      onConnectWallet={wallet.connectWallet}
      onVaultCreated={newVaultId => {
        setCustomVaults(prev => (prev.includes(newVaultId) ? prev : [...prev, newVaultId]));
        setIsCustomMode(false);
        setTargetContractId(newVaultId);
      }}
    />
  </section>;
}
