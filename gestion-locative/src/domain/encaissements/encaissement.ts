import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauEncaissementId,
  type EncaissementId,
  type EcheanceLoyerId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';

/**
 * Mode de paiement d'un Encaissement (D-58).
 * Couvre 100 % des cas LMNP.
 */
export type ModeEncaissement = 'virement' | 'cheque' | 'especes' | 'prelevement' | 'autre';

const MODES_VALIDES: ModeEncaissement[] = ['virement', 'cheque', 'especes', 'prelevement', 'autre'];

interface EncaissementProps {
  id?: EncaissementId;
  echeanceId: EcheanceLoyerId;
  montant: Money;
  date: Temporal.PlainDate;
  mode: ModeEncaissement;
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

/**
 * Agrégat Encaissement (D-57, D-58, D-60, D-62).
 *
 * - Cardinalité N:1 avec EcheanceLoyer.
 * - Montant peut être négatif (compensateur D-60).
 * - Annulation = soft-delete (annule_le + raison) — pas de DELETE.
 * - Pas d'enum statut : existence = encaissé, annule_le = annulé.
 */
export class Encaissement {
  readonly id: EncaissementId;
  readonly echeanceId: EcheanceLoyerId;
  readonly montant: Money;
  readonly date: Temporal.PlainDate;
  readonly mode: ModeEncaissement;
  readonly annuleLe: Temporal.PlainDate | null;
  readonly raisonAnnulation: string | null;

  private constructor(id: EncaissementId, props: Omit<EncaissementProps, 'id'>) {
    this.id = id;
    this.echeanceId = props.echeanceId;
    this.montant = props.montant;
    this.date = props.date;
    this.mode = props.mode;
    this.annuleLe = props.annuleLe ?? null;
    this.raisonAnnulation = props.raisonAnnulation ?? null;
  }

  static creer(props: EncaissementProps): Encaissement {
    if (!MODES_VALIDES.includes(props.mode)) {
      throw new InvariantViolated(
        `Mode d'encaissement invalide : "${props.mode}". Valeurs acceptées : ${MODES_VALIDES.join(', ')}`,
      );
    }

    const id = props.id ?? nouveauEncaissementId();
    return new Encaissement(id, {
      echeanceId: props.echeanceId,
      montant: props.montant,
      date: props.date,
      mode: props.mode,
      annuleLe: props.annuleLe ?? null,
      raisonAnnulation: props.raisonAnnulation ?? null,
    });
  }

  /**
   * Copy-on-write : retourne un nouvel Encaissement annulé (D-60 soft-delete).
   * Throw si déjà annulé.
   */
  annuler(raison: string, annuleLe: Temporal.PlainDate): Encaissement {
    if (this.annuleLe !== null) {
      throw new InvariantViolated('Cet encaissement est déjà annulé');
    }
    return Encaissement.creer({
      ...this.toProps(),
      annuleLe,
      raisonAnnulation: raison,
    });
  }

  /**
   * Retourne true si cet encaissement est un compensateur (montant négatif).
   * Usage : affichage badge "Compensateur" en liste.
   */
  estCompensateur(): boolean {
    return this.montant.estNegatif();
  }

  private toProps(): EncaissementProps {
    return {
      id: this.id,
      echeanceId: this.echeanceId,
      montant: this.montant,
      date: this.date,
      mode: this.mode,
      annuleLe: this.annuleLe,
      raisonAnnulation: this.raisonAnnulation,
    };
  }
}
