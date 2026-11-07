import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { formatNear } from '../lib/vaultSimulator';
/** Only the interpolation fraction is floating-point; monetary arithmetic stays bigint. */
export function Amount({ value, animate = true }: { value: bigint; animate?: boolean }) {
  const node = useRef<HTMLSpanElement>(null); const previous = useRef(value);
  useEffect(() => {
    const from = previous.current; previous.current = value;
    const write = (n: bigint) => { if (node.current) node.current.textContent = formatNear(n); };
    if (!animate || from === value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { write(value); return; }
    const progress = { fraction: 0 };
    const tween = gsap.to(progress, {
      fraction: 1, duration: .35, ease: 'expo.out',
      onUpdate: () => write(from + (value - from) * BigInt(Math.round(progress.fraction * 1_000_000)) / 1_000_000n),
      onComplete: () => write(value),
    });
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => { if (query.matches) { tween.kill(); write(value); } };
    query.addEventListener('change', stop);
    return () => { tween.kill(); query.removeEventListener('change', stop); };
  }, [value, animate]);
  return <span ref={node} aria-label={formatNear(value)} />;
}
