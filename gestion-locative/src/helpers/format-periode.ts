import { Temporal } from '@js-temporal/polyfill';

/**
 * Formate une PlainDate en période lisible française : "mai 2026".
 *
 * Note : Intl.DateTimeFormat avec fr-FR peut inclure un U+00A0 (espace insécable)
 * entre le mois et l'année selon le runtime. Utiliser .toMatch() dans les tests.
 */
export function formatPeriode(date: Temporal.PlainDate): string {
  const dt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  // Construire une date JS compatible
  const jsDate = new Date(date.year, date.month - 1, 1);
  return dt.format(jsDate);
}
