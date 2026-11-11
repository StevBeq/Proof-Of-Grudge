import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { Copy, Locale } from '../lib/copy';
import { sceneInput } from '../lib/sceneInput';

interface OrbitalCoinSpec {
  id: string;
  actor: 'owner' | 'heir' | 'rival' | 'vault';
  side: 'left' | 'right';
  code: string;
  titleEn: string;
  titleId: string;
  subEn: string;
  subId: string;
  depth: number;
  x: string;
  y: string;
  glyph: 'clock' | 'heir-h' | 'rival-r' | 'vault-10' | 'eth-deed' | 'slash-2b';
}

// Placed strictly on the Left Arc (10, 9, 8 o'clock) and Right Arc (2, 3, 4 o'clock).
// 12 o'clock (top) and 6 o'clock (bottom) are 100% clear so zero elements ever overlap.
const ORBITAL_COINS: OrbitalCoinSpec[] = [
  {
    id: 'owner-clock',
    actor: 'owner',
    side: 'left',
    code: '01 · OWNER',
    titleEn: 'HEARTBEAT DIAL',
    titleId: 'DIAL DETAK',
    subEn: 'check_in() alive',
    subId: 'check_in() aktif',
    depth: 1.05,
    x: '19%',
    y: '24%',
    glyph: 'clock',
  },
  {
    id: 'vault-principal',
    actor: 'owner',
    side: 'left',
    code: 'VAULT · A',
    titleEn: '10 NEAR LOCKED',
    titleId: '10 NEAR TERKUNCI',
    subEn: 'Principal Deposit',
    subId: 'Pokok Brankas',
    depth: 0.82,
    x: '11%',
    y: '50%',
    glyph: 'vault-10',
  },
  {
    id: 'rival-bond',
    actor: 'rival',
    side: 'left',
    code: '03 · RIVAL',
    titleEn: 'CHALLENGE SEAL R',
    titleId: 'SEGEL SANGGAH R',
    subEn: 'Bond R = 1 NEAR',
    subId: 'Jaminan R = 1 NEAR',
    depth: 1.08,
    x: '19%',
    y: '76%',
    glyph: 'rival-r',
  },
  {
    id: 'heir-bond',
    actor: 'heir',
    side: 'right',
    code: '02 · HEIR',
    titleEn: 'CLAIM SEAL H',
    titleId: 'SEGEL KLAIM H',
    subEn: 'Bond H = 1 NEAR',
    subId: 'Jaminan H = 1 NEAR',
    depth: 1.1,
    x: '81%',
    y: '24%',
    glyph: 'heir-h',
  },
  {
    id: 'eth-sepolia',
    actor: 'heir',
    side: 'right',
    code: 'SEPOLIA · ETH',
    titleEn: '0x02 RLP DEED',
    titleId: 'AKTA RLP 0x02',
    subEn: 'MPC Chain Sig',
    subId: 'MPC Chain Sig',
    depth: 0.86,
    x: '89%',
    y: '50%',
    glyph: 'eth-deed',
  },
  {
    id: 'slash-bounty',
    actor: 'vault',
    side: 'right',
    code: '2B · FORFEITURE',
    titleEn: 'NO FREE VETO',
    titleId: 'TANPA VETO GRATIS',
    subEn: 'H + R = 2 NEAR',
    subId: 'H + R = 2 NEAR',
    depth: 0.96,
    x: '81%',
    y: '76%',
    glyph: 'slash-2b',
  },
];

