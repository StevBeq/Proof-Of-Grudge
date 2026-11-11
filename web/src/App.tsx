import { useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { copies } from './lib/copy';
import type { Locale } from './lib/copy';
import type { Outcome, Role, Status } from './lib/vaultSimulator';
import { sceneInput } from './lib/sceneInput';
import {
  resetScrollToTopImmediate,
  scrollToElementImmediate,
  scrollToElementSmooth,
  setSmoothScrollLocked,
} from './lib/smoothScroll';
import { MonolithCanvas } from './scene/MonolithCanvas';
import { CaseCurtain } from './sections/CaseCurtain';
import { Hero } from './sections/Hero';
import { Dossier } from './sections/Dossier';
import type { DossierSelection } from './sections/Dossier';
import { Mechanism } from './sections/Mechanism';
import type { MechanismStep } from './sections/Mechanism';
import { Outcomes } from './sections/Outcomes';
import { Cockpit } from './sections/Cockpit';
import { BondLab } from './sections/BondLab';
import { Limits } from './sections/Limits';
import { FooterLoop } from './sections/FooterLoop';

gsap.registerPlugin(ScrollTrigger);

function savedLocale(): Locale {
  try { return localStorage.getItem('pog-language') === 'id' ? 'id' : 'en'; } catch { return 'en'; }
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(savedLocale);
  const [status, setStatus] = useState<Status>('Idle');
  const [cockpitRole, setCockpitRole] = useState<Role>('heir');
  const [mechanismStep, setMechanismStep] = useState<MechanismStep | null>(null);
  const [scenarioRequest, setScenarioRequest] = useState<{ id: number; outcome: Outcome } | null>(null);
  const [curtain, setCurtain] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [cockpitEntered, setCockpitEntered] = useState(false);
  const isNavigatingRef = useRef(false);
  const teleportRef = useRef<HTMLDivElement>(null);
  const c = copies[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'Proof-of-Grudge | An inheritance with opposition' : 'Proof-of-Grudge | Warisan dengan perlawanan';
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute('content', c.intro);
    try { localStorage.setItem('pog-language', locale); } catch { /* Preference remains usable when storage is unavailable. */ }
  }, [locale, c]);

  useEffect(() => {
    if (curtain) {
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      setSmoothScrollLocked(true);
      resetScrollToTopImmediate();
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }

    // Keep Lenis locked and absorb leftover wheel inertia for 550ms after CaseCurtain closes
    // so the user ALWAYS lands on Hero (Section 0) at scrollY = 0 and never skips to Dossier (Section 1).
    document.body.style.overflow = '';
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setSmoothScrollLocked(true);
    resetScrollToTopImmediate();

    const absorbWheel = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('wheel', absorbWheel, { passive: false, capture: true });
    window.addEventListener('touchmove', absorbWheel, { passive: false, capture: true });

    let refreshTimer: number | null = null;
    const releaseTimer = window.setTimeout(() => {
      window.removeEventListener('wheel', absorbWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener('touchmove', absorbWheel, { capture: true } as EventListenerOptions);
      setSmoothScrollLocked(false);

      // Defer ScrollTrigger.refresh until Hero entrance tweens (0.65s) have settled cleanly
      refreshTimer = window.setTimeout(() => {
        ScrollTrigger.refresh();
      }, 250);
    }, 450);

    return () => {
      window.clearTimeout(releaseTimer);
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
      window.removeEventListener('wheel', absorbWheel, { capture: true } as EventListenerOptions);
      window.removeEventListener('touchmove', absorbWheel, { capture: true } as EventListenerOptions);
    };
  }, [curtain]);

  const triggerCockpitTeleport = useCallback(() => {
    setCockpitEntered(true);
    const overlay = teleportRef.current;
    const cockpitEl = document.getElementById('cockpit');
    if (!cockpitEl) return;

    if (!overlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scrollToElementImmediate(cockpitEl);
      return;
    }

    const leftDoor = overlay.querySelector<HTMLElement>('[data-teleport-left]');
    const rightDoor = overlay.querySelector<HTMLElement>('[data-teleport-right]');
    const badge = overlay.querySelector<HTMLElement>('[data-teleport-badge]');
    if (!leftDoor || !rightDoor || !badge) {
      scrollToElementImmediate(cockpitEl);
      return;
    }

    const absorb = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('wheel', absorb, { passive: false, capture: true });
    window.addEventListener('touchmove', absorb, { passive: false, capture: true });

    gsap.killTweensOf([overlay, leftDoor, rightDoor, badge]);
    gsap.set(overlay, { visibility: 'visible' });
    gsap.set(leftDoor, { xPercent: -100 });
    gsap.set(rightDoor, { xPercent: 100 });
    gsap.set(badge, { scale: 0.6, opacity: 0 });

    const tl = gsap.timeline({
      onComplete: () => {
        window.removeEventListener('wheel', absorb, { capture: true } as EventListenerOptions);
        window.removeEventListener('touchmove', absorb, { capture: true } as EventListenerOptions);
        gsap.set(overlay, { visibility: 'hidden' });
      },
    });

    // 1. Slam split vault doors shut
    tl.to(leftDoor, { xPercent: 0, duration: 0.34, ease: 'expo.in' }, 0);
    tl.to(rightDoor, { xPercent: 0, duration: 0.34, ease: 'expo.in' }, 0);
    tl.to(badge, { scale: 1, opacity: 1, duration: 0.24, ease: 'back.out(1.6)' }, 0.18);

    // 2. Teleport scroll directly to #cockpit while doors are shut
    tl.add(() => {
      scrollToElementImmediate(cockpitEl);
      const shell = cockpitEl.querySelector<HTMLElement>('.cockpit-shell');
      if (shell) {
        gsap.fromTo(
          shell,
          { scale: 0.94, opacity: 0.5 },
          { scale: 1, opacity: 1, duration: 0.55, ease: 'expo.out' },
        );
      }
    }, 0.42);

    // 3. Part vault doors open to reveal the Cockpit
    tl.to(badge, { scale: 1.25, opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.52);
    tl.to(leftDoor, { xPercent: -100, duration: 0.46, ease: 'expo.out' }, 0.56);
    tl.to(rightDoor, { xPercent: 100, duration: 0.46, ease: 'expo.out' }, 0.56);
  }, []);

  useEffect(() => {
    // Chapter 04 -> cockpit: wait until the divider hits the viewport top ("mentok"),
    // then fill the button from 0% to 100% AND animate the 3-column Hearing Room
    // telemetry rails, spacious strongbox dial, and 3D strongbox seals.
    if (curtain) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const track = document.querySelector<HTMLElement>('.chapter-divider-track');
    const fill = document.querySelector<HTMLElement>('.divider-fill');
    const btn = document.querySelector<HTMLElement>('.divider-fill-btn');
    const pctEl = document.querySelector<HTMLElement>('[data-divider-pct]');
    const stageLabelEl = document.querySelector<HTMLElement>('[data-divider-stage-label]');
    const dialOuter = document.querySelector<SVGElement>('[data-divider-dial-outer]');
    const dialInner = document.querySelector<SVGElement>('[data-divider-dial-inner]');
    const progressCircle = document.querySelector<SVGCircleElement>('[data-divider-ring-progress]');
    const cards = gsap.utils.toArray<HTMLElement>('[data-divider-card]');
    const cardFills = gsap.utils.toArray<HTMLElement>('[data-divider-card-fill]');

    if (!track || !fill || !btn) return;

    let jumped = false;
    const circumference = 2 * Math.PI * 156; // r = 156 -> ~980.18
    fill.style.width = '0%';
    btn.dataset.full = '0';
    if (progressCircle) {
      progressCircle.style.strokeDasharray = `${circumference}`;
      progressCircle.style.strokeDashoffset = `${circumference}`;
    }

    const resetDividerScene = () => {
      sceneInput.sealH = null;
      sceneInput.sealR = null;
      sceneInput.lidOpen = null;
      sceneInput.roleFocus = null;
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.25,
        onLeaveBack: () => {
          jumped = false;
          fill.style.width = '0%';
          btn.dataset.full = '0';
          if (pctEl) pctEl.textContent = '00%';
          resetDividerScene();
        },
        onLeave: () => {
          resetDividerScene();
        },
        onUpdate: self => {
          const p = self.progress;
          if (p <= 0.15) {
            jumped = false;
          }
          const pct = Math.round(p * 100);
          if (pctEl) {
            pctEl.textContent = `${String(pct).padStart(2, '0')}%`;
          }
          if (stageLabelEl) {
            if (p < 0.34) {
              stageLabelEl.textContent =
                locale === 'id'
                  ? 'TAHAP 01 · DETAK PEMILIK'
                  : 'PHASE 01 · OWNER HEARTBEAT';
            } else if (p < 0.68) {
              stageLabelEl.textContent =
                locale === 'id'
                  ? 'TAHAP 02 · SEGEL H & R TERKUNCI'
                  : 'PHASE 02 · SEALS H & R LOCKED';
            } else {
              stageLabelEl.textContent =
                locale === 'id'
                  ? 'TAHAP 03 · RUANG SIDANG TERBUKA'
                  : 'PHASE 03 · HEARING ROOM UNLOCKED';
            }
          }

          // Sequential highlight & meter fill for the 4 side telemetry cards (0-25%, 25-50%, 50-75%, 75-100%)
          cards.forEach((card, idx) => {
            const start = idx * 0.23;
            const localP = Math.max(0, Math.min(1, (p - start) / 0.26));
            card.dataset.active = localP > 0.05 ? '1' : '0';
            if (cardFills[idx]) {
              cardFills[idx].style.width = `${Math.round(localP * 100)}%`;
            }
          });

          // Couple scroll progress directly to the 3D Strongbox in #divider-scene
          if (p > 0.02 && p < 0.98) {
            sceneInput.sealH = p >= 0.25 ? 1 : 0;
            sceneInput.sealR = p >= 0.52 ? 1 : 0;
            sceneInput.lidOpen = p >= 0.72 ? Math.min(0.9, (p - 0.72) * 3.1) : 0;
            sceneInput.roleFocus = p < 0.34 ? 'owner' : p < 0.68 ? 'heir' : 'rival';
            sceneInput.progress = p;
          }

          btn.dataset.full = p >= 0.98 ? '1' : '0';
          if (self.direction === 1 && !isNavigatingRef.current && p >= 0.985 && !jumped) {
            jumped = true;
            resetDividerScene();
            setCockpitEntered(true);
            triggerCockpitTeleport();
          }
        },
      },
    });

    tl.fromTo(fill, { width: '0%' }, { width: '100%', ease: 'none', duration: 1 }, 0);

    if (progressCircle) {
      tl.fromTo(
        progressCircle,
        { strokeDashoffset: circumference },
        { strokeDashoffset: 0, ease: 'none', duration: 1 },
        0,
      );
    }

    if (dialOuter) {
      tl.fromTo(
        dialOuter,
        { rotate: 0, transformOrigin: '50% 50%' },
        { rotate: 180, ease: 'none', duration: 1 },
        0,
      );
    }

    if (dialInner) {
      tl.fromTo(
        dialInner,
        { rotate: 0, transformOrigin: '50% 50%' },
        { rotate: -140, ease: 'none', duration: 1 },
        0,
      );
    }

    return () => {
      resetDividerScene();
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [curtain, locale, triggerCockpitTeleport]);

  useEffect(() => {
    if (curtain) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      // Variety 1: headline split reveal (words rise + slight rotate)
      gsap.utils.toArray<HTMLElement>('.hero-copy h1, .section-heading h2, .chapter-divider h2').forEach(el => {
        if (el.children.length > 0) { gsap.from(el, { yPercent: 25, rotateX: -12, autoAlpha: 0, duration: .65, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }); return; } const words = el.textContent?.trim().split(/\s+/) ?? [];
        if (!words.length) return;
        el.innerHTML = words.map(w => '<span class="hl-word" aria-hidden="true">' + w + '</span>').join(' ');
        gsap.from(el.querySelectorAll('.hl-word'), {
          yPercent: 60, rotateX: -35, autoAlpha: 0, duration: 0.55, ease: 'power3.out', stagger: 0.045,
          scrollTrigger: { trigger: el, start: 'top 88%' },
        });
      });
      // Variety 2: round-stamp slam
      gsap.utils.toArray<HTMLElement>('.round-stamp').forEach(el => {
        gsap.from(el, { scale: 2.2, rotate: 8, autoAlpha: 0, duration: 0.4, ease: 'power4.in', scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
      // Variety 3: chapter marks slide from left
      gsap.utils.toArray<HTMLElement>('.chapter-mark').forEach(el => {
        gsap.from(el, { x: -34, autoAlpha: 0, duration: 0.6, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } });
      });
      // Variety 4: default gentle rise
      gsap.utils.toArray<HTMLElement>('.reveal').forEach(el => {
        gsap.from(el, { y: 26, autoAlpha: 0, duration: 0.65, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
      });
    });
    return () => ctx.revert();
  }, [curtain]);

  const onScene = useCallback((next: Status, outcome: Outcome) => {
    sceneInput.status = next;
    sceneInput.outcome = outcome;
    setStatus(next);
  }, []);

  const handleDossier = useCallback((selection: DossierSelection) => {
    setCockpitRole(selection.role);
    setMechanismStep(null);
    sceneInput.roleFocus = selection.focus;
    sceneInput.sealH = null;
    sceneInput.sealR = null;
    sceneInput.lidOpen = null;
  }, []);

  const handleMechanism = useCallback((step: MechanismStep | null) => {
    setMechanismStep(step);
    if (step === 0) {
      sceneInput.roleFocus = 'heir';
      sceneInput.sealH = 1;
      sceneInput.sealR = 0;
      sceneInput.lidOpen = 0;
    } else if (step === 1) {
      sceneInput.roleFocus = 'rival';
      sceneInput.sealH = 1;
      sceneInput.sealR = 1;
      sceneInput.lidOpen = 0;
    } else if (step === 2) {
      sceneInput.roleFocus = 'owner';
      sceneInput.sealH = 0;
      sceneInput.sealR = 0;
      sceneInput.lidOpen = 0;
    } else {
      sceneInput.roleFocus = null;
      sceneInput.sealH = null;
      sceneInput.sealR = null;
      sceneInput.lidOpen = null;
    }
  }, []);

  const handlePlay = useCallback((outcome: Exclude<Outcome, 'None'>) => {
    setMechanismStep(null);
    sceneInput.roleFocus = null;
    sceneInput.sealH = null;
    sceneInput.sealR = null;
    sceneInput.lidOpen = null;
    setScenarioRequest({ id: Date.now(), outcome });
    window.setTimeout(() => {
      triggerCockpitTeleport();
    }, 60);
  }, [triggerCockpitTeleport]);

  const handleLoopToTop = useCallback(() => {
    sceneInput.sealH = null;
    sceneInput.sealR = null;
    sceneInput.lidOpen = null;
    sceneInput.roleFocus = null;
    sceneInput.progress = 0;
    setSmoothScrollLocked(true);
    resetScrollToTopImmediate();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurtain(true);
    } else {
      setSmoothScrollLocked(false);
    }
  }, []);

  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
      e.preventDefault();
      const target = document.getElementById(targetId);
      if (!target) return;

      isNavigatingRef.current = true;
      window.history.pushState(null, '', `#${targetId}`);

      if (targetId === 'cockpit') {
        setCockpitEntered(true);
      }

      scrollToElementSmooth(target, () => {
        isNavigatingRef.current = false;
        ScrollTrigger.update();
      });
    },
    [],
  );

  return <div data-curtain-open={curtain ? '1' : '0'}>
    {curtain && <div className="portal-backdrop" aria-hidden="true" />}

    {/* Vault Door Teleport Overlay (Chapter 04 -> Cockpit) */}
    <div className="cockpit-teleport-overlay" ref={teleportRef} aria-hidden="true">
      <div className="teleport-door teleport-door-left" data-teleport-left />
      <div className="teleport-door teleport-door-right" data-teleport-right />
      <div className="teleport-seal-badge" data-teleport-badge>
        <span className="mono">04 // SEAL LOCK 100%</span>
        <strong>{locale === 'id' ? 'MASUK KE RUANG SIDANG' : 'ENTERING HEARING ROOM'}</strong>
      </div>
    </div>

    <a className="skip-link" href="#cockpit" onClick={e => handleNavClick(e, 'cockpit')}>{c.skip}</a>
    <header className="topbar">
      <a href="#hero" className="wordmark" onClick={e => handleNavClick(e, 'hero')}>Proof-of-Grudge<span className="wordmark-symbol" aria-hidden="true"><i /><i /><i /></span></a>
      <p className="topbar-case caption">{c.caseFile}</p>
      <nav aria-label={locale === 'en' ? 'Main navigation' : 'Navigasi utama'}>
        <a href="#mechanism" onClick={e => handleNavClick(e, 'mechanism')}>{c.mechanism}</a>
        <a href="#dossier" onClick={e => handleNavClick(e, 'dossier')}>{c.dossier}</a>
        <a href="#outcomes" onClick={e => handleNavClick(e, 'outcomes')}>{c.outcomes}</a>
        <a href="#limits" onClick={e => handleNavClick(e, 'limits')}>{c.limits}</a>
        <a href="#cockpit" className="nav-cockpit" onClick={e => handleNavClick(e, 'cockpit')}>{c.cockpit}</a>
      </nav>
      <div className="language-toggle" role="group" aria-label={c.language}>
        <button type="button" lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        <span aria-hidden="true">/</span>
        <button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={locale === 'id'} onClick={() => setLocale('id')}>ID</button>
      </div>
    </header>
    <MonolithCanvas status={status} />
    {curtain && <CaseCurtain c={c} locale={locale} onClose={() => setCurtain(false)} />}
    <main>
      <Hero c={c} />
      <Dossier c={c} role={cockpitRole} onSelect={handleDossier} />
      <Mechanism c={c} step={mechanismStep} onSelect={handleMechanism} />
      <Outcomes c={c} onPlay={handlePlay} />
      <div className="chapter-divider-track">
        <section className="chapter-divider" aria-label={c.chapterDivider}>
          <div className="divider-grid">
            {/* Left Telemetry Rail (01 Owner & 02 Heir) */}
            <div className="divider-rail divider-rail-left" aria-hidden="true">
              <div className="divider-telemetry-card divider-card-owner" data-divider-card data-active="1">
                <div className="divider-card-top">
                  <span className="divider-coin-badge">O</span>
                  <div className="divider-card-headings">
                    <strong className="mono">01 · {c.owner}</strong>
                    <span className="mono">check_in() Heartbeat</span>
                  </div>
                </div>
                <div className="divider-card-meter">
                  <span data-divider-card-fill style={{ width: '0%' }} />
                </div>
              </div>

              <div className="divider-telemetry-card divider-card-heir" data-divider-card data-active="0">
                <div className="divider-card-top">
                  <span className="divider-coin-badge">H</span>
                  <div className="divider-card-headings">
                    <strong className="mono">02 · {c.heir}</strong>
                    <span className="mono">Bond H = 1 NEAR</span>
                  </div>
                </div>
                <div className="divider-card-meter">
                  <span data-divider-card-fill style={{ width: '0%' }} />
                </div>
              </div>
            </div>

            {/* Center Column: Title -> Spacious Dial & 3D Strongbox -> Button -> Caption */}
            <div className="divider-core">
              <p className="case-kicker">{c.chapterDivider}</p>
              <div className="divider-header-row">
                <span className="chapter-mark mono" aria-hidden="true">04</span>
                <h2>{c.cockpit}</h2>
              </div>

              {/* Spacious 340x340 Dial Frame with 185x185 #divider-scene inside so 3D coins & envelope never touch the ring */}
              <div className="divider-dial-frame">
                <svg className="divider-dial-svg" viewBox="0 0 340 340" aria-hidden="true">
                  <g data-divider-dial-outer>
                    <circle cx="170" cy="170" r="164" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 8" opacity="0.4" />
                    <line x1="170" y1="2" x2="170" y2="18" stroke="var(--owner)" strokeWidth="3.5" />
                    <line x1="338" y1="170" x2="322" y2="170" stroke="var(--heir)" strokeWidth="3.5" />
                    <line x1="170" y1="338" x2="170" y2="322" stroke="var(--rival)" strokeWidth="3.5" />
                    <line x1="2" y1="170" x2="18" y2="170" stroke="var(--ink)" strokeWidth="2.5" />
                  </g>
                  <g data-divider-dial-inner>
                    <circle cx="170" cy="170" r="138" fill="none" stroke="currentColor" strokeWidth="1.1" strokeDasharray="6 8" opacity="0.3" />
                  </g>
                  <circle
                    cx="170"
                    cy="170"
                    r="156"
                    fill="none"
                    stroke="rgba(22, 19, 13, 0.12)"
                    strokeWidth="5"
                  />
                  <circle
                    data-divider-ring-progress
                    cx="170"
                    cy="170"
                    r="156"
                    fill="none"
                    stroke="var(--rival)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    transform="rotate(-90 170 170)"
                  />
                </svg>
                <div id="divider-scene" className="scene-anchor divider-scene-anchor" aria-hidden="true" />
              </div>

              <div className="divider-status-bar mono">
                <span data-divider-stage-label>
                  {locale === 'id'
                    ? 'TAHAP 01 · DETAK PEMILIK'
                    : 'PHASE 01 · OWNER HEARTBEAT'}
                </span>
                <strong className="divider-pct-badge" data-divider-pct>00%</strong>
              </div>

              <a
                className="button-primary divider-fill-btn"
                href="#cockpit"
                data-full="0"
                onClick={e => {
                  e.preventDefault();
                  triggerCockpitTeleport();
                }}
              >
                <span className="divider-fill" aria-hidden="true" />
                {c.open}
              </a>
              <p className="caption divider-caption">
                {locale === 'id'
                  ? 'Terus gulir hingga segel 100% penuh untuk membuka ruang sidang.'
                  : 'Keep scrolling until the seal reaches 100% to unlock the hearing room.'}
              </p>
            </div>

            {/* Right Telemetry Rail (03 Rival & 04 Verdict) */}
            <div className="divider-rail divider-rail-right" aria-hidden="true">
              <div className="divider-telemetry-card divider-card-rival" data-divider-card data-active="0">
                <div className="divider-card-top">
                  <span className="divider-coin-badge">R</span>
                  <div className="divider-card-headings">
                    <strong className="mono">03 · {c.rival}</strong>
                    <span className="mono">Bond R = 1 NEAR</span>
                  </div>
                </div>
                <div className="divider-card-meter">
                  <span data-divider-card-fill style={{ width: '0%' }} />
                </div>
              </div>

              <div className="divider-telemetry-card divider-card-verdict" data-divider-card data-active="0">
                <div className="divider-card-top">
                  <span className="divider-coin-badge">2B</span>
                  <div className="divider-card-headings">
                    <strong className="mono">04 · {locale === 'id' ? 'PUTUSAN' : 'VERDICT'}</strong>
                    <span className="mono">MPC / 2B Pool</span>
                  </div>
                </div>
                <div className="divider-card-meter">
                  <span data-divider-card-fill style={{ width: '0%' }} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      <Cockpit c={c} locale={locale} onScene={onScene} role={cockpitRole} onRoleChange={setCockpitRole} scenarioRequest={scenarioRequest} entered={cockpitEntered} />
      <BondLab c={c} locale={locale} />
      <Limits c={c} />
    </main>
    <FooterLoop c={c} locale={locale} onLoopToTop={handleLoopToTop} />
  </div>;
}
