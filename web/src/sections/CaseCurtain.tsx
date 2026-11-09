import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { Copy } from '../lib/copy';

export function CaseCurtain({
  c,
  onClose,
}: {
  c: Copy;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (panel.current) {
      gsap.from(panel.current, { yPercent: 0, autoAlpha: 0, duration: 0.45, ease: 'power2.out' });
    }
  }, []);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    gsap.to(panel.current, {
      yPercent: -8,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power2.in',
      onComplete: onClose,
    });
  };

  return (
    <div className="curtain" role="dialog" aria-label={c.caseFile}>
      <div className="curtain-panel" ref={panel}>
        <p className="case-kicker">{c.caseFile}</p>
        <h2 className="curtain-title">{c.headline1}<br /><span className="actor-rival">{c.headline2}</span></h2>
        <p className="curtain-intro">{c.intro}</p>
        <p className="caption curtain-note">{c.heroNote}</p>
        <div className="curtain-actions">
          <button type="button" className="button-primary" onClick={close} autoFocus>
            {c.open}
          </button>
          <button type="button" className="button-secondary" onClick={close}>
            {c.skipIntro}
          </button>
        </div>
        <p className="caption curtain-network">{c.testnet}</p>
      </div>
    </div>
  );
}
