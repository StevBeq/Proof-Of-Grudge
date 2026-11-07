import type { Copy } from '../lib/copy';
export function Outcomes({ c }: { c: Copy }) {
  const rows = [
    { name: c.falseAlarm, what: c.falseWhat, assets: c.staysOwner, bonds: c.bondOwner, actor: 'owner' },
    { name: c.busted, what: c.bustedWhat, assets: c.staysOwner, bonds: c.bondRival, actor: 'rival' },
    { name: c.uncontested, what: c.uncontestedWhat, assets: c.creditHeir, bonds: c.bondHeir, actor: 'heir' },
    { name: c.spiteBackfired, what: c.spiteWhat, assets: c.creditHeir, bonds: c.bondsHeir, actor: 'heir' },
  ];
  return <section id="outcomes" className="section outcomes-section" aria-labelledby="outcomes-title"><h2 id="outcomes-title">{c.outcomesTitle}</h2><div className="outcome-table-wrap" tabIndex={0} role="region" aria-label={c.outcomes}><table className="outcome-table"><thead><tr><th scope="col">{c.outcome}</th><th scope="col">{c.what}</th><th scope="col">{c.assets}</th><th scope="col">{c.bonds}</th></tr></thead><tbody>{rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{row.what}</td><td>{row.assets}</td><td className={`actor-${row.actor}`}>{row.bonds}</td></tr>)}</tbody></table></div><p className="caption table-note">H = R = B. {c.pullNote}</p></section>;
}
