/**
 * Formate un ratio en pourcentage français avec espace insécable avant le signe %.
 *
 * Exemples :
 *   formatPourcentage(0.5) → '50 %'
 *   formatPourcentage(0.305, 1) → '30,5 %'
 *   formatPourcentage(0) → '0 %'
 *   formatPourcentage(1.5) → '150 %'
 *
 * Utilise Intl.NumberFormat('fr-FR', { style: 'percent' }) qui produit l'espace
 * insécable (U+00A0) natif avant le signe % en locale française.
 *
 * @param ratio - nombre entre 0 et 1 (ex : 0.5 = 50 %). Accepte > 1 ou négatif.
 * @param decimales - nombre de décimales à afficher (défaut : 0)
 */
export function formatPourcentage(ratio: number, decimales = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(ratio);
}
