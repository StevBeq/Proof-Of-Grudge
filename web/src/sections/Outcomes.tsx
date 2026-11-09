import { Play } from '@phosphor-icons/react';
import type { Copy } from '../lib/copy';
import type { Outcome } from '../lib/vaultSimulator';

export function Outcomes({
  c,
  onPlay,
}: {
  c: Copy;
  onPlay: (outcome: Exclude<Outcome, 'None'>) => void;
}) {
  const rows = [
    { key: 'FalseAlarm' as const, name: c.falseAlarm, what: c.falseWhat, assets: c.staysOwner, bonds: c.bondOwner, actor: 'owner' as const },
    { key: 'Busted' as const, name: c.busted, what: c.bustedWhat, assets: c.staysOwner, bonds: c.bondRival, actor: 'rival' as const },
    { key: 'Uncontested' as const, name: c.uncontested, what: c.uncontestedWhat, assets: c.creditHeir, bonds: c.bondHeir, actor: 'heir' as const },
    { key: 'SpiteBackfired' as const, name: c.spiteBackfired, what: c.spiteWhat, assets: c.creditHeir, bonds: c.bondsHeir, actor: 'heir' as const },
  ];
  return (
    <section id="outcomes" className="section outcomes-section" aria-labelledby="outcomes-title">
      <header className="section-heading reveal">
        <p className="case-kicker">{c.outcomes}</p>
        <h2 id="outcomes-title">{c.roundsTitle}</h2>
        <p>{c.roundsIntro}</p>
      </header>
      <div className="rounds-grid">
        {rows.map((row, index) => (
          <article key={row.key} className="round-card reveal">
            <header className="round-head">
              <span className="round-num mono" aria-hidden="true">{c.round} {String(index + 1).padStart(2, '0')}</span>
              <h3>{row.name}</h3>
              <span className={`round-stamp stamp-${row.actor}`} aria-hidden="true">{row.name}</span>
            </header>
            <dl className="round-body">
              <div><dt>{c.what}</dt><dd>{row.what}</dd></div>
              <div><dt>{c.assets}</dt><dd>{row.assets}</dd></div>
              <div><dt>{c.bonds}</dt><dd className={`actor-${row.actor}`}>{row.bonds}</dd></div>
            </dl>
            <button type="button" className="button-primary round-play" onClick={() => onPlay(row.key)}>
              <Play size={16} aria-hidden="true" />{c.playRound}
            </button>
          </article>
        ))}
      </div>
      <p className="caption table-note">H = R = B. {c.pullNote}</p>
    </section>
  );
}
