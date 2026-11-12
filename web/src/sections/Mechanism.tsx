import type { Copy } from '../lib/copy';

export type MechanismStep = 0 | 1 | 2;

export function Mechanism({ c, step, onSelect }: { c: Copy; step: MechanismStep | null; onSelect: (next: MechanismStep | null) => void }) {
  const steps = [
    { title: c.step1Title, actor: 'heir' as const, body: c.step1 },
    { title: c.step2Title, actor: 'rival' as const, body: c.step2 },
    { title: c.step3Title, actor: 'owner' as const, body: c.step3 },
  ];
  const active = step === null ? null : steps[step];
  return (
    <section id="mechanism" className="section mechanism-section" aria-labelledby="mechanism-title">
      <div className="mechanism-object reveal">
        <div id="mechanism-scene" className="scene-anchor" role="img" aria-label={c.scene} />
        <p className="caption">{c.scene}</p>
        <p className="mechanism-readout mono" role="status" aria-live="polite">
          {active ? `${c.watchingAs}: ${active.title} — seal ${active.actor.toUpperCase()} ${step === 2 ? 'open' : 'locked'}` : c.mechanismHint}
        </p>
      </div>
      <div className="mechanism-copy">
        <header className="section-heading reveal">
          <p className="case-kicker">{c.mechanism}</p>
          <span className="chapter-mark mono" aria-hidden="true">02</span>
          <h2 id="mechanism-title">{c.mechanismTitle}</h2>
          <p>{c.mechanismHint}</p>
        </header>
        <ol className="mechanism-steps">
          {steps.map((s, index) => {
            const isActive = step === index;
            return (
              <li key={s.title} className={`mechanism-step reveal${isActive ? ' is-active' : ''}`}>
                <button type="button" className="mechanism-step-toggle" aria-pressed={isActive} onClick={() => onSelect(isActive ? null : (index as MechanismStep))}>
                  <span className={`mechanism-step-num actor-${s.actor} mono`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mechanism-step-content">
                    <span className={`mechanism-step-title actor-${s.actor}`}>{s.title}</span>
                    <span className="mechanism-step-body">{s.body}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
