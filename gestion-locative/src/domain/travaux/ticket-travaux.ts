import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauTicketTravauxId,
  type BienId,
  type TicketTravauxId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';

import {
  TicketDejaAnnule,
  TransitionInvalide,
} from './erreurs.js';

/**
 * Statuts d'un TicketTravaux (D-112, D-114 workflow).
 * Pas de champ `nature` (D-115 — qualification fiscale différée Phase 5).
 */
export type StatutTicket = 'ouvert' | 'en_cours' | 'clos' | 'annule';

export const STATUTS_TICKET_VALIDES: readonly StatutTicket[] = [
  'ouvert',
  'en_cours',
  'clos',
  'annule',
] as const;

export interface TicketTravauxProps {
  id?: TicketTravauxId;
  bienId: BienId;
  titre: string;
  description: string;
  dateOuverture: Temporal.PlainDate;
  dateCloture: Temporal.PlainDate | null;
  statut: StatutTicket;
  coutEstimeTtc: Money | null;
  coutReelTtc: Money | null;
  notes: string | null;
  creeLe: Temporal.PlainDate;
  annuleLe: Temporal.PlainDate | null;
  raisonAnnulation: string | null;
}

/**
 * Agrégat racine TicketTravaux (D-112, D-114, D-115).
 *
 * Invariants :
 *   - titre.trim() non vide → "Le titre du ticket est obligatoire."
 *   - description.trim() non vide → "La description est obligatoire."
 *   - dateOuverture ≤ today → "La date d'ouverture ne peut pas être dans le futur."
 *   - statut ∈ STATUTS_TICKET_VALIDES.
 *
 * Workflow (D-114 transitions manuelles, pas d'auto-transition) :
 *   - clore(coutReelTtc, dateCloture, today) : ouvert|en_cours → clos
 *     - depuis 'clos' → throw TransitionInvalide('Ticket déjà clos.')
 *     - depuis 'annule' → throw TransitionInvalide('Ticket annulé — impossible de clore.')
 *     - dateCloture < dateOuverture → throw InvariantViolated
 *   - annuler(raison, annuleLe, today) : tout statut → annule + soft-delete via annule_le
 *     - depuis 'annule' → throw TicketDejaAnnule.
 *
 * D-115 strictement honoré : aucun champ `nature` — la qualification fiscale
 * (réparation/entretien/amélioration) arrivera Phase 5 dans un BC Fiscalité séparé.
 */
export class TicketTravaux {
  readonly id: TicketTravauxId;
  readonly bienId: BienId;
  readonly titre: string;
  readonly description: string;
  readonly dateOuverture: Temporal.PlainDate;
  readonly dateCloture: Temporal.PlainDate | null;
  readonly statut: StatutTicket;
  readonly coutEstimeTtc: Money | null;
  readonly coutReelTtc: Money | null;
  readonly notes: string | null;
  readonly creeLe: Temporal.PlainDate;
  readonly annuleLe: Temporal.PlainDate | null;
  readonly raisonAnnulation: string | null;

  private constructor(id: TicketTravauxId, props: Omit<TicketTravauxProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.titre = props.titre;
    this.description = props.description;
    this.dateOuverture = props.dateOuverture;
    this.dateCloture = props.dateCloture;
    this.statut = props.statut;
    this.coutEstimeTtc = props.coutEstimeTtc;
    this.coutReelTtc = props.coutReelTtc;
    this.notes = props.notes;
    this.creeLe = props.creeLe;
    this.annuleLe = props.annuleLe;
    this.raisonAnnulation = props.raisonAnnulation;
  }

  static creer(
    props: TicketTravauxProps,
    today: Temporal.PlainDate,
  ): TicketTravaux {
    if (props.titre.trim().length === 0) {
      throw new InvariantViolated('Le titre du ticket est obligatoire.');
    }
    if (props.description.trim().length === 0) {
      throw new InvariantViolated('La description est obligatoire.');
    }
    if (Temporal.PlainDate.compare(props.dateOuverture, today) > 0) {
      throw new InvariantViolated(
        "La date d'ouverture ne peut pas être dans le futur.",
      );
    }
    const statut: StatutTicket = props.statut ?? 'ouvert';
    if (!STATUTS_TICKET_VALIDES.includes(statut)) {
      throw new InvariantViolated(
        `Statut de ticket invalide : "${statut}". Valeurs acceptées : ${STATUTS_TICKET_VALIDES.join(', ')}`,
      );
    }
    const id = props.id ?? nouveauTicketTravauxId();
    return new TicketTravaux(id, {
      bienId: props.bienId,
      titre: props.titre.trim(),
      description: props.description.trim(),
      dateOuverture: props.dateOuverture,
      dateCloture: props.dateCloture,
      statut,
      coutEstimeTtc: props.coutEstimeTtc,
      coutReelTtc: props.coutReelTtc,
      notes: props.notes,
      creeLe: props.creeLe,
      annuleLe: props.annuleLe,
      raisonAnnulation: props.raisonAnnulation,
    });
  }

  /**
   * Copy-on-write — retourne un nouveau TicketTravaux en statut 'clos'.
   * Transitions autorisées : ouvert|en_cours → clos.
   *
   * Throw :
   *   - TransitionInvalide('Ticket déjà clos.') si statut === 'clos'.
   *   - TransitionInvalide('Ticket annulé — impossible de clore.') si statut === 'annule'.
   *   - InvariantViolated si dateCloture < dateOuverture.
   */
  clore(
    coutReelTtc: Money,
    dateCloture: Temporal.PlainDate,
    today: Temporal.PlainDate,
  ): TicketTravaux {
    if (this.statut === 'clos') {
      throw new TransitionInvalide('Ticket déjà clos.');
    }
    if (this.statut === 'annule') {
      throw new TransitionInvalide('Ticket annulé — impossible de clore.');
    }
    if (Temporal.PlainDate.compare(dateCloture, this.dateOuverture) < 0) {
      throw new InvariantViolated(
        "La date de clôture ne peut pas précéder la date d'ouverture.",
      );
    }
    return TicketTravaux.creer(
      {
        ...this.toProps(),
        statut: 'clos',
        dateCloture,
        coutReelTtc,
      },
      today,
    );
  }

  /**
   * Copy-on-write — retourne un nouveau TicketTravaux en statut 'annule'.
   * Soft-delete via annule_le + raison_annulation.
   *
   * Throw TicketDejaAnnule si déjà annulé.
   */
  annuler(
    raison: string,
    annuleLe: Temporal.PlainDate,
    today: Temporal.PlainDate,
  ): TicketTravaux {
    if (this.annuleLe !== null) {
      throw new TicketDejaAnnule();
    }
    return TicketTravaux.creer(
      {
        ...this.toProps(),
        statut: 'annule',
        annuleLe,
        raisonAnnulation: raison,
      },
      today,
    );
  }

  toProps(): TicketTravauxProps {
    return {
      id: this.id,
      bienId: this.bienId,
      titre: this.titre,
      description: this.description,
      dateOuverture: this.dateOuverture,
      dateCloture: this.dateCloture,
      statut: this.statut,
      coutEstimeTtc: this.coutEstimeTtc,
      coutReelTtc: this.coutReelTtc,
      notes: this.notes,
      creeLe: this.creeLe,
      annuleLe: this.annuleLe,
      raisonAnnulation: this.raisonAnnulation,
    };
  }
}
