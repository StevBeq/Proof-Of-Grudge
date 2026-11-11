import { useEffect, useRef, useState } from 'react';
import { Play, BookOpen, X } from '@phosphor-icons/react';
import type { Copy } from '../lib/copy';
import type { Outcome } from '../lib/vaultSimulator';

type Branch = Exclude<Outcome, 'None'>;

function storyFor(c: Copy, key: Branch): { actor: 'owner' | 'heir' | 'rival'; text: string }[] {
  const ownerIdle = { actor: 'owner' as const, text: c.moveOwnerIdle };
  const heir = { actor: 'heir' as const, text: c.moveHeir };
  const rival = { actor: 'rival' as const, text: c.moveRival };
  const ownerBack = { actor: 'owner' as const, text: c.moveOwnerBack };
  const deadline = { actor: 'owner' as const, text: c.moveDeadline };
  switch (key) {
    case 'FalseAlarm': return [ownerIdle, heir, ownerBack, { actor: 'owner', text: `${c.final}: ${c.falseAlarm} — ${c.bondOwner}` }];
    case 'Busted': return [ownerIdle, heir, rival, { actor: 'owner', text: `${c.final}: ${c.busted} — ${c.bondRival}` }];
    case 'Uncontested': return [ownerIdle, heir, deadline, { actor: 'heir', text: `${c.final}: ${c.uncontested} — ${c.bondHeir}` }];
    case 'SpiteBackfired': return [ownerIdle, heir, rival, { actor: 'heir', text: `${c.final}: ${c.spiteBackfired} — ${c.bondsHeir}` }];
  }
}

export function Outcomes({ c, onPlay }: { c: Copy; onPlay: (outcome: Branch) => void }) {
  const rows: { key: Branch; code: string; name: string; what: string; assets: string; bonds: string; stamp: string; actor: 'owner' | 'heir' | 'rival' }[] = [
    { key: 'FalseAlarm', code: 'A', name: c.falseAlarm, what: c.falseWhat, assets: c.staysOwner, bonds: c.bondOwner, stamp: 'B → Owner', actor: 'owner' },
    { key: 'Busted', code: 'B', name: c.busted, what: c.bustedWhat, assets: c.staysOwner, bonds: c.bondRival, stamp: '2B → Rival', actor: 'rival' },
    { key: 'Uncontested', code: 'C', name: c.uncontested, what: c.uncontestedWhat, assets: c.creditHeir, bonds: c.bondHeir, stamp: 'A + B → Heir', actor: 'heir' },
    { key: 'SpiteBackfired', code: 'D', name: c.spiteBackfired, what: c.spiteWhat, assets: c.creditHeir, bonds: c.bondsHeir, stamp: 'A + 2B → Heir', actor: 'heir' },
  ];
  const [open, setOpen] = useState<Branch | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const openRow = open ? rows.find(r => r.key === open) : null;

  return (
    <section id="outcomes" className="section outcomes-section" aria-labelledby="outcomes-title">
      <header className="section-heading reveal">
        <p className="case-kicker">{c.outcomes}</p>
        <span className="chapter-mark mono" aria-hidden="true">03</span>
        <h2 id="outcomes-title">{c.roundsTitle}</h2>
        <p>{c.roundsIntro}</p>
      </header>
      <div className="rounds-grid">
        {rows.map(row => (
          <article key={row.key} className="round-card reveal">
            <header className="round-head">
              <span className="round-num mono" aria-hidden="true">{row.code}</span>
              <h3 className={`actor-${row.actor}`}>{row.name}</h3>
              <span className={`round-stamp stamp-${row.actor}`} aria-hidden="true">{row.stamp}</span>
            </header>
            <dl className="round-body">
              <div><dt>{c.what}</dt><dd>{row.what}</dd></div>
              <div><dt>{c.assets}</dt><dd>{row.assets}</dd></div>
              <div><dt>{c.bonds}</dt><dd className={`actor-${row.actor}`}>{row.bonds}</dd></div>
            </dl>
            <div className="round-actions">
              <button type="button" className="button-primary round-play" onClick={() => onPlay(row.key)}>
                <Play size={16} aria-hidden="true" />{c.playRound}
              </button>
              <button type="button" className="button-secondary" onClick={() => setOpen(row.key)}>
                <BookOpen size={16} aria-hidden="true" />{c.howToPlay}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="caption table-note">H = R = B. {c.pullNote}</p>

      {openRow && (
        <div className="story-overlay" role="presentation" onClick={e => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="story-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="story-title">
            <header className="story-head">
              <span className="case-kicker">{c.howToPlay}</span>
              <h3 id="story-title" className={`actor-${openRow.actor}`}>{openRow.name}</h3>
              <button ref={closeBtn} type="button" className="button-secondary story-close" onClick={() => setOpen(null)} aria-label={c.close}><X size={18} aria-hidden="true" /></button>
            </header>
            <p className="story-intro">{c.howToPlayIntro}</p>
            <ol className="story-steps">
              {storyFor(c, openRow.key).map((step, i) => (
                <li key={i} className={`story-step story-${step.actor}`}>
                  <span className="story-num mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                  <span className="story-dot" aria-hidden="true" />
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="story-actions">
              <button type="button" className="button-primary" onClick={() => { const k = openRow.key; setOpen(null); onPlay(k); }}><Play size={16} aria-hidden="true" />{c.playRound}</button>
              <button type="button" className="button-secondary" onClick={() => setOpen(null)}>{c.close}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
