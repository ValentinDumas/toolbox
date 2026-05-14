import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { formatMoney } from '../../../src/helpers/format-money.js';

describe('formatMoney', () => {
  it("formatMoney(Money.fromEuros(800)) retourne '800,00 €'", () => {
    const money = Money.fromEuros(800);
    const result = formatMoney(money);
    // Intl.NumberFormat fr-FR insère U+00A0 (espace insécable) entre le nombre et "€"
    expect(result).toMatch(/^800,00 €$/);
  });

  it("formatMoney(Money.fromCentimes(80050n)) retourne '800,50 €'", () => {
    const money = Money.fromCentimes(80_050n);
    const result = formatMoney(money);
    expect(result).toMatch(/^800,50 €$/);
  });

  it("formatMoney(Money.zero()) retourne '0,00 €'", () => {
    const money = Money.zero();
    const result = formatMoney(money);
    expect(result).toMatch(/^0,00 €$/);
  });

  it("formatMoney(null) retourne '—'", () => {
    expect(formatMoney(null)).toBe('—');
  });
});
