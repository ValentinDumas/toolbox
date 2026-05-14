import { InvariantViolated } from './erreurs.js';

/** Format trimestre IRL : YYYY-TN où N ∈ {1,2,3,4} (ex: "2026-T1"). */
const REGEX_TRIMESTRE = /^\d{4}-T[1-4]$/;
/** Decimal positif (ex: "145.47"). */
const REGEX_DECIMAL = /^\d+(\.\d+)?$/;

/**
 * VO IRL (Indice de Référence des Loyers).
 * Stocker le trimestre + la valeur de référence pour le calcul de révision (Phase 3).
 * Valeur conservée en string pour éviter les erreurs d'arrondi flottant.
 */
export class IRL {
  readonly trimestre: string;
  readonly valeur: string;

  private constructor(trimestre: string, valeur: string) {
    this.trimestre = trimestre;
    this.valeur = valeur;
  }

  static creer(props: { trimestre: string; valeur: string }): IRL {
    if (!props.trimestre || !REGEX_TRIMESTRE.test(props.trimestre)) {
      throw new InvariantViolated(
        "Le trimestre IRL doit respecter le format YYYY-TN (ex : \"2026-T1\")",
      );
    }
    if (!props.valeur || !REGEX_DECIMAL.test(props.valeur) || parseFloat(props.valeur) <= 0) {
      throw new InvariantViolated(
        'La valeur IRL doit être un nombre décimal strictement positif (ex : "145.47")',
      );
    }
    return new IRL(props.trimestre, props.valeur);
  }

  egale(other: IRL): boolean {
    return this.trimestre === other.trimestre && this.valeur === other.valeur;
  }

  toJSON(): { trimestre: string; valeur: string } {
    return { trimestre: this.trimestre, valeur: this.valeur };
  }
}
