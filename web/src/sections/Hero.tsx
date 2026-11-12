import type { Copy } from '../lib/copy';
import { resetSceneRotation } from '../lib/sceneInput';
import { scrollToElementSmooth } from '../lib/smoothScroll';

export interface HeroProps {
  c: Copy;
  onOpenCockpit?: () => void;
}

export function Hero({ c, onOpenCockpit }: HeroProps) {
  return (
    <section className="hero section" id="hero" aria-labelledby="hero-title">
      {/* Background Layer 1: Giant Outlined Typographic Watermark (Full Bleed Edge-to-Edge) */}
      <div className="hero-bg-marquee" aria-hidden="true">
        <div className="hero-marquee-track">
          <span>PROOF-OF-GRUDGE · CASE FILE NO. 001 · TRI-SEAL APERTURE · ZERO TRUST · </span>
          <span>PROOF-OF-GRUDGE · CASE FILE NO. 001 · TRI-SEAL APERTURE · ZERO TRUST · </span>
          <span>PROOF-OF-GRUDGE · CASE FILE NO. 001 · TRI-SEAL APERTURE · ZERO TRUST · </span>
        </div>
      </div>

      {/* Background Layer 2: Forensic Registration Marks & Case Spec Watermark */}
      <div className="hero-tech-accents" aria-hidden="true">
        <span className="hero-crosshair hero-crosshair-tl">+</span>
        <span className="hero-crosshair hero-crosshair-tr">+</span>
        <span className="hero-crosshair hero-crosshair-bl">+</span>
        <span className="hero-crosshair hero-crosshair-br">+</span>
        <span className="hero-spec-tag mono">EVIDENCE SPEC // SECP256K1 · EIP-1559 · MPC DOMAIN 0</span>
      </div>

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
          <a
            className="button-primary"
            href="#cockpit"
            onClick={e => {
              e.preventDefault();
              if (onOpenCockpit) {
                onOpenCockpit();
              } else {
                scrollToElementSmooth('#cockpit');
              }
            }}
          >
            {c.open}
          </a>
          <a className="text-link" href="#outcomes">{c.theory}</a>
        </div>
        <div className="hero-footer-meta">
          <p className="scroll-hint caption" aria-hidden="true">
            <span className="scroll-hint-line" />
            {c.scrollHint}
          </p>
          <p className="hero-network caption mono">{c.testnet}</p>
        </div>
      </div>
      <div className="hero-object">
        {/* Atmospheric Stage Glow behind 3D strongbox (Inspired by ref1) */}
        <div className="hero-stage-glow" aria-hidden="true" />
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
    </section>
  );
}
