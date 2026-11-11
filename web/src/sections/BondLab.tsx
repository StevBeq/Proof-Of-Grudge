import { useEffect, useRef } from 'react';
import type { Copy, Locale } from '../lib/copy';
import { formatModel, minimumBond } from '../lib/finance';
import { parseNear } from '../lib/vaultSimulator';
export function BondLab({ c, locale }: { c: Copy; locale: Locale }) {
  const assets = useRef<HTMLInputElement>(null); const q = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLOutputElement>(null); const qLabel = useRef<HTMLOutputElement>(null);
  const error = useRef<HTMLParagraphElement>(null); const update = useRef<() => void>(() => {});
  useEffect(() => {
    update.current = () => {
      const amount = parseNear((assets.current?.value ?? '').replace(',', '.'));
      const probability = BigInt(q.current?.value ?? '90');
      if (qLabel.current) qLabel.current.textContent = `${probability}%`;
      const invalid = amount === null || amount <= 0n;
      assets.current?.setAttribute('aria-invalid', String(invalid));
      if (error.current) error.current.hidden = !invalid;
      if (result.current) result.current.textContent = invalid ? '…' : `≈ ${formatModel(minimumBond(amount, probability), locale)} NEAR`;
    };
    update.current();
  }, [c, locale]);
  return (
    <section className="section bond-lab" id="bond-lab" aria-labelledby="lab-title">
      <div className="bond-lab-card">
        <div className="lab-copy">
          <p className="case-kicker">{c.minimum}</p>
          <span className="chapter-mark mono" aria-hidden="true">05</span>
          <h2 id="lab-title">{c.bondLab}</h2>
          <p>{c.bondIntro}</p>
          <p className="model-formula">B ≥ A × (1 - q) / q</p>
          <p className="caption">{c.assumption}</p>
        </div>
        <form className="lab-controls" onSubmit={e => e.preventDefault()} onInput={() => update.current()}>
          <label htmlFor="vault-value">{c.value}</label>
          <input id="vault-value" type="text" inputMode="decimal" defaultValue="100" ref={assets} aria-describedby="value-error" />
          <p ref={error} id="value-error" className="caption feedback" hidden>{c.invalidNumber}</p>
          <div className="ev-label">
            <label htmlFor="return-probability">{c.probability}</label>
            <output ref={qLabel} htmlFor="return-probability" className="mono">90%</output>
          </div>
          <input id="return-probability" type="range" min="1" max="100" defaultValue="90" ref={q} />
          <div className="lab-result-box">
            <label htmlFor="bond-result" className="caption">{c.minimum}</label>
            <output id="bond-result" ref={result} htmlFor="vault-value return-probability" className="lab-result mono">≈ 11.111111 NEAR</output>
            <p className="caption">{c.example}</p>
          </div>
        </form>
      </div>
    </section>
  );
}
