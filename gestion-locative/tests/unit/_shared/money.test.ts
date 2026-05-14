import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
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

  it("formatter : Money(80050).enEuros() retourne '800,50 €' (format français)", () => {
    const m = Money.fromCentimes(80_050n);
    // Intl.NumberFormat fr-FR utilise une espace insécable (U+00A0) avant le symbole €
    expect(m.enEuros()).toMatch(/800,50/);
    expect(m.enEuros()).toMatch(/€/);
  });
});

describe('Money.multiplyByFraction', () => {
  // Test 1 (fast-check) : prorata mois entier = montant total
  it('propriété : prorata mois entier = montant total', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000n }),
        fc.integer({ min: 28, max: 31 }),
        (centimes, jours) => {
          const m = Money.fromCentimes(centimes);
          const prorata = m.multiplyByFraction(BigInt(jours), BigInt(jours));
          return prorata.egale(m);
        },
      ),
    );
  });

  // Test 2 (fast-check) : somme prorata(j) + prorata(N-j) ∈ [total-1, total+1] centimes
  it('propriété : somme prorata(j) + prorata(N-j) dans [total-1, total+1]', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000n }),
        fc.integer({ min: 28, max: 31 }),
        fc.integer({ min: 1, max: 27 }),
        (centimes, jours, split) => {
          const m = Money.fromCentimes(centimes);
          const N = BigInt(jours);
          const j = BigInt(split);
          const p1 = m.multiplyByFraction(j, N);
          const p2 = m.multiplyByFraction(N - j, N);
          const somme = p1.additionner(p2).toCentimes();
          return somme >= centimes - 1n && somme <= centimes + 1n;
        },
      ),
    );
  });

  // Test 3 : cas concret RESEARCH §Topic 4
  it('cas concret : 85050 centimes * 15/31 = 41153 centimes', () => {
    const result = Money.fromCentimes(85050n).multiplyByFraction(15n, 31n);
    expect(result.toCentimes()).toBe(41153n);
  });

  // Test 4 : multiplyByFraction(0n, 31n) retourne Money.zero()
  it('multiplyByFraction(0n, 31n) retourne Money.zero()', () => {
    const m = Money.fromCentimes(85050n);
    expect(m.multiplyByFraction(0n, 31n).toCentimes()).toBe(0n);
  });

  // Test 5 : multiplyByFraction(31n, 31n) égale le montant original
  it('multiplyByFraction(31n, 31n) égale le montant original', () => {
    const m = Money.fromCentimes(85050n);
    expect(m.multiplyByFraction(31n, 31n).egale(m)).toBe(true);
  });

  // Test 6 : dénominateur 0 throw InvariantViolated
  it('multiplyByFraction(15n, 0n) throw InvariantViolated dénominateur positif', () => {
    const m = Money.fromCentimes(85050n);
    expect(() => m.multiplyByFraction(15n, 0n)).toThrow(InvariantViolated);
    expect(() => m.multiplyByFraction(15n, 0n)).toThrow('Le dénominateur du prorata doit être positif');
  });

  // Test 7 : num > den throw InvariantViolated
  it('multiplyByFraction(35n, 31n) throw InvariantViolated fraction > 1', () => {
    const m = Money.fromCentimes(85050n);
    expect(() => m.multiplyByFraction(35n, 31n)).toThrow(InvariantViolated);
    expect(() => m.multiplyByFraction(35n, 31n)).toThrow('La fraction de prorata doit être entre 0 et 1');
  });
});
