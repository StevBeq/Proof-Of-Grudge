import { useState } from 'react';
import { ArrowSquareOut, Clock } from '@phosphor-icons/react';
import type { Copy, Locale } from '../lib/copy';
import type { Proof } from '../lib/nearClient';

interface Props {
  c: Copy;
  locale: Locale;
  proofs: Proof[];
  proofError?: boolean;
  sessionTxns: Array<{ hash: string; label: string; at: number }>;
}

export function EvidencePanel({ c, locale, proofs, proofError, sessionTxns }: Props) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'near-testnet' | 'sepolia'>('all');
  const pageSize = 5;

  const filtered = proofs.filter(p => (filter === 'all' ? true : p.network === filter));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const currentProofs = filtered.slice(startIndex, startIndex + pageSize);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleString(locale === 'id' ? 'id-ID' : 'en-GB', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="evidence-panel">
      <div className="evidence-header">
        <h3>{c.proofs}</h3>
        <p className="caption">{c.proofHelp}</p>
      </div>

      {/* Live Session Transactions from connected wallet */}
      {sessionTxns.length > 0 && (
        <div className="session-proofs">
          <div className="session-proofs-title">
            <span className="live-pulse" />
            <strong>{c.sessionHistory}</strong>
            <span className="caption">({sessionTxns.length})</span>
          </div>
          <ul className="proof-list session-list">
            {sessionTxns.map(tx => (
              <li key={tx.hash} className="proof-item live-item">
                <div className="proof-cell-id">
                  <span className="live-pulse" />
                </div>
                <div className="proof-cell-action">
                  <strong className="proof-action-name">{tx.label}</strong>
                  <span className="network-pill network-near-testnet">NEAR</span>
                </div>
                <div className="proof-cell-date">
                  <span className="caption proof-date-text">
                    <Clock size={12} aria-hidden="true" /> {new Date(tx.at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="proof-cell-link">
                  <a
                    href={`https://testnet.nearblocks.io/txns/${tx.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-link mono"
                  >
                    <span>{tx.hash.slice(0, 8)}...{tx.hash.slice(-6)}</span>
                    <ArrowSquareOut size={13} aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filter Tabs & Counter */}
      <div className="proofs-toolbar">
        <div className="proof-filter-tabs">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => {
              setFilter('all');
              setPage(1);
            }}
          >
            {locale === 'id' ? 'Semua' : 'All'} ({proofs.length})
          </button>
          <button
            type="button"
            className={filter === 'near-testnet' ? 'active' : ''}
            onClick={() => {
              setFilter('near-testnet');
              setPage(1);
            }}
          >
            NEAR Testnet ({proofs.filter(p => p.network === 'near-testnet').length})
          </button>
          <button
            type="button"
            className={filter === 'sepolia' ? 'active' : ''}
            onClick={() => {
              setFilter('sepolia');
              setPage(1);
            }}
          >
            Sepolia ETH ({proofs.filter(p => p.network === 'sepolia').length})
          </button>
        </div>

        <span className="caption proof-counter">
          {c.page} {currentPage} {c.of} {totalPages}
        </span>
      </div>

      {proofError && <p role="alert" className="feedback">{c.proofError}</p>}

      {/* Paginated Compact Proof List */}
      {currentProofs.length > 0 ? (
        <ol className="proof-list" start={startIndex + 1}>
          {currentProofs.map((p, idx) => {
            const stepNum = startIndex + idx + 1;
            const hash = p.url.split('/').filter(Boolean).at(-1) ?? '';
            const parts = p.label.includes(':') ? p.label.split(':').map(s => s.trim()) : [null, p.label];
            const rawActor = parts[0]?.toLowerCase();
            const actionText = parts[1] ?? p.label;

            return (
              <li key={p.url} className="proof-item">
                <div className="proof-cell-id">
                  <span className="proof-step-badge mono">#{String(stepNum).padStart(2, '0')}</span>
                </div>

                <div className="proof-cell-action">
                  {rawActor && (
                    <span className={`actor-tag actor-tag-${rawActor}`}>
                      {rawActor.toUpperCase()}
                    </span>
                  )}
                  <strong className="proof-action-name">{actionText}</strong>
                  <span className={`network-pill network-${p.network}`}>
                    {p.network === 'near-testnet' ? 'NEAR' : 'Sepolia'}
                  </span>
                </div>

                <div className="proof-cell-date">
                  <span className="caption proof-date-text">
                    <Clock size={12} aria-hidden="true" /> {formatDate(p.createdAt)}
                  </span>
                </div>

                <div className="proof-cell-link">
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="proof-link mono"
                    title={p.url}
                  >
                    <span>{hash.length > 16 ? `${hash.slice(0, 6)}...${hash.slice(-6)}` : hash}</span>
                    <ArrowSquareOut size={13} aria-hidden="true" />
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="caption">{c.noProofs}</p>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-bar">
          <button
            type="button"
            className="button-secondary"
            disabled={currentPage <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← {c.prevPage}
          </button>

          <div className="page-numbers">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                type="button"
                className={`page-num-btn ${num === currentPage ? 'active' : ''}`}
                onClick={() => setPage(num)}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="button-secondary"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            {c.nextPage} →
          </button>
        </div>
      )}
    </div>
  );
}
