import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { sceneInput } from './sceneInput';

gsap.registerPlugin(ScrollTrigger);

let activeLenis: Lenis | null = null;
let isLocked = false;

export function setSmoothScrollLocked(locked: boolean): void {
  isLocked = locked;
  if (!activeLenis) return;
  if (locked) {
    activeLenis.stop();
    activeLenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
  } else {
    activeLenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    activeLenis.start();
    ScrollTrigger.update();
  }
}

export function pauseSmoothScroll(): void {
  if (activeLenis) {
    activeLenis.stop();
  }
}

export function resumeSmoothScroll(): void {
  if (activeLenis && !isLocked) {
    activeLenis.start();
  }
}

export function resetScrollToTopImmediate(): void {
  if (activeLenis) {
    activeLenis.stop();
    activeLenis.scrollTo(0, { immediate: true, force: true });
  }
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  sceneInput.progress = 0;
  ScrollTrigger.update();
  if (activeLenis && !isLocked) {
    activeLenis.start();
  }
}

export function scrollToElementImmediate(selectorOrEl: string | HTMLElement, offset = 14): void {
  const target =
    typeof selectorOrEl === 'string'
      ? document.querySelector<HTMLElement>(selectorOrEl)
      : selectorOrEl;
  if (!target) return;
  const topbar = document.querySelector<HTMLElement>('.topbar');
  const topbarH = topbar ? topbar.offsetHeight : 94;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - topbarH - offset);
  if (activeLenis) {
    activeLenis.scrollTo(top, { immediate: true, force: true });
  }
  window.scrollTo(0, top);
  ScrollTrigger.update();
}

export function scrollToElementSmooth(
  selectorOrEl: string | HTMLElement,
  onComplete?: () => void,
  offset = 14,
): void {
  const target =
    typeof selectorOrEl === 'string'
      ? document.querySelector<HTMLElement>(selectorOrEl)
      : selectorOrEl;
  if (!target) return;
  const topbar = document.querySelector<HTMLElement>('.topbar');
  const topbarH = topbar ? topbar.offsetHeight : 94;
  const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - topbarH - offset);
  if (activeLenis) {
    activeLenis.scrollTo(top, {
      duration: 0.85,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      onComplete,
    });
  } else {
    window.scrollTo({ top, behavior: 'smooth' });
    if (onComplete) {
      window.setTimeout(onComplete, 750);
    }
  }
}

export function startSceneLoop(frame: (seconds: number) => void, reduced: boolean) {
  const lenis = reduced ? null : new Lenis({ autoRaf: false, lerp: 0.1, anchors: true });
  activeLenis = lenis;
  if (lenis && isLocked) {
    lenis.stop();
  }
  lenis?.on('scroll', ScrollTrigger.update);
  const scroll = () => {
    sceneInput.progress =
      window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  };
  const pointer = (event: PointerEvent) => {
    sceneInput.pointerX = event.clientX / window.innerWidth - 0.5;
    sceneInput.pointerY = event.clientY / window.innerHeight - 0.5;
  };
  const ticker = (seconds: number) => {
    if (document.hidden) return;
    if (!isLocked) {
      lenis?.raf(seconds * 1000);
    }
    frame(seconds);
  };
  const visibility = () => {
    if (document.hidden) {
      lenis?.stop();
    } else {
      if (!isLocked) lenis?.start();
      scroll();
    }
  };
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(ticker);
  window.addEventListener('scroll', scroll, { passive: true });
  window.addEventListener('pointermove', pointer, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  let alive = true;
  void document.fonts.ready.then(() => {
    if (alive) ScrollTrigger.refresh();
  });
  scroll();
  return () => {
    alive = false;
    gsap.ticker.remove(ticker);
    lenis?.destroy();
    if (activeLenis === lenis) {
      activeLenis = null;
    }
    window.removeEventListener('scroll', scroll);
    window.removeEventListener('pointermove', pointer);
    document.removeEventListener('visibilitychange', visibility);
  };
}
