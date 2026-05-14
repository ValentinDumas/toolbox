import { InvariantViolated } from './erreurs.js';

/**
 * VO Money — montants en centimes (bigint).
 * Stocké en INTEGER SQLite. toJSON() retourne number (centimes)
 * — conversion sûre tant que valeur < Number.MAX_SAFE_INTEGER (9×10^15 centimes).
 * Utilisé par Bail.loyer_hc, Bail.montant_charges, Bail.depot_garantie, et Phases 2-6.
 */
export class Money {
  readonly centimes: bigint;

  private constructor(centimes: bigint) {
    this.centimes = centimes;
  }

  /** Depuis centimes (bigint). Refuse les négatifs. */
  static fromCentimes(n: bigint): Money {
    if (n < 0n) {
      throw new InvariantViolated('Un montant Money ne peut pas être négatif');
    }
    return new Money(n);
  }

  /** Depuis euros (number). Multiplie par 100 et arrondit. */
  static fromEuros(n: number): Money {
    if (n < 0) {
      throw new InvariantViolated('Un montant Money ne peut pas être négatif');
    }
    return new Money(BigInt(Math.round(n * 100)));
  }

  /** Zéro centime. Licite (ex : montant_charges = 0). */
  static zero(): Money {
    return new Money(0n);
  }

  /** Retourne les centimes (bigint). */
  toCentimes(): bigint {
    return this.centimes;
  }

  additionner(other: Money): Money {
    return new Money(this.centimes + other.centimes);
  }

  /** Soustraction. Phase 1 : Money est non-négatif — débits gérés ailleurs. */
  soustraire(other: Money): Money {
    const result = this.centimes - other.centimes;
    if (result < 0n) {
      throw new InvariantViolated('La soustraction produirait un montant négatif');
    }
    return new Money(result);
  }

  multiplier(facteur: number | bigint): Money {
    const f = typeof facteur === 'bigint' ? facteur : BigInt(Math.round(facteur));
    return Money.fromCentimes(this.centimes * f);
  }

  egale(other: Money): boolean {
    return this.centimes === other.centimes;
  }

  lte(other: Money): boolean {
    return this.centimes <= other.centimes;
  }

  lt(other: Money): boolean {
    return this.centimes < other.centimes;
  }

  superieurA(other: Money): boolean {
    return this.centimes > other.centimes;
  }

  /** Sérialisation HTTP — retourne number (centimes) car bigint n'est pas JSON-sérialisable natif. */
  toJSON(): number {
    return Number(this.centimes);
  }

  /** Format légal français : "800,50 €". */
  enEuros(): string {
    const euros = Number(this.centimes) / 100;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(euros);
  }
}
