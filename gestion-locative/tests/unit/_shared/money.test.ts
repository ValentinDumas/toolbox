import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('Money', () => {
  it('Money.fromCentimes(80000n) retourne Money de 800 €', () => {
    const m = Money.fromCentimes(80_000n);
    expect(m.toCentimes()).toBe(80_000n);
  });

  it('Money.fromEuros(800) retourne 80000 centimes', () => {
    const m = Money.fromEuros(800);
    expect(m.toCentimes()).toBe(80_000n);
  });

  it('Money.zero retourne 0n centimes', () => {
    const m = Money.zero();
    expect(m.toCentimes()).toBe(0n);
  });

  it('Money.fromCentimes(-1n) throw InvariantViolated (négatif refusé)', () => {
    expect(() => Money.fromCentimes(-1n)).toThrow(InvariantViolated);
  });

  it('Money.fromCentimes(0n) accepté pour zéro (montant_charges peut être 0)', () => {
    expect(() => Money.fromCentimes(0n)).not.toThrow();
    expect(Money.fromCentimes(0n).toCentimes()).toBe(0n);
  });

  it('addition : Money(800) + Money(50) === Money(850)', () => {
    const result = Money.fromEuros(800).additionner(Money.fromEuros(50));
    expect(result.toCentimes()).toBe(85_000n);
  });

  it('soustraction : Money(800) - Money(50) === Money(750)', () => {
    const result = Money.fromEuros(800).soustraire(Money.fromEuros(50));
    expect(result.toCentimes()).toBe(75_000n);
  });

  it('soustraction : Money(50) - Money(800) throw InvariantViolated (résultat négatif)', () => {
    expect(() => Money.fromEuros(50).soustraire(Money.fromEuros(800))).toThrow(InvariantViolated);
  });

  it('multiplication par scalar 2 : Money(800) * 2 === Money(1600)', () => {
    const result = Money.fromEuros(800).multiplier(2);
    expect(result.toCentimes()).toBe(160_000n);
  });

  it('comparaison : Money(800).lte(Money(1600)) === true', () => {
    expect(Money.fromEuros(800).lte(Money.fromEuros(1600))).toBe(true);
  });

  it('égalité par valeur : Money(800).egale(Money(800)) === true', () => {
    expect(Money.fromEuros(800).egale(Money.fromEuros(800))).toBe(true);
  });

  it('toJSON retourne number (centimes) pour sérialisation HTTP', () => {
    const m = Money.fromCentimes(80_000n);
    expect(m.toJSON()).toBe(80000);
    expect(typeof m.toJSON()).toBe('number');
  });

  it("formatter : Money(80050).enEuros() retourne '800,50 €'", () => {
    const m = Money.fromCentimes(80_050n);
    expect(m.enEuros()).toBe('800,50 €');
  });
});
