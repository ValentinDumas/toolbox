import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauBailIndexationId,
  type BailIndexationId,
  type BailId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import { IRL } from '../_shared/irl.js';

/**
 * Raisons valides pour une indexation non appliquée (D-95).
 * - 'gel_dpe' : bail bloqué par le gel Climat F/G (décret 2022-1313).
 * - 'refus_bailleur' : choix volontaire du bailleur (renoncer cette année).
 */
export type RaisonNonApplication = 'gel_dpe' | 'refus_bailleur';

const RAISONS_VALIDES: ReadonlyArray<RaisonNonApplication> = ['gel_dpe', 'refus_bailleur'];

interface BailIndexationProps {
  id?: BailIndexationId;
  bailId: BailId;
  dateEffet: Temporal.PlainDate;
  irlAvant: IRL;
  irlApres: IRL;
  loyerAvant: Money;
  loyerApres: Money;
  indexationAppliquee: boolean;
  raisonNonApplication: RaisonNonApplication | null;
}

/**
 * Agrégat BailIndexation (Phase 3-04, LOC-04 apply, D-96).
 *
 * Append-only strict : aucune méthode de modification ou d'annulation.
 * Une correction métier passe par l'enregistrement d'une nouvelle ligne
 * (jamais d'UPDATE des colonnes loyer_avant/loyer_apres/irl_avant/irl_apres/date_effet).
 *
 * Invariants :
 *   - indexationAppliquee=true  → raisonNonApplication === null
 *                                 ET loyerApres >= loyerAvant
 *   - indexationAppliquee=false → raisonNonApplication !== null
 *                                 ET loyerApres.egale(loyerAvant)
 *   - raisonNonApplication, si présent, ∈ {'gel_dpe','refus_bailleur'}
 */
export class BailIndexation {
  readonly id: BailIndexationId;
  readonly bailId: BailId;
  readonly dateEffet: Temporal.PlainDate;
  readonly irlAvant: IRL;
  readonly irlApres: IRL;
  readonly loyerAvant: Money;
  readonly loyerApres: Money;
  readonly indexationAppliquee: boolean;
  readonly raisonNonApplication: RaisonNonApplication | null;

  private constructor(id: BailIndexationId, props: Omit<BailIndexationProps, 'id'>) {
    this.id = id;
    this.bailId = props.bailId;
    this.dateEffet = props.dateEffet;
    this.irlAvant = props.irlAvant;
    this.irlApres = props.irlApres;
    this.loyerAvant = props.loyerAvant;
    this.loyerApres = props.loyerApres;
    this.indexationAppliquee = props.indexationAppliquee;
    this.raisonNonApplication = props.raisonNonApplication;
  }

  static creer(props: BailIndexationProps): BailIndexation {
    // Validation de l'enum raisonNonApplication
    if (
      props.raisonNonApplication !== null &&
      !RAISONS_VALIDES.includes(props.raisonNonApplication)
    ) {
      throw new InvariantViolated(
        `Raison de non-application invalide : "${props.raisonNonApplication}". Valeurs acceptées : ${RAISONS_VALIDES.join(', ')}`,
      );
    }

    if (props.indexationAppliquee) {
      if (props.raisonNonApplication !== null) {
        throw new InvariantViolated(
          'Une indexation appliquée ne peut pas avoir de raison de non-application',
        );
      }
      if (props.loyerApres.lt(props.loyerAvant)) {
        throw new InvariantViolated(
          'Une indexation appliquée doit avoir un loyer après >= loyer avant (révision à la hausse ou IRL stable)',
        );
      }
    } else {
      if (props.raisonNonApplication === null) {
        throw new InvariantViolated(
          'Une indexation non appliquée doit avoir une raison de non-application',
        );
      }
      if (!props.loyerApres.egale(props.loyerAvant)) {
        throw new InvariantViolated(
          'Une indexation non appliquée ne doit pas modifier le loyer',
        );
      }
    }

    const id = props.id ?? nouveauBailIndexationId();
    return new BailIndexation(id, {
      bailId: props.bailId,
      dateEffet: props.dateEffet,
      irlAvant: props.irlAvant,
      irlApres: props.irlApres,
      loyerAvant: props.loyerAvant,
      loyerApres: props.loyerApres,
      indexationAppliquee: props.indexationAppliquee,
      raisonNonApplication: props.raisonNonApplication,
    });
  }
}
