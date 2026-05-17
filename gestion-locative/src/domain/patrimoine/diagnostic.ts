import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauDiagnosticId, type DiagnosticId } from '../_shared/identifiants.js';
import {
  type TypeDiagnostic,
  type ClasseDpe,
  DUREES_VALIDITE,
  TYPES_DIAGNOSTIC,
  CLASSES_DPE,
} from '../_shared/duree-validite-diagnostic.js';

interface DiagnosticProps {
  id?: DiagnosticId;
  type: TypeDiagnostic;
  dateEmission: Temporal.PlainDate;
  classeDpe?: ClasseDpe | null;
}

/**
 * Sous-agrégat Diagnostic — entité appartenant à l'agrégat Bien (D-76).
 * Pas d'agrégat racine séparé, pas de DiagnosticRepository.
 * Géré exclusivement via BienRepository.
 *
 * Invariants :
 * - type ∈ TypeDiagnostic (D-77)
 * - DPE oblige classeDpe ∈ ClasseDpe (T-03-01-01 mitigé)
 * - Non-DPE interdit classeDpe (T-03-01-02 mitigé)
 * - dateExpiration calculée auto depuis dateEmission + DUREES_VALIDITE[type] (D-77)
 */
export class Diagnostic {
  readonly id: DiagnosticId;
  readonly type: TypeDiagnostic;
  readonly dateEmission: Temporal.PlainDate;
  readonly dateExpiration: Temporal.PlainDate | null;
  readonly classeDpe: ClasseDpe | null;

  private constructor(
    id: DiagnosticId,
    type: TypeDiagnostic,
    dateEmission: Temporal.PlainDate,
    dateExpiration: Temporal.PlainDate | null,
    classeDpe: ClasseDpe | null,
  ) {
    this.id = id;
    this.type = type;
    this.dateEmission = dateEmission;
    this.dateExpiration = dateExpiration;
    this.classeDpe = classeDpe;
  }

  static creer(props: DiagnosticProps): Diagnostic {
    // Valider le type
    if (!TYPES_DIAGNOSTIC.includes(props.type)) {
      throw new InvariantViolated(`Type de diagnostic invalide : "${props.type}"`);
    }

    const classeDpe = props.classeDpe ?? null;

    // DPE exige classeDpe
    if (props.type === 'dpe' && (classeDpe === null || !CLASSES_DPE.includes(classeDpe))) {
      throw new InvariantViolated('La classe DPE est obligatoire pour un diagnostic DPE');
    }

    // Non-DPE interdit classeDpe
    if (props.type !== 'dpe' && classeDpe !== null) {
      throw new InvariantViolated("La classe DPE n'est pertinente que pour le diagnostic DPE");
    }

    // Calculer dateExpiration selon durée légale (D-77)
    const { annees } = DUREES_VALIDITE[props.type];
    const dateExpiration =
      annees === null ? null : props.dateEmission.add({ years: annees });

    const id = props.id ?? nouveauDiagnosticId();

    return new Diagnostic(id, props.type, props.dateEmission, dateExpiration, classeDpe);
  }

  /**
   * Retourne true si ce diagnostic est expiré à la date today.
   * Un ERP (dateExpiration === null) n'expire jamais.
   */
  estExpire(today: Temporal.PlainDate): boolean {
    if (this.dateExpiration === null) return false;
    return Temporal.PlainDate.compare(today, this.dateExpiration) > 0;
  }
}
