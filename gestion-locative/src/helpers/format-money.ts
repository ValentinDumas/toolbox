import { Money } from '../domain/_shared/money.js';

/**
 * Formate un Money en format légal français "800,50 €".
 * Délègue à Money.enEuros() qui utilise Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).
 * Note : Intl insère U+00A0 (espace insécable) entre le nombre et "€".
 * Retourne '—' (em dash) si money est null/undefined.
 */
export function formatMoney(money: Money | null | undefined): string {
  if (!money) return '—';
  return money.enEuros();
}
