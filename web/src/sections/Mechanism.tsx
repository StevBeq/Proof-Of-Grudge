import type { Copy } from '../lib/copy';

export type MechanismStep = 0 | 1 | 2;

export function Mechanism({
  c,
  step,
  onSelect,
}: {
  c: Copy;
  step: MechanismStep | null;
  onSelect: (next: MechanismStep | null) => void;
}) {
  const steps = [
    { title: c.step1Title, actor: 'heir' as const, body: c.step1 },
    { title: c.step2Title, actor: 'rival' as const, body: c.step2 },
    { title: c.step3Title, actor: 'owner' as const, body: c.step3 },
  ];
  return (
    <section id="mechanism" className="section mechanism-section" aria-labelledby="mechanism-title">
      <div className="mechanism-object reveal">
        <div id="mechanism-scene" className="scene-anchor" role="img" aria-label={c.scene} />
        <p className="caption">{c.scene}</p>
      </div>
      <div className="mechanism-copy">
        <header className="section-heading reveal">
          <p className="case-kicker">{c.mechanism}</p>
          <h2 id="mechanism-title">{c.mechanismTitle}</h2>
          <p>{c.mechanismHint}</p>
        </header>
        <ol className="mechanism-steps">
          {steps.map((s, index) => {
            const active = step === index;
            return (
              <li key={s.title} className={`mechanism-step reveal${active ? ' is-active' : ''}`}>
                <button
                  type="button"
                  className="mechanism-step-toggle"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : (index as MechanismStep))}
                >
                  <span className={`mechanism-step-num actor-${s.actor} mono`} aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>
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
