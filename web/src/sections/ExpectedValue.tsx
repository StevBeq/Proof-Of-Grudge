import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { Copy } from '../lib/copy';
import { formatNear } from '../lib/vaultSimulator';
import { rivalExpectedValue } from '../lib/finance';
export function ExpectedValue({ c, bond }: { c: Copy; bond: bigint }) {
  const slider = useRef<HTMLInputElement>(null); const probability = useRef<HTMLOutputElement>(null);
  const ev = useRef<HTMLOutputElement>(null); const point = useRef<SVGCircleElement>(null);
  const update = useRef<() => void>(() => {});
  useEffect(() => {
    const x = gsap.quickSetter(point.current, 'x', 'px'); const y = gsap.quickSetter(point.current, 'y', 'px');
    update.current = () => {
      const p = Number(slider.current?.value ?? 65);
      if (probability.current) probability.current.textContent = `${p}%`;
      const result = rivalExpectedValue(bond, BigInt(p));
      if (ev.current) ev.current.textContent = `${result > 0n ? '+' : ''}${formatNear(result)} NEAR`;
      x(10 + p * 2.2); y(115 - p * .9);
    };
    update.current();
  }, [bond, c]);
  return <section className="ev-panel" aria-labelledby="ev-title">
    <div className="ev-copy">
      <h3 id="ev-title">{c.ev}</h3>
      <div className="ev-label"><label htmlFor="belief">{c.belief} <var>p</var></label><output ref={probability} htmlFor="belief" className="mono">65%</output></div>
      <input id="belief" ref={slider} type="range" min="0" max="100" defaultValue="65" onInput={() => update.current()} className="rival-range" />
      <p className="caption">{c.estimate}</p>
    </div>
    <div className="ev-result">
      <output ref={ev} htmlFor="belief" className="mono actor-rival" />
      <svg viewBox="0 0 240 140" role="img" aria-label={`${c.ev}: EV = (2p - 1) × B`}>
        <path d="M10 70H230 M120 20V120" stroke="var(--line)" fill="none" />
        <path d="M10 115L230 25" stroke="var(--rival)" fill="none" strokeWidth="2" />
        <circle ref={point} r="5" fill="var(--rival)" />
        <text x="10" y="137">0%</text><text x="109" y="137">50%</text><text x="204" y="137">100%</text>
      </svg>
      <p className="caption">EV = (2p - 1) × B. {c.evNote}</p>
    </div>
  </section>;
}
