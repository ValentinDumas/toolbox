import { Temporal } from '@js-temporal/polyfill';

/**
 * Formate un Temporal.PlainDate en format légal français DD/MM/YYYY.
 * Retourne '—' (em dash) si la date est null/undefined.
 */
export function formatDate(date: Temporal.PlainDate | null | undefined): string {
  if (!date) return '—';
  const d = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${d}/${m}/${date.year}`;
}
