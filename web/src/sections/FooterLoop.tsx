import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Copy, Locale } from '../lib/copy';
import { resetScrollToTopImmediate, setSmoothScrollLocked } from '../lib/smoothScroll';

gsap.registerPlugin(ScrollTrigger);

function CadBlueprintG() {
  // Architectural CAD vector blueprint of the letter 'G' (Owner Blue #1E4FD8 + Ink #16130D)
  return (
    <svg className="cad-letter-svg" viewBox="0 0 240 280" fill="none" aria-hidden="true">
      <line x1="0" y1="36" x2="240" y2="36" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="0" y1="244" x2="240" y2="244" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="36" y1="0" x2="36" y2="280" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="204" y1="0" x2="204" y2="280" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />

      <circle cx="120" cy="140" r="96" stroke="rgba(30,79,216,0.45)" strokeWidth="1.2" strokeDasharray="5 5" />
      <circle cx="120" cy="140" r="56" stroke="rgba(30,79,216,0.35)" strokeWidth="1" strokeDasharray="3 4" />

      <path
        d="M196 102V72C196 52 180 36 160 36H80C60 36 44 52 44 72V208C44 228 60 244 80 244H160C180 244 196 228 196 208V136H122V174H156V204H84V76H156V102H196Z"
        fill="rgba(30, 79, 216, 0.12)"
        stroke="#16130D"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      <line x1="56" y1="36" x2="184" y2="36" stroke="#1E4FD8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="56" y1="244" x2="184" y2="244" stroke="#1E4FD8" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="44" y1="64" x2="44" y2="216" stroke="#1E4FD8" strokeWidth="1.5" strokeDasharray="3 3" />

      <rect x="40" y="32" width="8" height="8" fill="#1E4FD8" stroke="#16130D" strokeWidth="1.2" />
      <rect x="192" y="32" width="8" height="8" fill="#1E4FD8" stroke="#16130D" strokeWidth="1.2" />
      <rect x="40" y="240" width="8" height="8" fill="#1E4FD8" stroke="#16130D" strokeWidth="1.2" />
      <rect x="192" y="240" width="8" height="8" fill="#1E4FD8" stroke="#16130D" strokeWidth="1.2" />
      <rect x="118" y="132" width="8" height="8" fill="#E8B412" stroke="#16130D" strokeWidth="1.2" />
      <rect x="192" y="132" width="8" height="8" fill="#1E4FD8" stroke="#16130D" strokeWidth="1.2" />

      <circle cx="120" cy="36" r="4" fill="#FFF8E8" stroke="#1E4FD8" strokeWidth="2" />
      <circle cx="120" cy="244" r="4" fill="#FFF8E8" stroke="#1E4FD8" strokeWidth="2" />
      <circle cx="44" cy="140" r="4" fill="#FFF8E8" stroke="#1E4FD8" strokeWidth="2" />
    </svg>
  );
}

function CadBlueprintE() {
  // Architectural CAD vector blueprint of the letter 'E' (Rival Red #D7261E + Ink #16130D)
  return (
    <svg className="cad-letter-svg" viewBox="0 0 240 280" fill="none" aria-hidden="true">
      <line x1="0" y1="36" x2="240" y2="36" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="0" y1="140" x2="240" y2="140" stroke="rgba(215,38,30,0.35)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="0" y1="244" x2="240" y2="244" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="44" y1="0" x2="44" y2="280" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="196" y1="0" x2="196" y2="280" stroke="rgba(22,19,13,0.22)" strokeWidth="1" strokeDasharray="4 4" />

      <circle cx="120" cy="140" r="88" stroke="rgba(215,38,30,0.38)" strokeWidth="1.2" strokeDasharray="5 5" />

      <path
        d="M44 36H196V78H86V119H174V161H86V202H196V244H44V36Z"
        fill="rgba(215, 38, 30, 0.12)"
        stroke="#16130D"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      <line x1="44" y1="36" x2="196" y2="36" stroke="#D7261E" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="44" y1="244" x2="196" y2="244" stroke="#D7261E" strokeWidth="1.5" strokeDasharray="3 3" />
      <line x1="196" y1="36" x2="196" y2="244" stroke="#D7261E" strokeWidth="1.5" strokeDasharray="3 3" />

      <rect x="40" y="32" width="8" height="8" fill="#D7261E" stroke="#16130D" strokeWidth="1.2" />
      <rect x="192" y="32" width="8" height="8" fill="#D7261E" stroke="#16130D" strokeWidth="1.2" />
      <rect x="170" y="115" width="8" height="8" fill="#E8B412" stroke="#16130D" strokeWidth="1.2" />
      <rect x="170" y="157" width="8" height="8" fill="#E8B412" stroke="#16130D" strokeWidth="1.2" />
      <rect x="40" y="240" width="8" height="8" fill="#D7261E" stroke="#16130D" strokeWidth="1.2" />
      <rect x="192" y="240" width="8" height="8" fill="#D7261E" stroke="#16130D" strokeWidth="1.2" />

      <circle cx="120" cy="36" r="4" fill="#FFF8E8" stroke="#D7261E" strokeWidth="2" />
      <circle cx="196" cy="140" r="4" fill="#FFF8E8" stroke="#D7261E" strokeWidth="2" />
      <circle cx="120" cy="244" r="4" fill="#FFF8E8" stroke="#D7261E" strokeWidth="2" />
    </svg>
  );
}

