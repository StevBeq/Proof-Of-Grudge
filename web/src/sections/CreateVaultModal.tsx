import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle,
  Copy as CopyIcon,
  WarningCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  TerminalWindow,
  Wallet,
} from '@phosphor-icons/react';
import type { Copy, Locale } from '../lib/copy';
import { isValidTestnetAccount } from '../lib/nearClient';
import { parseNear } from '../lib/vaultSimulator';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  c: Copy;
  locale: Locale;
  connectedAccountId: string | null;
  onConnectWallet?: () => void;
  onVaultCreated: (contractId: string) => void;
}

export function CreateVaultModal({
  isOpen,
  onClose,
  c,
  locale,
  connectedAccountId,
  onConnectWallet,
  onVaultCreated,
}: Props) {
  const [heir, setHeir] = useState('heir-vault.testnet');
  const [rival, setRival] = useState('rival-vault.testnet');
  const [ethAddress, setEthAddress] = useState('0x71C679307524028914040776b2B54E62F764098F');
  const [heartbeatPreset, setHeartbeatPreset] = useState<'demo' | '1h' | '24h' | '7d'>('demo');
  const [requiredBond, setRequiredBond] = useState('1');
  const [initialDeposit, setInitialDeposit] = useState('5');
  const [customVaultId, setCustomVaultId] = useState('');
  const [copied, setCopied] = useState(false);
  const [registeredSuccess, setRegisteredSuccess] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [showCli, setShowCli] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Lock background window scroll while modal is open, without stopping Lenis globally
  useEffect(() => {
    if (!isOpen) {
      setStep('form');
      setRegisteredSuccess(false);
      setShowCli(false);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Reset scroll to top of modal body on open
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const owner = connectedAccountId || '';
  const isValidOwner = Boolean(connectedAccountId) && isValidTestnetAccount(owner.trim());
  const isValidEth = /^0x[0-9a-fA-F]{40}$/.test(ethAddress.trim());
  const isValidHeir = isValidTestnetAccount(heir.trim());
  const isValidRival = isValidTestnetAccount(rival.trim());

  const actorsDistinct =
    isValidOwner &&
    owner.trim().toLowerCase() !== heir.trim().toLowerCase() &&
    owner.trim().toLowerCase() !== rival.trim().toLowerCase() &&
    heir.trim().toLowerCase() !== rival.trim().toLowerCase();

  const isFormValid = isValidOwner && isValidHeir && isValidRival && actorsDistinct && isValidEth;

  const heartbeatNsMap = {
    demo: '120000000000', // 120s
    '1h': '3600000000000', // 1h
    '24h': '86400000000000', // 24h
    '7d': '604800000000000', // 7d
  };
  const graceNs = heartbeatPreset === 'demo' ? '60000000000' : '43200000000000'; // 60s or 12h
  const challengeExtNs = graceNs;

  const heartbeatLabel = {
    demo: c.heartbeatDemo,
    '1h': c.heartbeat1h,
    '24h': c.heartbeat24h,
    '7d': c.heartbeat7d,
  }[heartbeatPreset];

  const bondYocto = (() => {
    try {
      const parsed = parseNear(requiredBond);
      return parsed ? parsed.toString() : '1000000000000000000000000';
    } catch {
      return '1000000000000000000000000';
    }
  })();

  const ethBytes = (() => {
    try {
      const clean = ethAddress.trim().replace(/^0x/, '');
      const bytes: number[] = [];
      for (let i = 0; i < 40; i += 2) {
        bytes.push(parseInt(clean.slice(i, i + 2), 16));
      }
      return bytes.length === 20 ? JSON.stringify(bytes) : '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]';
    } catch {
      return '[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]';
    }
  })();

  const targetVaultContract = customVaultId.trim() || `pog-${Date.now().toString(36)}-vault.testnet`;

  // CLI Init Command ready to copy if needed
  const initCliCommand = `near contract call-function as-transaction ${targetVaultContract} init json-args '{"owner":"${owner.trim()}","heir":"${heir.trim()}","rival":"${rival.trim()}","heir_eth_address":${ethBytes},"heartbeat_interval_ns":"${heartbeatNsMap[heartbeatPreset]}","grace_period_ns":"${graceNs}","challenge_extension_ns":"${challengeExtNs}","required_bond":"${bondYocto}"}' prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' sign-as ${owner.trim()} network-config testnet`;

  const handleCopyCli = async () => {
    try {
      await navigator.clipboard.writeText(initCliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleConfirmAndRegister = () => {
    if (!isFormValid) return;
    const finalId = targetVaultContract;
    try {
      const existing = JSON.parse(localStorage.getItem('pog-custom-vaults') || '[]');
      if (!existing.includes(finalId)) {
        existing.push(finalId);
        localStorage.setItem('pog-custom-vaults', JSON.stringify(existing));
      }
    } catch {
      // storage unavailable
    }
    setRegisteredSuccess(true);
    setTimeout(() => {
      onVaultCreated(finalId);
      onClose();
    }, 700);
  };

  const modalContent = (
    <div
      className="modal-backdrop"
      data-lenis-prevent="true"
      onClick={onClose}
      onWheel={e => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="create-vault-modal"
        data-lenis-prevent="true"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="mono modal-kicker">
              {step === 'form' ? 'STEP 01 OF 02 // CONFIGURATION' : 'STEP 02 OF 02 // FINAL CONFIRMATION'}
            </span>
            <h3 id="modal-title">{step === 'form' ? c.createVault : c.confirmVaultTitle}</h3>
            <p className="caption">{step === 'form' ? c.createVaultDesc : c.confirmVaultQuestion}</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label={c.close}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Body (Scrollable container with data-lenis-prevent) */}
        <div
          className="modal-body"
          data-lenis-prevent="true"
          ref={modalBodyRef}
          onWheel={e => e.stopPropagation()}
        >
          {/* Step 1: Wallet Connection Required Check */}
          {!connectedAccountId ? (
            <div className="wallet-required-card">
              <div className="wallet-required-header">
                <div className="wallet-icon-badge">
                  <Wallet size={30} aria-hidden="true" />
                </div>
                <div>
                  <h4>{locale === 'id' ? 'Hubungkan Dompet Terlebih Dahulu' : 'Connect Wallet Required'}</h4>
                  <p className="caption">
                    {locale === 'id'
                      ? 'Untuk membuat brankas di NEAR Testnet, Anda wajib menghubungkan dompet terlebih dahulu. Akun dompet Anda akan ditetapkan secara otomatis dan permanen sebagai Pemilik (Owner) brankas.'
                      : 'To create a vault on NEAR Testnet, you must connect a wallet first. Your connected wallet account will be automatically and permanently assigned as the vault Owner.'}
                  </p>
                </div>
              </div>
              <div className="wallet-required-actions">
                <button
                  type="button"
                  className="actor-button button-owner"
                  onClick={() => {
                    onConnectWallet?.();
                  }}
                >
                  <Wallet size={16} />
                  <span>{c.connectWallet}</span>
                </button>
              </div>
            </div>
          ) : step === 'form' ? (
            <>
              {/* Section 1: Three Distinct Actors */}
              <div className="form-card">
                <div className="form-card-header">
                  <span className="mono section-number">01</span>
                  <div>
                    <h4 className="mono section-title">THREE DISTINCT ACTORS</h4>
                    <p className="caption section-hint">
                      {locale === 'id'
                        ? 'Aturan kompetisi NEAR: Owner, Heir, dan Rival wajib merupakan 3 akun berbeda.'
                        : 'NEAR Hackathon rule: Owner, Heir, and Rival must be 3 distinct accounts.'}
                    </p>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label className="caption">
                      <span className="actor-dot dot-owner" />
                      <strong>{c.vaultOwner}</strong>
                      <span className="connected-pill">✓ CONNECTED</span>
                    </label>
                    <input
                      type="text"
                      value={owner}
                      readOnly
                      disabled
                      className="form-input mono input-locked"
                    />
                  </div>

                  <div className="form-field">
                    <label className="caption">
                      <span className="actor-dot dot-heir" />
                      <strong>{c.vaultHeir}</strong>
                    </label>
                    <input
                      type="text"
                      value={heir}
                      onChange={e => setHeir(e.target.value)}
                      className={`form-input mono ${!isValidHeir ? 'input-error' : ''}`}
                      placeholder="heir.testnet"
                    />
                    {!isValidHeir && <span className="error-text caption">{c.errorNearAccount}</span>}
                  </div>

                  <div className="form-field">
                    <label className="caption">
                      <span className="actor-dot dot-rival" />
                      <strong>{c.vaultRival}</strong>
                    </label>
                    <input
                      type="text"
                      value={rival}
                      onChange={e => setRival(e.target.value)}
                      className={`form-input mono ${!isValidRival ? 'input-error' : ''}`}
                      placeholder="rival.testnet"
                    />
                    {!isValidRival && <span className="error-text caption">{c.errorNearAccount}</span>}
                  </div>
                </div>

                {!actorsDistinct && (
                  <div className="actor-warning-box">
                    <WarningCircle size={18} aria-hidden="true" />
                    <span>{c.errorActorsDistinct}</span>
                  </div>
                )}
              </div>

              {/* Section 2: Ethereum Sepolia Recipient */}
              <div className="form-card">
                <div className="form-card-header">
                  <span className="mono section-number">02</span>
                  <div>
                    <h4 className="mono section-title">ETHEREUM SEPOLIA RECIPIENT</h4>
                    <p className="caption section-hint">
                      {locale === 'id'
                        ? 'Alamat dompet Sepolia penerima ETH via Chain Signatures MPC.'
                        : 'Sepolia wallet address receiving released ETH via MPC Chain Signatures.'}
                    </p>
                  </div>
                </div>

                <div className="form-field">
                  <label className="caption">
                    <strong>{c.vaultEthRecipient}</strong>
                  </label>
                  <input
                    type="text"
                    value={ethAddress}
                    onChange={e => setEthAddress(e.target.value)}
                    className={`form-input mono ${!isValidEth ? 'input-error' : ''}`}
                    placeholder="0x..."
                  />
                  {!isValidEth && <span className="error-text caption">{c.errorEthAddress}</span>}
                </div>
              </div>

              {/* Section 3: Timeouts & Bonds */}
              <div className="form-card">
                <div className="form-card-header">
                  <span className="mono section-number">03</span>
                  <div>
                    <h4 className="mono section-title">HEARTBEAT & SYMMETRIC BOND</h4>
                    <p className="caption section-hint">
                      {locale === 'id'
                        ? 'Tenggat waktu lapor aktif dan ukuran jaminan simetris B.'
                        : 'Owner check-in cadence and symmetric bond size B.'}
                    </p>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-field">
                    <label className="caption">
                      <strong>{c.heartbeatInterval}</strong>
                    </label>
                    <select
                      value={heartbeatPreset}
                      onChange={e => setHeartbeatPreset(e.target.value as any)}
                      className="form-select"
                    >
                      <option value="demo">{c.heartbeatDemo}</option>
                      <option value="1h">{c.heartbeat1h}</option>
                      <option value="24h">{c.heartbeat24h}</option>
                      <option value="7d">{c.heartbeat7d}</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="caption">
                      <strong>{c.requiredBondLabel}</strong>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={requiredBond}
                      onChange={e => setRequiredBond(e.target.value)}
                      className="form-input mono"
                    />
                  </div>

                  <div className="form-field">
                    <label className="caption">
                      <strong>{c.initialDepositLabel}</strong>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={initialDeposit}
                      onChange={e => setInitialDeposit(e.target.value)}
                      className="form-input mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Vault Contract Account ID */}
              <div className="form-card">
                <div className="form-card-header">
                  <span className="mono section-number">04</span>
                  <div>
                    <h4 className="mono section-title">VAULT CONTRACT ACCOUNT ID</h4>
                  </div>
                </div>

                <div className="form-field">
                  <input
                    type="text"
                    value={customVaultId}
                    onChange={e => setCustomVaultId(e.target.value)}
                    placeholder={targetVaultContract}
                    className="form-input mono"
                  />
                </div>
              </div>

              {/* Optional Subtle CLI Accordion Toggle */}
              <div className="cli-toggle-wrap">
                <button
                  type="button"
                  className="cli-toggle-btn"
                  onClick={() => setShowCli(prev => !prev)}
                >
                  <TerminalWindow size={15} />
                  <span>
                    {showCli
                      ? locale === 'id'
                        ? '▲ Sembunyikan Perintah CLI'
                        : '▲ Hide CLI Command'
                      : locale === 'id'
                      ? '▼ Lihat Perintah CLI Resmi (Opsional)'
                      : '▼ View Official CLI Command (Optional)'}
                  </span>
                </button>

                {showCli && (
                  <div className="cli-snippet-box">
                    <div className="cli-snippet-header">
                      <span className="mono caption">NEAR CLI COMMAND</span>
                      <button type="button" className="copy-cli-btn" onClick={handleCopyCli}>
                        {copied ? <CheckCircle size={14} color="#00853D" /> : <CopyIcon size={14} />}
                        <span>{copied ? c.cliCommandCopied : c.copyCliCommand}</span>
                      </button>
                    </div>
                    <pre className="cli-code mono">{initCliCommand}</pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Confirmation & Review Screen */
            <div className="confirm-view">
              <div className="confirm-warning-banner">
                <WarningCircle size={22} className="warning-icon" />
                <div>
                  <strong>{locale === 'id' ? 'Peringatan Konfigurasi Permanen' : 'Immutable Configuration Warning'}</strong>
                  <p className="caption">{c.confirmVaultWarning}</p>
                </div>
              </div>

              <div className="review-table">
                <div className="review-row">
                  <span className="review-label">{c.confirmOwnerLabel}</span>
                  <span className="review-value mono">
                    <span className="actor-tag actor-tag-owner">OWNER</span>
                    {owner}
                  </span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmHeirLabel}</span>
                  <span className="review-value mono">
                    <span className="actor-tag actor-tag-heir">HEIR</span>
                    {heir}
                  </span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmRivalLabel}</span>
                  <span className="review-value mono">
                    <span className="actor-tag actor-tag-rival">RIVAL</span>
                    {rival}
                  </span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmEthLabel}</span>
                  <span className="review-value mono break-anywhere">{ethAddress}</span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmHeartbeatLabel}</span>
                  <span className="review-value">{heartbeatLabel}</span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmBondLabel}</span>
                  <span className="review-value mono">{requiredBond} NEAR</span>
                </div>

                <div className="review-row">
                  <span className="review-label">{c.confirmDepositLabel}</span>
                  <span className="review-value mono">{initialDeposit} NEAR</span>
                </div>

                <div className="review-row highlight-row">
                  <span className="review-label">{c.confirmVaultIdLabel}</span>
                  <span className="review-value mono highlight-text">{targetVaultContract}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {!connectedAccountId ? (
            <>
              <button type="button" className="button-secondary" onClick={onClose}>
                {c.close}
              </button>
              <button
                type="button"
                className="actor-button button-owner"
                onClick={() => onConnectWallet?.()}
              >
                <Wallet size={16} />
                <span>{c.connectWallet}</span>
              </button>
            </>
          ) : step === 'form' ? (
            <>
              <button type="button" className="button-secondary" onClick={onClose}>
                {c.close}
              </button>
              <button
                type="button"
                className="actor-button button-owner"
                disabled={!isFormValid}
                onClick={() => {
                  setStep('confirm');
                  if (modalBodyRef.current) modalBodyRef.current.scrollTop = 0;
                }}
              >
                <span>{locale === 'id' ? 'Lanjut ke Konfirmasi' : 'Continue to Confirmation'}</span>
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setStep('form')}
                disabled={registeredSuccess}
              >
                <ArrowLeft size={16} />
                <span>{c.btnBackEdit}</span>
              </button>
              <button
                type="button"
                className="actor-button button-owner"
                onClick={handleConfirmAndRegister}
                disabled={registeredSuccess}
              >
                {registeredSuccess ? (
                  <>
                    <CheckCircle size={16} /> {c.deploySuccess}
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} /> {c.btnConfirmRegister}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
