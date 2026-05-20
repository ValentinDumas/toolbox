import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauTicketTravauxId,
  type BienId,
  type TicketTravauxId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import {
  QUALIFICATIONS_VALIDES,
  type QualificationFiscale,
} from '../fiscalite/qualification-fiscale.js';

import {
  TicketDejaAnnule,
  TransitionInvalide,
} from './erreurs.js';

/**
 * Statuts d'un TicketTravaux (D-112, D-114 workflow).
 */
export type StatutTicket = 'ouvert' | 'en_cours' | 'clos' | 'annule';

export const STATUTS_TICKET_VALIDES: readonly StatutTicket[] = [
  'ouvert',
  'en_cours',
  'clos',
  'annule',
] as const;

/**
 * Nature du ticket (D-FIS-G1.2, Phase 5).
 * - acquisition_mobilier : force natureFiscale = 'amelioration'
 * - entretien, amelioration, autre : natureFiscale libre
 * - null : non catégorisé (Phase 4 legacy)
 */
export type NatureTicket = 'acquisition_mobilier' | 'entretien' | 'amelioration' | 'autre' | null;

export const NATURES_TICKET_VALIDES: readonly NonNullable<NatureTicket>[] = [
  'acquisition_mobilier',
  'entretien',
  'amelioration',
  'autre',
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
  // Phase 5 — D-FIS-G1.2 + D-FIS-G2.3
  nature?: NatureTicket;
  natureFiscale?: QualificationFiscale | null;
  qualifieLeTicket?: Temporal.PlainDate | null;
}

/**
 * Agrégat racine TicketTravaux (D-112, D-114, D-115).
 *
 * Invariants :
 *   - titre.trim() non vide → "Le titre du ticket est obligatoire."
 *   - description.trim() non vide → "La description est obligatoire."
 *   - dateOuverture ≤ today → "La date d'ouverture ne peut pas être dans le futur."
 *   - statut ∈ STATUTS_TICKET_VALIDES.
 *   - [Phase 5] nature = 'acquisition_mobilier' → natureFiscale = 'amelioration' (D-FIS-G1.2).
 *
 * Workflow (D-114 transitions manuelles, pas d'auto-transition) :
 *   - clore(coutReelTtc, dateCloture, today) : ouvert|en_cours → clos
 *   - annuler(raison, annuleLe, today) : tout statut → annule
 *
 * Phase 5 extensions :
 *   - `nature` : catégorie travaux (D-FIS-G1.2)
 *   - `natureFiscale` : qualification fiscale héritée par les justificatifs liés (D-FIS-G2.3)
 *   - `qualifier()` : copy-on-write qualification fiscale du ticket entier
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
  // Phase 5
  readonly nature: NatureTicket;
  readonly natureFiscale: QualificationFiscale | null;
  readonly qualifieLeTicket: Temporal.PlainDate | null;

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
    this.nature = props.nature ?? null;
    this.natureFiscale = props.natureFiscale ?? null;
    this.qualifieLeTicket = props.qualifieLeTicket ?? null;
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

    // D-FIS-G1.2 : nature 'acquisition_mobilier' force natureFiscale = 'amelioration'
    const nature: NatureTicket = props.nature ?? null;
    let natureFiscale = props.natureFiscale ?? null;
    if (nature === 'acquisition_mobilier') {
      natureFiscale = 'amelioration';
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
      nature,
      natureFiscale,
      qualifieLeTicket: props.qualifieLeTicket ?? null,
    });
  }

  /**
   * Copy-on-write — retourne un nouveau TicketTravaux en statut 'clos'.
   * Transitions autorisées : ouvert|en_cours → clos.
   *
   * Throw :
   *   - TransitionInvalide('Ticket déjà clos.') si statut === 'clos'.
   *   - TransitionInvalide('Ticket annulé — impossible de clore.') si statut === 'annule'.
   *   - InvariantViolated('La date de clôture ne peut pas être dans le futur.') si dateCloture > today.
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
    if (Temporal.PlainDate.compare(dateCloture, today) > 0) {
      throw new InvariantViolated(
        'La date de clôture ne peut pas être dans le futur.',
      );
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

  /**
   * Copy-on-write — qualifie fiscalement ce ticket entier (D-FIS-G2.3).
   *
   * Les justificatifs liés héritent de cette qualification via le use case
   * qualifier-ticket-travaux (orchestration en transaction).
   *
   * @throws InvariantViolated si ticket annulé
   * @throws InvariantViolated si qualification invalide
   */
  qualifier(
    natureFiscale: QualificationFiscale,
    qualifieLe: Temporal.PlainDate,
    today: Temporal.PlainDate,
  ): TicketTravaux {
    if (this.annuleLe !== null) {
      throw new InvariantViolated(
        'Impossible de qualifier un ticket annulé.',
      );
    }
    if (!(QUALIFICATIONS_VALIDES as readonly string[]).includes(natureFiscale)) {
      throw new InvariantViolated(
        `Qualification fiscale invalide : "${natureFiscale}". Valeurs acceptées : ${QUALIFICATIONS_VALIDES.join(', ')}`,
      );
    }
    return TicketTravaux.creer(
      {
        ...this.toProps(),
        natureFiscale,
        qualifieLeTicket: qualifieLe,
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
      nature: this.nature,
      natureFiscale: this.natureFiscale,
      qualifieLeTicket: this.qualifieLeTicket,
    };
  }
}
