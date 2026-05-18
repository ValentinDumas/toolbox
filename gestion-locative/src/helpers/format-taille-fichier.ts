/**
 * Formate une taille en octets en unités lisibles (FR locale, virgule décimale).
 *   < 1024            → "X octets"
 *   < 1024^2          → "X,Y ko"
 *   < 1024^3          → "X,Y Mo"
 *   sinon             → "X,Y Go"
 * Précision : 1 décimale.
 */
export function formaterTailleFichier(octets: number): string {
  const KO = 1024;
  const MO = 1024 * 1024;
  const GO = 1024 * 1024 * 1024;
  const nf = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  if (octets < KO) return `${octets} octets`;
  if (octets < MO) return `${nf.format(octets / KO)} ko`;
  if (octets < GO) return `${nf.format(octets / MO)} Mo`;
  return `${nf.format(octets / GO)} Go`;
}
