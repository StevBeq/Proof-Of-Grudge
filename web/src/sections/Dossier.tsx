import type { Copy } from '../lib/copy';
import type { Role } from '../lib/vaultSimulator';

export type DossierSelection = { role: Role; focus: Role | null };

export function Dossier({
  c,
  role,
  onSelect,
}: {
  c: Copy;
  role: Role;
  onSelect: (next: DossierSelection) => void;
}) {
  const cards = [
    { key: 'owner' as const, title: c.ownerTitle, desc: c.ownerDesc, seal: 'O' },
    { key: 'heir' as const, title: c.heirTitle, desc: c.heirDesc, seal: 'H' },
    { key: 'rival' as const, title: c.rivalTitle, desc: c.rivalDesc, seal: 'R' },
  ];
  return (
    <section id="dossier" className="section dossier-section" aria-labelledby="dossier-title">
      <header className="section-heading reveal">
        <p className="case-kicker">{c.caseFile}</p>
        <h2 id="dossier-title">{c.dossierTitle}</h2>
        <p>{c.dossierIntro}</p>
      </header>
      <div className="dossier-grid">
        {cards.map(card => {
          const active = role === card.key;
          return (
            <article
              key={card.key}
              className={`dossier-card dossier-${card.key} reveal${active ? ' is-active' : ''}`}
              aria-current={active}
            >
              <span className="dossier-seal" aria-hidden="true">{card.seal}</span>
              <h3>{c[card.key]}</h3>
              <p className="dossier-role">{card.title}</p>
              <p className="dossier-desc">{card.desc}</p>
              <button
                type="button"
                className="button-secondary dossier-button"
                aria-pressed={active}
                onClick={() => onSelect({ role: card.key, focus: card.key })}
              >
                {c.selectActor}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
