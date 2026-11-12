import type { Copy } from '../lib/copy';

export function Limits({ c }: { c: Copy }) {
  const vectors = [
    {
      num: '01',
      tag: 'IDENTITY BOUNDARY',
      title: 'Sybil Collusion',
      desc: c.limit1,
      rule: 'TWO WALLETS · ONE ACTOR',
    },
    {
      num: '02',
      tag: 'ACCESS BOUNDARY',
      title: 'Irreversible Key Rot',
      desc: c.limit2,
      rule: 'ZERO CUSTODIAL BACKDOOR',
    },
    {
      num: '03',
      tag: 'INCENTIVE BOUNDARY',
      title: 'Speculative Griefing',
      desc: c.limit3,
      rule: 'B ≥ A × (1 - q) / q',
    },
    {
      num: '04',
      tag: 'LIVENESS BOUNDARY',
      title: 'Heartbeat Key Leakage',
      desc: c.limit4,
      rule: 'CLOCK EXTEND ONLY · ZERO TRANSFER',
    },
  ];

  return (
    <section className="section limits-section" id="limits" aria-labelledby="limits-title">
      <header className="limits-header reveal">
        <p className="case-kicker">06 // PROTOCOL BOUNDARIES</p>
        <span className="chapter-mark mono" aria-hidden="true">06</span>
        <h2 id="limits-title">{c.limitsTitle}</h2>
      </header>

      {/* 2x2 Forensic Risk Vectors Matrix */}
      <div className="limits-grid">
        {vectors.map(v => (
          <article key={v.num} className="limits-card reveal">
            <div className="limits-card-header mono">
              <span className="limits-vector-num">VECTOR {v.num}</span>
              <span className="limits-vector-tag">{v.tag}</span>
            </div>
            <h3 className="limits-card-title">{v.title}</h3>
            <p className="limits-card-desc">{v.desc}</p>
            <div className="limits-card-footer mono">
              <span className="limits-crosshair">+</span>
              <span className="limits-rule-text">{v.rule}</span>
            </div>
          </article>
        ))}
      </div>

      {/* The Core Axiom Banner */}
      <aside className="limits-axiom-card reveal" aria-label="Core game-theoretic axiom">
        <div className="axiom-badge mono">
          <span className="axiom-dot" />
          <span>CORE AXIOM // SYMMETRIC ESCROW MATRIX</span>
        </div>
        <p className="axiom-text">"{c.comparison}"</p>
        <div className="axiom-meta mono">
          <span>NEAR TESTNET DOMAIN 0</span>
          <span>NO FREE VETO // ADVERSARIAL EQUILIBRIUM</span>
        </div>
      </aside>
    </section>
  );
}