export function FooterLoop({
  c,
  locale,
  onLoopToTop,
}: {
  c: Copy;
  locale: Locale;
  onLoopToTop: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const gWrapRef = useRef<HTMLDivElement>(null);
  const eWrapRef = useRef<HTMLDivElement>(null);
  const centerSealRef = useRef<HTMLDivElement>(null);
  const midLettersRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLSpanElement>(null);
  const pctBadgeRef = useRef<HTMLElement>(null);
  const wipeCurtainRef = useRef<HTMLDivElement>(null);
  const loopingRef = useRef(false);

  const [activeHint, setActiveHint] = useState<string | null>(null);

  const runSmoothLoop = useCallback(() => {
    if (loopingRef.current) return;
    loopingRef.current = true;

    // Immediately lock Lenis so it stops processing downward wheel inertia
    setSmoothScrollLocked(true);

    const wipe = wipeCurtainRef.current;
    if (!wipe || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      resetScrollToTopImmediate();
      onLoopToTop();
      window.setTimeout(() => {
        loopingRef.current = false;
      }, 900);
      return;
    }

    const absorb = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('wheel', absorb, { passive: false, capture: true });
    window.addEventListener('touchmove', absorb, { passive: false, capture: true });

    gsap.killTweensOf(wipe);
    gsap.set(wipe, { visibility: 'visible', yPercent: 100 });

    const tl = gsap.timeline({
      onComplete: () => {
        window.removeEventListener('wheel', absorb, { capture: true } as EventListenerOptions);
        window.removeEventListener('touchmove', absorb, { capture: true } as EventListenerOptions);
        gsap.set(wipe, { visibility: 'hidden', yPercent: 100 });
        window.setTimeout(() => {
          loopingRef.current = false;
        }, 400);
      },
    });

    // 1. Slide Archival Case Folder sheet up smoothly to cover the viewport
    tl.to(wipe, {
      yPercent: 0,
      duration: 0.45,
      ease: 'expo.inOut',
      onComplete: () => {
        // 2. Reset both Lenis and native scroll to 0 while covered, then trigger top portal
        if (progressFillRef.current) progressFillRef.current.style.width = '0%';
        if (pctBadgeRef.current) pctBadgeRef.current.textContent = '00%';
        resetScrollToTopImmediate();
        onLoopToTop();
      },
    });

    // 3. Hold briefly, then slide the wipe curtain up and out to reveal the top
    tl.to(
      wipe,
      {
        yPercent: -100,
        duration: 0.48,
        ease: 'expo.inOut',
      },
      '+=0.16',
    );
  }, [onLoopToTop]);

  useEffect(() => {
    const track = trackRef.current;
    const stage = stageRef.current;
    const gWrap = gWrapRef.current;
    const eWrap = eWrapRef.current;
    const centerSeal = centerSealRef.current;
    const midLetters = midLettersRef.current;

    if (!track || !stage || !gWrap || !eWrap || !midLetters) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const midBlocks = gsap.utils.toArray<HTMLElement>('[data-mid-letter]', midLetters);

      // Start: Stage is pushed completely off-screen at bottom (yPercent: 100)
      gsap.set(stage, { yPercent: 100 });

      // Letters: [G] and [E] locked close together in the center around Gold H caliper
      gsap.set(gWrap, { xPercent: -50, yPercent: -50, x: -82, scale: 1 });
      gsap.set(eWrap, { xPercent: -50, yPercent: -50, x: 82, scale: 1 });
      if (centerSeal) gsap.set(centerSeal, { xPercent: -50, yPercent: -50, scale: 1, opacity: 1 });
      gsap.set(midBlocks, { scale: 0.5, opacity: 0, y: 24 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.35,
          onUpdate: self => {
            if (loopingRef.current) return;
            const p = self.progress;

            // Phase 1 (0.00 to 0.38): The Finale UI is rising up and covering Limits.
            // Progress bar stays strictly 0% until UI fully takes over screen!
            const activeP = Math.max(0, Math.min(1, (p - 0.38) / 0.62));
            const pct = Math.round(activeP * 100);

            if (progressFillRef.current) {
              progressFillRef.current.style.width = `${pct}%`;
            }
            if (pctBadgeRef.current) {
              pctBadgeRef.current.textContent = `${String(pct).padStart(2, '0')}%`;
            }
            if (activeP >= 0.985 && !loopingRef.current) {
              runSmoothLoop();
            }
          },
        },
      });

      // 1. Stage rises from yPercent 100 to 0 (0.00 to 0.38)
      // Physically ascends over the pinned Limits section like a rising curtain!
      tl.to(
        stage,
        {
          yPercent: 0,
          ease: 'power2.out',
          duration: 0.38,
        },
        0,
      );

      // 2. Once stage is fully covering viewport (0.42 to 0.92):
      // [G] and [E] CAD calipers pull apart to outer flanks, revealing R - U - D - G
      tl.to(
        gWrap,
        {
          x: () => -Math.min(window.innerWidth * 0.36, 430),
          scale: 0.96,
          ease: 'power2.inOut',
          duration: 0.44,
        },
        0.44,
      );

      tl.to(
        eWrap,
        {
          x: () => Math.min(window.innerWidth * 0.36, 430),
          scale: 0.96,
          ease: 'power2.inOut',
          duration: 0.44,
        },
        0.44,
      );

      if (centerSeal) {
        tl.to(
          centerSeal,
          {
            scale: 1.5,
            rotate: 180,
            opacity: 0,
            ease: 'power2.inOut',
            duration: 0.28,
          },
          0.44,
        );
      }

      tl.to(
        midBlocks,
        {
          scale: 1,
          opacity: 1,
          y: 0,
          stagger: { each: 0.045, from: 'center' },
          ease: 'back.out(1.35)',
          duration: 0.4,
        },
        0.52,
      );
    }, track);

    return () => ctx.revert();
  }, [runSmoothLoop]);

  const triggerCaliperPulse = (name: string, info: string) => {
    setActiveHint(info);
    window.setTimeout(() => setActiveHint(null), 3200);
  };

  return (
    <>
      {/* Smooth Archival Case Folder Transition Wipe */}
      <div className="loop-wipe-curtain" ref={wipeCurtainRef} aria-hidden="true">
        <div className="loop-wipe-inner">
          <span className="wordmark-symbol loop-wipe-symbol">
            <i />
            <i />
            <i />
          </span>
          <p className="case-kicker">
            {locale === 'id' ? 'MEMBUKA KEMBALI BERKAS PERKARA NO. 001' : 'REOPENING CASE FILE NO. 001'}
          </p>
          <h2>PROOF-OF-GRUDGE</h2>
        </div>
      </div>

      <div className="ge-footer-track" ref={trackRef}>
        <footer className="ge-footer-stage" ref={stageRef} aria-label="Proof-of-Grudge Architectural Finale">
          {/* Top Archival Blueprint Header with Interactive Protocol Telemetry */}
          <div className="ge-footer-topbar">
            <div className="ge-footer-kicker mono">
              <span className="ge-dot ge-dot-owner" />
              <span className="ge-dot ge-dot-heir" />
              <span className="ge-dot ge-dot-rival" />
              <span>{c.caseFile} // ARCHITECTURAL FINALE</span>
            </div>

            {/* Replaced Navigation Buttons (Per User Request Image 4) with Interactive Status Widget */}
            <div className="ge-footer-telemetry mono" aria-label="Protocol Audit Status">
              <div
                className="ge-telemetry-badge"
                role="status"
                onClick={() => triggerCaliperPulse('audit', locale === 'id' ? 'KONSENSUS MPC TERVERIFIKASI · SELESAI' : 'MPC CONSENSUS AUDITED · FINAL')}
                title={locale === 'id' ? 'Klik untuk verifikasi status konsensus' : 'Click to inspect consensus audit status'}
              >
                <span className="ge-status-live-dot" aria-hidden="true" />
                <span className="ge-telemetry-status">
                  {locale === 'id' ? 'AUDIT PROTOKOL: TERVERIFIKASI' : 'PROTOCOL AUDIT: VERIFIED'}
                </span>
              </div>
              <span className="ge-telemetry-spec">SECP256K1 · EIP-1559 · DOMAIN 0</span>
            </div>
          </div>

          {/* Full-screen Drafting Table: [G] and [E] CAD Calipers + Unfolding R - U - D - G */}
          <div className="ge-drafting-stage">
            <div className="ge-drafting-grid" aria-hidden="true" />

            <div className="ge-overline-banner mono">
              <span>PROOF — OF — GRUDGE // ADVERSARIAL INHERITANCE PROTOCOL</span>
            </div>

            {/* Interactive Telemetry Toast Overlay */}
            {activeHint && (
              <div className="ge-interactive-hint mono" role="alert">
                <span className="ge-hint-bullet">●</span>
                <span>{activeHint}</span>
              </div>
            )}

            <div className="ge-word-assembly" aria-label="GRUDGE">
              {/* Left CAD Caliper: [ G ] */}
              <div
                className="ge-caliper-wrap ge-caliper-g is-interactive"
                ref={gWrapRef}
                onClick={() => triggerCaliperPulse('g', '01 · OWNER // G-LOCK: KEEPER HEARTBEAT KEY VALIDATED')}
                role="button"
                tabIndex={0}
                aria-label="Owner G-Lock Caliper Blueprint"
              >
                <div className="ge-caliper-tag mono">01 · OWNER // G-LOCK</div>
                <CadBlueprintG />
              </div>

              {/* Center Gold Heir Caliper Seal */}
              <div
                className="ge-center-caliper is-interactive"
                ref={centerSealRef}
                onClick={() => triggerCaliperPulse('h', '02 · HEIR // BOND H: 1 NEAR REQUIRED FOR CLAIMS')}
                role="button"
                tabIndex={0}
                aria-label="Heir Bond H Seal"
              >
                <span>H</span>
                <small className="mono">1 NEAR</small>
              </div>

              {/* Unfolding Middle Letters: R - U - D - G */}
              <div className="ge-mid-letters" ref={midLettersRef} aria-hidden="true">
                <div className="ge-mid-tile ge-tile-r" data-mid-letter>
                  <span className="ge-tile-coord mono">02·R</span>
                  <strong>R</strong>
                </div>
                <div className="ge-mid-tile ge-tile-u" data-mid-letter>
                  <span className="ge-tile-coord mono">03·U</span>
                  <strong>U</strong>
                </div>
                <div className="ge-mid-tile ge-tile-d" data-mid-letter>
                  <span className="ge-tile-coord mono">04·D</span>
                  <strong>D</strong>
                </div>
                <div className="ge-mid-tile ge-tile-g2" data-mid-letter>
                  <span className="ge-tile-coord mono">05·G</span>
                  <strong>G</strong>
                </div>
              </div>

              {/* Right CAD Caliper: [ E ] */}
              <div
                className="ge-caliper-wrap ge-caliper-e is-interactive"
                ref={eWrapRef}
                onClick={() => triggerCaliperPulse('e', '03 · RIVAL // E-SEAL: 1 NEAR SYMMETRIC BOND OBJECTION')}
                role="button"
                tabIndex={0}
                aria-label="Rival E-Seal Caliper Blueprint"
              >
                <div className="ge-caliper-tag mono">06 · RIVAL // E-SEAL</div>
                <CadBlueprintE />
              </div>
            </div>
          </div>

          {/* Bottom Scroll-to-Loop Progress Rail */}
          <div className="ge-bottom-rail">
            <div className="ge-rail-header mono">
              <span>
                {locale === 'id'
                  ? 'TERUS GULIR KE BAWAH UNTUK LOOP KEMBALI KE ATAS ↻'
                  : 'KEEP SCROLLING DOWN TO SMOOTH-LOOP BACK TO TOP ↻'}
              </span>
              <strong ref={pctBadgeRef}>00%</strong>
            </div>
            <div className="ge-rail-track" aria-hidden="true">
              <span className="ge-rail-fill" ref={progressFillRef} />
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
