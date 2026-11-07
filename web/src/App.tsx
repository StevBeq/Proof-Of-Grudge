import { useCallback, useEffect, useState } from 'react';
import { copies } from './lib/copy';
import type { Locale } from './lib/copy';
import type { Outcome, Status } from './lib/vaultSimulator';
import { sceneInput } from './lib/sceneInput';
import { MonolithCanvas } from './scene/MonolithCanvas';
import { Hero } from './sections/Hero';
import { Mechanism } from './sections/Mechanism';
import { Outcomes } from './sections/Outcomes';
import { Cockpit } from './sections/Cockpit';
import { BondLab } from './sections/BondLab';
import { Limits } from './sections/Limits';
function savedLocale(): Locale {
  try { return localStorage.getItem('pog-language') === 'id' ? 'id' : 'en'; } catch { return 'en'; }
}
export default function App() {
  const [locale, setLocale] = useState<Locale>(savedLocale);
  const [status, setStatus] = useState<Status>('Idle'); const c = copies[locale];
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'en' ? 'Proof-of-Grudge | An inheritance with opposition' : 'Proof-of-Grudge | Warisan dengan perlawanan';
    const description = document.querySelector('meta[name="description"]'); description?.setAttribute('content', c.intro);
    try { localStorage.setItem('pog-language', locale); } catch { /* Preference remains usable when storage is unavailable. */ }
  }, [locale, c]);
  const onScene = useCallback((next: Status, outcome: Outcome) => {
    sceneInput.status = next; sceneInput.outcome = outcome; setStatus(next);
  }, []);
  return <>
    <a className="skip-link" href="#cockpit">{c.skip}</a>
    <header className="topbar"><a href="#hero" className="wordmark">Proof-of-Grudge<span className="wordmark-symbol" aria-hidden="true"><i /><i /><i /></span></a><nav aria-label={locale === 'en' ? 'Main navigation' : 'Navigasi utama'}><a href="#mechanism">{c.mechanism}</a><a href="#outcomes">{c.outcomes}</a><a href="#limits">{c.limits}</a><a href="#cockpit" className="nav-cockpit">{c.cockpit}</a></nav><div className="language-toggle" role="group" aria-label={c.language}><button type="button" lang="en" aria-label="English" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button><span aria-hidden="true">/</span><button type="button" lang="id" aria-label="Bahasa Indonesia" aria-pressed={locale === 'id'} onClick={() => setLocale('id')}>ID</button></div></header>
    <MonolithCanvas status={status} />
    <main><Hero c={c} /><Mechanism c={c} /><Outcomes c={c} /><Cockpit c={c} locale={locale} onScene={onScene} /><BondLab c={c} locale={locale} /><Limits c={c} /></main>
    <footer className="footer section"><a href="#hero" className="wordmark">Proof-of-Grudge</a><p>{c.footer}</p><p className="caption">{c.footerNote}</p></footer>
  </>;
}
