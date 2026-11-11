import { useCallback, useEffect, useRef } from 'react';
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
  const gWrapRef = useRef<HTMLDivElement>(null);
  const eWrapRef = useRef<HTMLDivElement>(null);
  const centerSealRef = useRef<HTMLDivElement>(null);
  const midLettersRef = useRef<HTMLDivElement>(null);
  const progressFillRef = useRef<HTMLSpanElement>(null);
  const pctBadgeRef = useRef<HTMLElement>(null);
  const wipeCurtainRef = useRef<HTMLDivElement>(null);
  const loopingRef = useRef(false);

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
    const gWrap = gWrapRef.current;
    const eWrap = eWrapRef.current;
    const centerSeal = centerSealRef.current;
    const midLetters = midLettersRef.current;

    if (!track || !gWrap || !eWrap || !midLetters) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const midBlocks = gsap.utils.toArray<HTMLElement>('[data-mid-letter]', midLetters);

      // Start with [G] and [E] locked close together in the center around the Gold H caliper
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
            const pct = Math.round(p * 100);
            if (progressFillRef.current) {
              progressFillRef.current.style.width = `${pct}%`;
            }
            if (pctBadgeRef.current) {
              pctBadgeRef.current.textContent = `${String(pct).padStart(2, '0')}%`;
            }
            if (p >= 0.985 && !loopingRef.current) {
              runSmoothLoop();
            }
          },
        },
      });

      // [G] and [E] CAD calipers pull apart to the outer flanks while R - U - D - G unfold between them
      tl.to(
        gWrap,
        {
          x: () => -Math.min(window.innerWidth * 0.36, 430),
          scale: 0.96,
          ease: 'power2.inOut',
          duration: 0.58,
        },
        0.06,
      );

      tl.to(
        eWrap,
        {
          x: () => Math.min(window.innerWidth * 0.36, 430),
          scale: 0.96,
          ease: 'power2.inOut',
          duration: 0.58,
        },
        0.06,
      );

      if (centerSeal) {
        tl.to(
          centerSeal,
          {
            scale: 1.5,
            rotate: 180,
            opacity: 0,
            ease: 'power2.inOut',
            duration: 0.3,
          },
          0.06,
        );
      }

      tl.to(
        midBlocks,
        {
          scale: 1,
          opacity: 1,
          y: 0,
          stagger: { each: 0.05, from: 'center' },
          ease: 'back.out(1.35)',
          duration: 0.48,
        },
        0.18,
      );
    }, track);

    return () => ctx.revert();
  }, [runSmoothLoop]);

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
        <footer className="ge-footer-stage" aria-label="Proof-of-Grudge Architectural Finale">
          {/* Top Archival Blueprint Header */}
          <div className="ge-footer-topbar">
            <div className="ge-footer-kicker mono">
              <span className="ge-dot ge-dot-owner" />
              <span className="ge-dot ge-dot-heir" />
              <span className="ge-dot ge-dot-rival" />
              <span>{c.caseFile} // ARCHITECTURAL FINALE</span>
            </div>
            <nav className="ge-footer-nav mono" aria-label="Footer navigation">
              <a href="#hero">00 HERO</a>
              <a href="#dossier">01 {c.dossier.toUpperCase()}</a>
              <a href="#mechanism">02 {c.mechanism.toUpperCase()}</a>
              <a href="#outcomes">03 {c.outcomes.toUpperCase()}</a>
              <a href="#cockpit">04 {c.cockpit.toUpperCase()}</a>
            </nav>
          </div>

          {/* Full-screen Drafting Table: [G] and [E] CAD Calipers + Unfolding R - U - D - G */}
          <div className="ge-drafting-stage">
            <div className="ge-drafting-grid" aria-hidden="true" />

            <div className="ge-overline-banner mono">
              <span>PROOF — OF — GRUDGE // ADVERSARIAL INHERITANCE PROTOCOL</span>
            </div>

            <div className="ge-word-assembly" aria-label="GRUDGE">
              {/* Left CAD Caliper: [ G ] */}
              <div className="ge-caliper-wrap ge-caliper-g" ref={gWrapRef}>
                <div className="ge-caliper-tag mono">01 · OWNER // G-LOCK</div>
                <CadBlueprintG />
              </div>

              {/* Center Gold Heir Caliper Seal */}
              <div className="ge-center-caliper" ref={centerSealRef} aria-hidden="true">
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
              <div className="ge-caliper-wrap ge-caliper-e" ref={eWrapRef}>
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
