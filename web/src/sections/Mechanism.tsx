import type { Copy } from '../lib/copy';
export function Mechanism({ c }: { c: Copy }) {
  return <section id="mechanism" className="section mechanism-section" aria-labelledby="mechanism-title">
    <div className="mechanism-object"><div id="mechanism-scene" className="scene-anchor" role="img" aria-label={c.scene} /></div>
    <div className="mechanism-copy"><h2 id="mechanism-title">{c.mechanismTitle}</h2><div className="mechanism-step"><h3 className="actor-heir">{c.heir}</h3><p>{c.step1}</p></div><div className="mechanism-step"><h3 className="actor-rival">{c.rival}</h3><p>{c.step2}</p></div><div className="mechanism-step"><h3 className="actor-owner">{c.owner}</h3><p>{c.step3}</p></div></div>
  </section>;
}
