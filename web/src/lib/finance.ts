import { NEAR } from './vaultSimulator';
export function minimumBond(assets: bigint, qPercent: bigint): bigint {
  if (assets < 0n || qPercent <= 0n || qPercent > 100n) throw new RangeError('Invalid model inputs');
  const numerator = assets * (100n - qPercent);
  return (numerator + qPercent - 1n) / qPercent;
}
export function rivalExpectedValue(bond: bigint, pPercent: bigint): bigint {
  if (bond < 0n || pPercent < 0n || pPercent > 100n) throw new RangeError('Invalid model inputs');
  return (2n * pPercent - 100n) * bond / 100n;
}
export function formatModel(value: bigint, locale: 'en' | 'id'): string {
  const scale = 1_000_000n;
  const fraction = (value % NEAR * scale / NEAR).toString().padStart(6, '0').replace(/0+$/, '');
  return `${value / NEAR}${fraction ? `${locale === 'id' ? ',' : '.'}${fraction}` : ''}`;
}
