import { useCallback, useEffect, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { copies } from './lib/copy';
import type { Locale } from './lib/copy';
import type { Outcome, Role, Status } from './lib/vaultSimulator';
import { sceneInput } from './lib/sceneInput';
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
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    document.body.style.overflow = '';
  }, [curtain]);

  useEffect(() => {
    if (curtain) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const elements = gsap.utils.toArray<HTMLElement>('.reveal');
    const tweens = elements.map(element =>
      gsap.from(element, {
        y: 28,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: element, start: 'top 88%' },
      }),
    );
    return () => {
      tweens.forEach(tween => tween.scrollTrigger?.kill());
      tweens.forEach(tween => tween.kill());
    };
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
      document.getElementById('cockpit')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }, 60);
  }, []);

  return <div>
    {curtain && <CaseCurtain c={c} onClose={() => setCurtain(false)} />}
    <a className="skip-link" href="#cockpit">{c.skip}</a>
    <header className="topbar">
      <a href="#hero" className="wordmark">Proof-of-Grudge<span className="wordmark-symbol" aria-hidden="true"><i /><i /><i /></span></a>
      <p className="topbar-case caption">{c.caseFile}</p>
      <nav aria-label={locale === 'en' ? 'Main navigation' : 'Navigasi utama'}>
        <a href="#mechanism">{c.mechanism}</a>
        <a href="#dossier">{c.dossier}</a>
        <a href="#outcomes">{c.outcomes}</a>
        <a href="#limits">{c.limits}</a>
        <a href="#cockpit" className="nav-cockpit">{c.cockpit}</a>
      </nav>
      <div className="language-toggle" role="group" aria-label={c.language}>
        <button type="button" lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        <span aria-hidden="true">/</span>
        <button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={locale === 'id'} onClick={() => setLocale('id')}>ID</button>
      </div>
    </header>
    <MonolithCanvas status={status} />
    <main>
      <Hero c={c} />
      <Dossier c={c} role={cockpitRole} onSelect={handleDossier} />
      <Mechanism c={c} step={mechanismStep} onSelect={handleMechanism} />
      <Outcomes c={c} onPlay={handlePlay} />
      <Cockpit c={c} locale={locale} onScene={onScene} role={cockpitRole} onRoleChange={setCockpitRole} scenarioRequest={scenarioRequest} />
      <BondLab c={c} locale={locale} />
      <Limits c={c} />
    </main>
    <footer className="footer section">
      <a href="#hero" className="wordmark">Proof-of-Grudge</a>
      <p>{c.footer}</p>
      <p className="caption">{c.footerNote}</p>
    </footer>
  </div>;
}
