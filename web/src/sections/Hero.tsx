import type { Copy } from '../lib/copy';
export function Hero({ c }: { c: Copy }) {
  return <section className="hero section" id="hero" aria-labelledby="hero-title">
    <div className="hero-copy"><h1 id="hero-title">{c.headline1}<br /><span className="actor-rival">{c.headline2}</span></h1><p className="hero-intro">{c.intro}</p><div className="hero-actions"><a className="button-primary" href="#cockpit">{c.open}</a><a className="text-link" href="#outcomes">{c.theory}</a></div></div>
    <div className="hero-object"><div id="hero-scene" className="scene-anchor" role="img" aria-label={c.scene} /><div className="hero-legend"><span className="actor-owner">{c.owner}</span><span className="actor-heir">{c.heir}</span><span className="actor-rival">{c.rival}</span></div><p className="caption">{c.heroNote}</p></div>
    <p className="hero-network caption">{c.testnet}</p>
  </section>;
}
