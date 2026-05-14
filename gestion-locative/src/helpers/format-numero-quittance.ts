/**
 * Formate un numéro de quittance en AAAA-NNN (D-64).
 * Séquence padded à 3 chiffres minimum (ex : 1 → "001", 1000 → "1000").
 */
export function formatNumeroQuittance(annee: number, sequence: number): string {
  return `${annee}-${String(sequence).padStart(3, '0')}`;
}
