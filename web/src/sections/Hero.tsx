import type { Copy } from '../lib/copy';
import { resetSceneRotation } from '../lib/sceneInput';

export function Hero({ c }: { c: Copy }) {
  return (
    <section className="hero section" id="hero" aria-labelledby="hero-title">
      <div className="hero-copy reveal">
        <p className="case-kicker">{c.caseFile}</p>
        <h1 id="hero-title">{c.headline1}<br /><span className="actor-rival">{c.headline2}</span></h1>
        <p className="hero-intro">{c.intro}</p>
        <dl className="evidence" aria-label={c.evidenceTitle}>
          <div>
            <dt className="caption">{c.evidenceVault}</dt>
            <dd className="evidence-number mono">10<small>NEAR</small></dd>
          </div>
          <div>
            <dt className="caption">{c.evidenceBond}</dt>
            <dd className="evidence-number mono actor-heir">1<small>NEAR</small></dd>
          </div>
          <div>
            <dt className="caption">{c.evidenceBranches}</dt>
            <dd className="evidence-number mono actor-rival">4</dd>
          </div>
        </dl>
        <div className="hero-actions">
          <a className="button-primary" href="#dossier">{c.open}</a>
          <a className="text-link" href="#outcomes">{c.theory}</a>
        </div>
        <p className="scroll-hint caption" aria-hidden="true"><span className="scroll-hint-line" />{c.scrollHint}</p>
      </div>
      <div className="hero-object">
        <div id="hero-scene" className="scene-anchor" role="img" aria-label={c.scene} />
        <div className="hero-scene-controls">
          <span className="drag-hint">{c.dragHint}</span>
          <button type="button" className="button-secondary hero-reset" onClick={() => resetSceneRotation()}>
            {c.resetView}
          </button>
        </div>
        <div className="hero-legend">
          <span className="actor-owner">{c.owner}</span>
          <span className="actor-heir">{c.heir}</span>
          <span className="actor-rival">{c.rival}</span>
        </div>
        <p className="caption">{c.heroNote}</p>
      </div>
      <p className="hero-network caption">{c.testnet}</p>
    </section>
  );
}
