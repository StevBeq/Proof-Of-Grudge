import type { Status } from '../lib/vaultSimulator';
export function SvgMonolith({ status }: { status: Status }) {
  const rings = [160, 119, 79];
  const hex = (radius: number) => Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i - Math.PI / 6;
    return `${Math.cos(a) * radius},${Math.sin(a) * radius}`;
  }).join(' ');
  return <svg viewBox="-220 -200 440 400" aria-hidden="true" className={`svg-monolith pose-${status}`}>
    <g transform="matrix(1 -.16 .22 .75 0 0)">
      {rings.map((r, i) => <g key={r} className={`svg-ring ring-${i}`}>
        <polygon points={hex(r)} transform="translate(0 13)" fill="var(--ink)" stroke="var(--line)" strokeWidth="2" />
        <path d={`M ${hex(r).replaceAll(' ', ' L ')} Z M ${hex(r - 19).replaceAll(' ', ' L ')} Z`} fill="var(--surface)" fillRule="evenodd" stroke={['var(--owner)', 'var(--heir)', 'var(--rival)'][i]} strokeWidth="2" />
      </g>)}
      <path className="core-left" d="M-30 -30H-2V30H-30Z" fill="var(--line)" stroke="var(--muted)" />
      <path className="core-right" d="M2 -30H30V30H2Z" fill="var(--line)" stroke="var(--muted)" />
      {status === 'Finalized' && <path d="M0 -23L16 0 0 23 -16 0Z" fill="var(--text)" />}
    </g>
  </svg>;
}
