import type { Copy } from '../lib/copy';
export function Limits({ c }: { c: Copy }) {
  return <section className="section limits-section" id="limits" aria-labelledby="limits-title"><h2 id="limits-title">{c.limitsTitle}</h2><div><ul className="limits-list">{[c.limit1, c.limit2, c.limit3, c.limit4].map(limit => <li key={limit}>{limit}</li>)}</ul><p className="comparison">{c.comparison}</p></div></section>;
}
