import type { Copy } from '../lib/copy';
import type { Role } from '../lib/vaultSimulator';

export type DossierSelection = { role: Role; focus: Role | null };

export function Dossier({ c, role, onSelect }: { c: Copy; role: Role; onSelect: (next: DossierSelection) => void }) {
  const cards = [
    { key: 'owner' as const, title: c.ownerTitle, desc: c.ownerDesc, seal: 'O' },
    { key: 'heir' as const, title: c.heirTitle, desc: c.heirDesc, seal: 'H' },
    { key: 'rival' as const, title: c.rivalTitle, desc: c.rivalDesc, seal: 'R' },
  ];
  return (
    <section id="dossier" className="section dossier-section" aria-labelledby="dossier-title">
      <div className="dossier-header-row reveal">
        <header className="section-heading">
          <p className="case-kicker">{c.dossier}</p>
          <span className="chapter-mark mono" aria-hidden="true">01</span>
          <h2 id="dossier-title">{c.dossierTitle}</h2>
          <p className="dossier-intro">{c.dossierIntro}</p>
          <p className="watching-chip" role="status"><strong>{c.watchingAs}:</strong> <span className={`actor-${role}`}>{c[role]}</span> — {c.watchingCockpit}</p>
        </header>

        {/* Repositioned Evidence File Slip & Stempel Berkas (Per user sketch in Image 6) */}
        <aside className="dossier-evidence-slip" aria-label="Forensic Case Document Badge">
          <div className="slip-paper">
            <div className="slip-header-line mono" aria-hidden="true">
              <span>REF: EVIDENCE-001</span>
              <span>FORENSIC ARCHIVE</span>
            </div>
            <div className="stamp-frame" aria-hidden="true">
              <span className="stamp-tag mono">DECLASSIFIED FORENSIC ARCHIVE // REF 001</span>
              <strong className="stamp-title">CONFIDENTIAL</strong>
              <span className="stamp-sub mono">CASE NO. 001 // SYMMETRIC ESCROW MATRIX</span>
            </div>
            <div className="slip-footer-line mono" aria-hidden="true">
              <span>SEC // SEPARATION: THREE ACTORS</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="dossier-grid">
        {cards.map((card, index) => {
          const active = role === card.key;
          return (
            <article key={card.key} className={`dossier-card dossier-${card.key} reveal${active ? ' is-active' : ''}`} aria-current={active}>
              <span className="dossier-card-crosshair tl" aria-hidden="true">+</span>
              <span className="dossier-card-crosshair br" aria-hidden="true">+</span>
              <div className="dossier-card-meta" aria-hidden="true">
                <span className="dossier-card-tag mono">DOC-0{index + 1} // {card.key.toUpperCase()}</span>
                <span className="dossier-card-status mono">{active ? '● ACTIVE FOCUS' : '○ STANDBY'}</span>
              </div>
              <span className="dossier-seal" aria-hidden="true">{card.seal}</span>
              <h3>{c[card.key]}</h3>
              <p className="dossier-role">{card.title}</p>
              <p className="dossier-desc">{card.desc}</p>
              <button type="button" className="button-secondary dossier-button" aria-pressed={active} onClick={() => onSelect({ role: card.key, focus: card.key })}>
                {active ? `✓ ${c.actAs(c[card.key])}` : c.actAs(c[card.key])}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