function CoinGlyph({ glyph }: { glyph: OrbitalCoinSpec['glyph'] }) {
  switch (glyph) {
    case 'clock':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M24 12v12l8 5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="3" fill="currentColor" />
        </svg>
      );
    case 'heir-h':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M16 14v20M32 14v20M16 24h16" fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="square" />
        </svg>
      );
    case 'rival-r':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M17 34V14h10a6 6 0 0 1 0 12H17m9 0 7 8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="square" strokeLinejoin="round" />
        </svg>
      );
    case 'slash-2b':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <circle cx="19" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <circle cx="29" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <path d="M13 35 35 13" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
        </svg>
      );
    case 'vault-10':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <rect x="9" y="12" width="30" height="24" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M9 20h30M18 12V8h12v4" fill="none" stroke="currentColor" strokeWidth="2.6" />
          <circle cx="19" cy="27" r="3.5" fill="currentColor" />
          <circle cx="29" cy="27" r="3.5" fill="currentColor" />
        </svg>
      );
    case 'eth-deed':
      return (
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <polygon points="24,7 35,24 24,30 13,24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
          <polygon points="24,33 35,26 24,41 13,26" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function CaseCurtain({
  c,
  locale = 'en',
  onClose,
}: {
  c: Copy;
  locale?: Locale;
  onClose: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLSpanElement>(null);
  const pctTextRef = useRef<HTMLElement>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }

    // Clear any hash (like #outcomes) and park underlying window at Section 1 (Hero)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    window.scrollTo(0, 0);

    const mountedAt = performance.now();
    let targetProgress = 0;
    const state = { p: 0 };

    const ctx = gsap.context(() => {
      const ringOuter = stage.querySelector<SVGElement>('[data-vault-ring-outer]');
      const ringMid = stage.querySelector<SVGElement>('[data-vault-ring-mid]');
      const ringInner = stage.querySelector<SVGElement>('[data-vault-ring-inner]');
      const ringProgress = stage.querySelector<SVGCircleElement>('[data-vault-ring-progress]');
      const headerBlock = stage.querySelector<HTMLElement>('[data-portal-header]');
      const footerBlock = stage.querySelector<HTMLElement>('[data-portal-footer]');
      const coins = gsap.utils.toArray<HTMLElement>('[data-orbital-coin]', stage);

      const circumference = 2 * Math.PI * 210; // r = 210 -> ~1319.47
      if (ringProgress) {
        ringProgress.style.strokeDasharray = `${circumference}`;
        ringProgress.style.strokeDashoffset = `${circumference}`;
      }

      // Ensure visibility is always visible (never use autoAlpha which can leave visibility: hidden)
      gsap.set([stage, coins, headerBlock, footerBlock], { visibility: 'visible', opacity: 1 });

      // 1. Entrance pop-in animation using opacity & scale only
      gsap.fromTo(
        coins,
        { scale: 0.2, opacity: 0, rotateY: -45 },
        {
          scale: 1,
          opacity: 1,
          rotateY: 0,
          duration: 0.55,
          stagger: { each: 0.04, from: 'edges' },
          ease: 'back.out(1.4)',
        },
      );

      // 2. Interactive pointer 3D tilt parallax
      const movers = coins.map(el => ({
        depth: Number(el.dataset.depth || 0.9),
        qx: gsap.quickTo(el, 'xPercent', { duration: 0.75, ease: 'power3.out' }),
        qy: gsap.quickTo(el, 'yPercent', { duration: 0.75, ease: 'power3.out' }),
        qRotY: gsap.quickTo(el, 'rotationY', { duration: 0.75, ease: 'power3.out' }),
        qRotX: gsap.quickTo(el, 'rotationX', { duration: 0.75, ease: 'power3.out' }),
      }));

      const onPointerMove = (e: PointerEvent) => {
        if (closingRef.current) return;
        const rx = e.clientX / window.innerWidth - 0.5;
        const ry = e.clientY / window.innerHeight - 0.5;
        movers.forEach(m => {
          m.qx(-24 * rx * m.depth);
          m.qy(-24 * ry * m.depth);
          m.qRotY(rx * 28 * m.depth);
          m.qRotX(-ry * 22 * m.depth);
        });
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      // 3. Apply zoom progress (0 -> 1) across the Vault Lock rings, 6 orbital coins, and 3D Strongbox
      const applyZoom = (p: number) => {
        const pct = Math.round(p * 100);
        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${pct}%`;
        }
        if (pctTextRef.current) {
          pctTextRef.current.textContent = `${String(pct).padStart(2, '0')}%`;
        }
        if (ringProgress) {
          ringProgress.style.strokeDashoffset = `${circumference * (1 - p)}`;
        }

        // Vault combination rings rotate and zoom past the camera
        const ringScale = 1 + Math.pow(p, 1.7) * 2.8;
        if (ringOuter) {
          gsap.set(ringOuter, {
            scale: ringScale,
            rotate: p * 140,
            transformOrigin: '50% 50%',
          });
        }
        if (ringMid) {
          gsap.set(ringMid, {
            scale: 1 + Math.pow(p, 1.6) * 2.3,
            rotate: -p * 110,
            transformOrigin: '50% 50%',
          });
        }
        if (ringInner) {
          gsap.set(ringInner, {
            scale: 1 + Math.pow(p, 1.5) * 1.9,
            rotate: p * 85,
            transformOrigin: '50% 50%',
          });
        }

        // Coins fly outward along left/right vectors and zoom in 3D (never crossing center text!)
        coins.forEach((el, idx) => {
          const d = Number(el.dataset.depth || 0.9);
          const sideDir = el.dataset.side === 'left' ? -1 : 1;
          const verticalFactor = idx % 3 === 0 ? -0.45 : idx % 3 === 1 ? 0 : 0.45;
          const spreadX = sideDir * Math.pow(p, 1.45) * window.innerWidth * 0.36 * d;
          const spreadY = verticalFactor * Math.pow(p, 1.45) * window.innerHeight * 0.28 * d;
          const scale = 1 + Math.pow(p, 1.5) * 1.95 * d;
          const rotZ = sideDir * p * 32 * d;

          gsap.set(el, {
            x: spreadX,
            y: spreadY,
            scale,
            rotateZ: rotZ,
            opacity: p > 0.78 ? Math.max(0, 1 - (p - 0.78) / 0.22) : 1,
          });
        });

        // Header & footer blocks recede cleanly as the vault aperture opens
        if (headerBlock) {
          gsap.set(headerBlock, {
            y: -p * 55,
            scale: 1 - p * 0.16,
            opacity: Math.max(0, 1 - p * 1.45),
          });
        }
        if (footerBlock) {
          gsap.set(footerBlock, {
            y: p * 55,
            scale: 1 - p * 0.12,
            opacity: Math.max(0, 1 - p * 1.35),
          });
        }

        // Couple directly to the 3D Twin-Seal Strongbox in #portal-scene
        sceneInput.progress = p;
        sceneInput.sealH = p >= 0.24 ? 1 : 0;
        sceneInput.sealR = p >= 0.52 ? 1 : 0;
        sceneInput.lidOpen = p >= 0.72 ? Math.min(0.95, (p - 0.72) * 3.4) : 0;

        // When zoom hits 100%, transition directly to Section 1 (Hero)
        if (p >= 0.99 && !closingRef.current) {
          triggerComplete();
        }
      };

      const triggerComplete = () => {
        if (closingRef.current) return;
        closingRef.current = true;
        sceneInput.sealH = null;
        sceneInput.sealR = null;
        sceneInput.lidOpen = null;
        sceneInput.progress = 0;
        window.scrollTo(0, 0);

        gsap.to(stage, {
          opacity: 0,
          scale: 1.16,
          duration: 0.36,
          ease: 'power2.inOut',
          onComplete: () => {
            window.scrollTo(0, 0);
            onClose();
          },
        });
      };

      const animateToTarget = () => {
        gsap.to(state, {
          p: targetProgress,
          duration: 0.34,
          ease: 'power2.out',
          overwrite: 'auto',
          onUpdate: () => applyZoom(state.p),
        });
      };

      const onWheel = (e: WheelEvent) => {
        // Always prevent native scroll while CaseCurtain is mounted (even during closing)
        e.preventDefault();
        e.stopPropagation();
        if (closingRef.current) return;
        // Ignore leftover wheel inertia for the first 500ms after mount (e.g. after footer loop)
        if (performance.now() - mountedAt < 500) return;
        const delta = Math.max(-140, Math.min(140, e.deltaY));
        targetProgress = Math.max(0, Math.min(1, targetProgress + delta * 0.0014));
        animateToTarget();
      };

      let touchStartY = 0;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
          touchStartY = e.touches[0].clientY;
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (closingRef.current || e.touches.length === 0) return;
        if (performance.now() - mountedAt < 500) return;
        const dy = touchStartY - e.touches[0].clientY;
        touchStartY = e.touches[0].clientY;
        targetProgress = Math.max(0, Math.min(1, targetProgress + dy * 0.0032));
        animateToTarget();
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (closingRef.current) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          triggerComplete();
        } else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          targetProgress = Math.min(1, targetProgress + 0.28);
          animateToTarget();
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          targetProgress = Math.max(0, targetProgress - 0.28);
          animateToTarget();
        }
      };

      window.addEventListener('wheel', onWheel, { passive: false });
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: false });
      window.addEventListener('keydown', onKeyDown);

      return () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('wheel', onWheel);
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('keydown', onKeyDown);
      };
    }, stage);

    return () => {
      sceneInput.sealH = null;
      sceneInput.sealR = null;
      sceneInput.lidOpen = null;
      ctx.revert();
    };
  }, [onClose]);

  const handleSkip = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    sceneInput.sealH = null;
    sceneInput.sealR = null;
    sceneInput.lidOpen = null;
    sceneInput.progress = 0;
    window.scrollTo(0, 0);
    onClose();
  };

  return (
    <div
      className="portal-fixed-stage"
      ref={stageRef}
      role="region"
      aria-label={c.caseFile}
    >
      {/* 4 Architectural Corner Callouts */}
      <div className="portal-corner portal-corner-tl mono">
        <span className="portal-corner-dot" />
        <span>PROOF-OF-GRUDGE // {c.caseFile}</span>
      </div>
      <div className="portal-corner portal-corner-tr">
        <button type="button" className="portal-skip-pill mono" onClick={handleSkip}>
          {locale === 'id' ? 'LEWATI ZOOM ↵' : 'SKIP ZOOM ↵'}
        </button>
      </div>
      <div className="portal-corner portal-corner-bl mono">
        <span>{c.testnet}</span>
      </div>
      <div className="portal-corner portal-corner-br mono">
        <span>VAULT IRIS LOCK</span>
        <strong ref={pctTextRef}>00%</strong>
      </div>

      {/* Central Mechanical Vault Combination Rings */}
      <div className="portal-vault-aperture" aria-hidden="true">
        <svg viewBox="0 0 600 600" className="portal-vault-svg">
          <g data-vault-ring-outer>
            <circle
              cx="300"
              cy="300"
              r="268"
              fill="none"
              stroke="rgba(22, 19, 13, 0.22)"
              strokeWidth="1.2"
              strokeDasharray="4 10"
            />
            <circle
              cx="300"
              cy="300"
              r="252"
              fill="none"
              stroke="rgba(22, 19, 13, 0.16)"
              strokeWidth="1"
            />
            <line x1="300" y1="22" x2="300" y2="46" stroke="var(--owner)" strokeWidth="3.5" />
            <line x1="540" y1="438" x2="518" y2="425" stroke="var(--heir)" strokeWidth="3.5" />
            <line x1="60" y1="438" x2="82" y2="425" stroke="var(--rival)" strokeWidth="3.5" />
          </g>

          <g data-vault-ring-mid>
            <circle
              cx="300"
              cy="300"
              r="210"
              fill="none"
              stroke="rgba(22, 19, 13, 0.12)"
              strokeWidth="5"
            />
            <circle
              data-vault-ring-progress
              cx="300"
              cy="300"
              r="210"
              fill="none"
              stroke="var(--rival)"
              strokeWidth="5"
              strokeLinecap="round"
              transform="rotate(-90 300 300)"
            />
          </g>

          <g data-vault-ring-inner>
            <circle
              cx="300"
              cy="300"
              r="166"
              fill="none"
              stroke="rgba(22, 19, 13, 0.28)"
              strokeWidth="1.5"
              strokeDasharray="10 8"
            />
            <polygon points="300,126 306,140 294,140" fill="var(--owner)" />
            <polygon points="450,386 436,384 442,374" fill="var(--heir)" />
            <polygon points="150,386 158,374 164,384" fill="var(--rival)" />
          </g>
        </svg>
      </div>

      {/* Left & Right Orbital 3D Coins (Zero collision with top/bottom/center) */}
      <div className="portal-orbital-field" aria-hidden="true">
        {ORBITAL_COINS.map(coin => (
          <div
            key={coin.id}
            className={`portal-orbital-slot portal-side-${coin.side}`}
            style={{ left: coin.x, top: coin.y }}
          >
            <div
              className={`portal-medallion-card portal-actor-${coin.actor}`}
              data-orbital-coin
              data-depth={coin.depth}
              data-side={coin.side}
            >
              <div className="portal-disc-3d">
                <span className="portal-disc-rim" />
                <span className="portal-disc-icon">
                  <CoinGlyph glyph={coin.glyph} />
                </span>
              </div>
              <div className="portal-disc-label">
                <span className="portal-disc-code mono">{coin.code}</span>
                <strong className="portal-disc-title">
                  {locale === 'id' ? coin.titleId : coin.titleEn}
                </strong>
                <span className="portal-disc-sub mono">
                  {locale === 'id' ? coin.subId : coin.subEn}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Center Vertical Frame: Top Header -> 3D Strongbox Keyhole -> Bottom Scroll Gauge */}
      <div className="portal-aperture-stack">
        <div className="portal-header-box" data-portal-header>
          <span className="portal-eyebrow mono">
            {locale === 'id'
              ? 'BRANKAS WARISAN · TIGA AKTOR · DUA JAMINAN'
              : 'TRI-SEAL VAULT APERTURE · THREE ACTORS · TWO BONDS'}
          </span>
          <h2 className="portal-main-heading">
            {c.headline1} <span className="actor-rival">{c.headline2}</span>
          </h2>
        </div>

        {/* Central 3D Strongbox Anchor inside the Vault Keyhole */}
        <div id="portal-scene" className="scene-anchor portal-keyhole-anchor" aria-hidden="true" />

        <div className="portal-footer-box" data-portal-footer>
          <div className="portal-zoom-meter" aria-hidden="true">
            <span className="portal-zoom-fill" ref={progressBarRef} />
          </div>
          <div className="portal-scroll-instruction mono">
            <span className="portal-scroll-mouse" aria-hidden="true">
              <i />
            </span>
            <span>
              {locale === 'id'
                ? 'GULIR UNTUK MEMBUKA SEGEL BRANKAS (ZOOM IN)'
                : 'SCROLL TO UNLOCK THE VAULT & ENTER'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
