import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauEcheanceLoyerId,
  type EcheanceLoyerId,
  type BailId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';

/**
 * Statut d'une échéance de loyer (D-55).
 * "en_retard" est un dérivé calculé à la volée (non stocké) :
 * statut != 'payee' && jour_echeance_attendue < clock.aujourdhui()
 */
export type StatutEcheanceLoyer =
  | 'en_attente'
  | 'partiellement_payee'
  | 'payee'
  | 'annulee';

const STATUTS_VALIDES: StatutEcheanceLoyer[] = [
  'en_attente',
  'partiellement_payee',
  'payee',
  'annulee',
];

interface EcheanceLoyerProps {
  id?: EcheanceLoyerId;
  bailId: BailId;
  periodeDebut: Temporal.PlainDate;
  periodeFin: Temporal.PlainDate;
  jourEcheanceAttendue: Temporal.PlainDate;
  loyerHc: Money;
  montantCharges: Money;
  modeCharges: 'forfait' | 'provisions';
  total: Money;
  statut: StatutEcheanceLoyer;
  annuleLe: Temporal.PlainDate | null;
}

/**
 * Agrégat racine EcheanceLoyer (D-54).
 *
 * Snapshot complet : stocke loyerHc, montantCharges et total au moment de la génération
 * pour éviter les JOINs coûteux lors du rendu des listes et des PDF.
 *
 * Invariants :
 *   - statut ∈ {en_attente, partiellement_payee, payee, annulee}
 *   - total = loyerHc + montantCharges
 */
export class EcheanceLoyer {
  readonly id: EcheanceLoyerId;
  readonly bailId: BailId;
  readonly periodeDebut: Temporal.PlainDate;
  readonly periodeFin: Temporal.PlainDate;
  readonly jourEcheanceAttendue: Temporal.PlainDate;
  readonly loyerHc: Money;
  readonly montantCharges: Money;
  readonly modeCharges: 'forfait' | 'provisions';
  readonly total: Money;
  readonly statut: StatutEcheanceLoyer;
  readonly annuleLe: Temporal.PlainDate | null;

  private constructor(id: EcheanceLoyerId, props: Omit<EcheanceLoyerProps, 'id'>) {
    this.id = id;
    this.bailId = props.bailId;
    this.periodeDebut = props.periodeDebut;
    this.periodeFin = props.periodeFin;
    this.jourEcheanceAttendue = props.jourEcheanceAttendue;
    this.loyerHc = props.loyerHc;
    this.montantCharges = props.montantCharges;
    this.modeCharges = props.modeCharges;
    this.total = props.total;
    this.statut = props.statut;
    this.annuleLe = props.annuleLe;
  }

  static creer(props: EcheanceLoyerProps): EcheanceLoyer {
    // Valider le statut
    if (!STATUTS_VALIDES.includes(props.statut as StatutEcheanceLoyer)) {
      throw new InvariantViolated(
        `Statut invalide : "${props.statut}". Valeurs acceptées : ${STATUTS_VALIDES.join(', ')}`,
      );
    }

    // Invariant : total = loyerHc + montantCharges
    const totalAttendu = props.loyerHc.additionner(props.montantCharges);
    if (!props.total.egale(totalAttendu)) {
      throw new InvariantViolated(
        "Le total de l'échéance doit être égal à loyerHc + montantCharges",
      );
    }

    const id = props.id ?? nouveauEcheanceLoyerId();
    return new EcheanceLoyer(id, {
      bailId: props.bailId,
      periodeDebut: props.periodeDebut,
      periodeFin: props.periodeFin,
      jourEcheanceAttendue: props.jourEcheanceAttendue,
      loyerHc: props.loyerHc,
      montantCharges: props.montantCharges,
      modeCharges: props.modeCharges,
      total: props.total,
      statut: props.statut,
      annuleLe: props.annuleLe,
    });
  }

  /** Helper privé pour copy-on-write. */
  private toProps(): EcheanceLoyerProps {
    return {
      id: this.id,
      bailId: this.bailId,
      periodeDebut: this.periodeDebut,
      periodeFin: this.periodeFin,
      jourEcheanceAttendue: this.jourEcheanceAttendue,
      loyerHc: this.loyerHc,
      montantCharges: this.montantCharges,
      modeCharges: this.modeCharges,
      total: this.total,
      statut: this.statut,
      annuleLe: this.annuleLe,
    };
  }

  /**
   * Copy-on-write — retourne une nouvelle EcheanceLoyer avec le statut modifié.
   * Préserve l'id et toutes les autres props.
   */
  avecStatut(statut: StatutEcheanceLoyer): EcheanceLoyer {
    return EcheanceLoyer.creer({ ...this.toProps(), statut });
  }
}
