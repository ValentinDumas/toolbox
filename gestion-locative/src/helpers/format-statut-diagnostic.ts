import { Temporal } from '@js-temporal/polyfill';

import { formatDate } from './format-date.js';

/**
 * Formate le statut d'un diagnostic selon sa date d'expiration et la date courante.
 * - null → 'Illimitée (ERP)'
 * - dateExp < today → 'Expiré le DD/MM/YYYY'
 * - dateExp >= today → 'Valide jusqu'au DD/MM/YYYY'
 *
 * Le caller doit passer today = clock.aujourdhui() pour garantir le déterminisme.
 * DP-18 : helper preHandler injectable dans les locals EJS.
 */
export function formaterStatutDiagnostic(
  dateExp: Temporal.PlainDate | null,
  today: Temporal.PlainDate,
): string {
  if (dateExp === null) return 'Illimitée (ERP)';
  if (Temporal.PlainDate.compare(today, dateExp) > 0) {
    return 'Expiré le ' + formatDate(dateExp);
  }
  return "Valide jusqu'au " + formatDate(dateExp);
}
