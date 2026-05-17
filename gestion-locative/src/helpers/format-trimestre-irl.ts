/**
 * Formate un trimestre canonique IRL ("YYYY-TN") en français lisible.
 * Ex : "2026-T1" → "1er trimestre 2026", "2026-T2" → "2e trimestre 2026".
 * Fallback non destructif : retourne l'entrée si elle ne matche pas le format.
 *
 * Phase 3 — DP-18 : 5e helper de format français (après formatDate, formatMoney,
 * formatPeriode, formaterClasseDpe).
 */
export function formaterTrimestreIRL(trimestre: string): string {
  const match = /^(\d{4})-T([1-4])$/.exec(trimestre);
  if (!match) return trimestre;
  const [, year, n] = match;
  const suffixe = n === '1' ? 'er' : 'e';
  return `${n}${suffixe} trimestre ${year}`;
}
