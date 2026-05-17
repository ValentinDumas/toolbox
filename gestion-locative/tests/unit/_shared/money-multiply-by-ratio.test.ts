import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Money } from '../../../src/domain/_shared/money.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('Money.multiplyByRatio', () => {
  // T1 — cas réel IRL : 800€ × 145.47/142.06 → banker round centimes du résultat.
  // 80000 * 14547 / 14206 = 1163760000 / 14206 = 81920.4504... → 81920 (banker, .45 < .5).
  it('T1: cas IRL réel 80000 × 14547/14206 = 81920 centimes (banker)', () => {
    const m = Money.fromCentimes(80_000n);
    const r = m.multiplyByRatio(14547n, 14206n, 'banker');
    expect(r.toCentimes()).toBe(81920n);
  });

  // T2 — ratio 1.5 (num > den)
  it('T2: 100 × 3/2 = 150 centimes', () => {
    const r = Money.fromCentimes(100n).multiplyByRatio(3n, 2n, 'banker');
    expect(r.toCentimes()).toBe(150n);
  });

  // T3 — ratio 1.25
  it('T3: 100 × 5/4 = 125 centimes', () => {
    const r = Money.fromCentimes(100n).multiplyByRatio(5n, 4n, 'banker');
    expect(r.toCentimes()).toBe(125n);
  });

  // T4 — num 0
  it('T4: 100 × 0/1 = 0 centimes', () => {
    const r = Money.fromCentimes(100n).multiplyByRatio(0n, 1n);
    expect(r.toCentimes()).toBe(0n);
  });

  // T5 — den 0 throw
  it('T5: 100 × 1/0 throw InvariantViolated', () => {
    expect(() => Money.fromCentimes(100n).multiplyByRatio(1n, 0n)).toThrow(InvariantViolated);
    expect(() => Money.fromCentimes(100n).multiplyByRatio(1n, 0n)).toThrow(
      'Le dénominateur du ratio doit être positif',
    );
  });

  // T6 — num négatif throw
  it('T6: 100 × -1/2 throw InvariantViolated', () => {
    expect(() => Money.fromCentimes(100n).multiplyByRatio(-1n, 2n)).toThrow(InvariantViolated);
    expect(() => Money.fromCentimes(100n).multiplyByRatio(-1n, 2n)).toThrow(
      'Le numérateur du ratio doit être positif ou nul',
    );
  });

  // T7 — modes floor/ceil
  it('T7: mode floor et ceil fonctionnent', () => {
    // 10 × 1/3 = 3.33 → floor 3, ceil 4
    expect(Money.fromCentimes(10n).multiplyByRatio(1n, 3n, 'floor').toCentimes()).toBe(3n);
    expect(Money.fromCentimes(10n).multiplyByRatio(1n, 3n, 'ceil').toCentimes()).toBe(4n);
  });

  // T8 — property : écart banker ≤ 1 centime du ratio mathématique
  it('T8 propriété : écart banker ≤ 1 centime', () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 1n, max: 1_000_000_000n }),
        fc.bigInt({ min: 0n, max: 1_000_000n }),
        fc.bigInt({ min: 1n, max: 1_000_000n }),
        (centimes, num, den) => {
          const m = Money.fromCentimes(centimes);
          const r = m.multiplyByRatio(num, den, 'banker').toCentimes();
          // valeur théorique = centimes * num / den (sans arrondi, en bigint floor)
          const theorique = (centimes * num) / den;
          const diff = r > theorique ? r - theorique : theorique - r;
          return diff <= 1n;
        },
      ),
      { numRuns: 100 },
    );
  });

  // T9 — non-régression multiplyByFraction continue de rejeter num > den
  it('T9 non-régression : multiplyByFraction(35n, 31n) throw toujours', () => {
    expect(() => Money.fromCentimes(100n).multiplyByFraction(35n, 31n)).toThrow(InvariantViolated);
  });
});
