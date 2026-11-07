import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { sceneInput } from './sceneInput';
gsap.registerPlugin(ScrollTrigger);
export function startSceneLoop(frame: (seconds: number) => void, reduced: boolean) {
  const lenis = reduced ? null : new Lenis({ autoRaf: false, lerp: .1, anchors: true });
  lenis?.on('scroll', ScrollTrigger.update);
  const scroll = () => {
    sceneInput.progress = window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  const pointer = (event: PointerEvent) => {
    sceneInput.pointerX = event.clientX / window.innerWidth - .5;
    sceneInput.pointerY = event.clientY / window.innerHeight - .5;
  };
  const ticker = (seconds: number) => {
    if (document.hidden) return;
    lenis?.raf(seconds * 1000); frame(seconds);
  };
  const visibility = () => { if (document.hidden) lenis?.stop(); else { lenis?.start(); scroll(); } };
  gsap.ticker.lagSmoothing(0); gsap.ticker.add(ticker);
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('pointermove', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  let alive = true;
  void document.fonts.ready.then(() => { if (alive) ScrollTrigger.refresh(); });
  scroll();
  return () => {
    alive = false; gsap.ticker.remove(ticker); lenis?.destroy();
    window.removeEventListener('scroll', scroll); window.removeEventListener('pointermove', pointer);
    document.removeEventListener('visibilitychange', visibility);
  };
}
