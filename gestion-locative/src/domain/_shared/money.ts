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

  /**
   * Retourne les centimes en number, avec garantie d'absence d'overflow JS-safe.
   * Pour stockage SQLite INTEGER (≤ Number.MAX_SAFE_INTEGER).
   *
   * WR-05 : remplace l'idiome `Number(money.toCentimes())` qui perd la précision
   * silencieusement pour des montants > 2^53.
   */
  toSqliteInteger(): number {
    if (this.centimes > BigInt(Number.MAX_SAFE_INTEGER) || this.centimes < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new InvariantViolated(
        `Montant Money hors borne JS-safe : ${this.centimes} centimes. Stockage en TEXT requis pour cette plage.`,
      );
    }
    return Number(this.centimes);
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

  /**
   * Sérialisation HTTP — retourne number (centimes) car bigint n'est pas JSON-sérialisable natif.
   *
   * WR-05 : assert sur overflow MAX_SAFE_INTEGER (9×10^15 centimes = 90 milliards
   * d'euros). Couvre positifs ET compensateurs négatifs. Hors borne, Number(bigint)
   * arrondit silencieusement aux 2^53 voisins — corruption silencieuse en BDD.
   */
  toJSON(): number {
    if (this.centimes > BigInt(Number.MAX_SAFE_INTEGER) || this.centimes < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new InvariantViolated(
        `Montant Money hors borne JS-safe : ${this.centimes} centimes. Stockage en TEXT requis pour cette plage.`,
      );
    }
    return Number(this.centimes);
  }

  /** Format légal français : "800,50 €". Gère les montants négatifs (compensateurs). */
  enEuros(): string {
    const euros = Number(this.centimes) / 100;
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(euros);
  }

  /**
   * Crée un Money compensateur (montant négatif) à partir d'un Money positif.
   * Usage : annulation partielle, encaissement correctif (D-60).
   * Bypass de fromCentimes qui refuse les négatifs — design Phase 1 préservé.
   */
  static compensateur(positif: Money): Money {
    return new Money(-positif.centimes);
  }

  /**
   * Retourne un Money avec les centimes inversés (positif ↔ négatif).
   * Involution mathématique : negation().negation() === this.
   */
  negation(): Money {
    return new Money(-this.centimes);
  }

  /** Retourne true si ce montant est négatif (compensateur). */
  estNegatif(): boolean {
    return this.centimes < 0n;
  }

  /**
   * Multiplie ce montant par une fraction (num/den) avec arrondi configurable.
   * Usage : prorata 1ère/dernière échéance (D-56).
   * Ex : Money.fromCentimes(85050n).multiplyByFraction(15n, 31n) = 41153n centimes.
   *
   * Banker's rounding (mode par défaut) : quand le reste vaut exactement la moitié,
   * arrondit vers le chiffre pair (évite le biais systématique sur les prorata).
   *
   * Invariants :
   *   - den > 0 sinon InvariantViolated('Le dénominateur du prorata doit être positif')
   *   - 0 ≤ num ≤ den sinon InvariantViolated('La fraction de prorata doit être entre 0 et 1')
   */
  multiplyByFraction(
    num: bigint,
    den: bigint,
    mode: 'banker' | 'floor' | 'ceil' = 'banker',
  ): Money {
    if (den <= 0n) {
      throw new InvariantViolated('Le dénominateur du prorata doit être positif');
    }
    if (num < 0n || num > den) {
      throw new InvariantViolated('La fraction de prorata doit être entre 0 et 1');
    }

    const produit = this.centimes * num;
    const quotient = produit / den;
    const reste = produit % den;

    if (mode === 'floor') {
      return Money.fromCentimes(quotient);
    }
    if (mode === 'ceil') {
      return Money.fromCentimes(reste > 0n ? quotient + 1n : quotient);
    }

    // Banker's rounding (round-half-to-even)
    const deuxFois = reste * 2n;
    if (deuxFois === den) {
      // Exactement la moitié : arrondit vers le chiffre pair
      return Money.fromCentimes(quotient % 2n === 0n ? quotient : quotient + 1n);
    }
    return Money.fromCentimes(deuxFois > den ? quotient + 1n : quotient);
  }
}
