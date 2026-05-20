/**
 * Agrégat sub-aggregate Composant — bounded context Fiscalité (Phase 5).
 *
 * Un Composant représente une partie amortissable (ou non) d'un Bien immobilier
 * selon la décomposition BOFIP-BIC-AMT-20-40 en 6 types.
 *
 * Invariants (D-FIS-G1.1, G1.5) :
 *   - type ∈ TYPES_COMPOSANT_BOFIP
 *   - montantHt strictement positif sauf si type = 'terrain' (non amortissable)
 *   - si origineKind !== 'initial' ALORS ticketId NOT NULL (D-FIS-G1.5)
 *   - si dateSortie !== null ALORS dateSortie >= dateAcquisition (D-FIS-G5.2)
 *
 * Pattern : copié de src/domain/documents/justificatif.ts (factory creer + copy-on-write + toProps).
 * Durée d'amortissement DERIVÉE par méthode pure (jamais stockée) — D-FIS-G1.1.
 *
 * Sources juridiques :
 *   - CGI art. 39 : liste des composants déductibles
 *   - BOFIP-BIC-AMT-20-40 : durées d'amortissement par composant
 *   - D-FIS-G1.1 à G1.8 : décisions de modélisation Phase 5
 *   - D-FIS-G5.2 : sortie de composant (vente, mise_au_rebut, sinistre, autre)
 */

import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauComposantId,
  type ComposantId,
  type BienId,
  type TicketTravauxId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import type { RegleFiscale2026, TypeComposantBofip } from './regles/regles-2026.js';

/**
 * Les 6 types de composants BOFIP — D-FIS-G1.1 / BOFIP-BIC-AMT-20-40.
 * Le terrain est non amortissable mais modélisé pour la répartition des frais.
 */
export const TYPES_COMPOSANT_BOFIP: readonly TypeComposantBofip[] = [
  'terrain',
  'gros_oeuvre',
  'toiture_facade',
  'installations_techniques',
  'agencements_interieurs',
  'mobilier',
] as const;

/**
 * Origines de création d'un Composant (D-FIS-G1.5).
 *   - initial : créé lors de l'activation de la fiscalité du bien
 *   - amelioration : travaux post-acquisition (TicketTravaux requis)
 *   - acquisition_mobilier : achat mobilier ultérieur (TicketTravaux requis)
 */
export const ORIGINES_KIND_COMPOSANT = [
  'initial',
  'amelioration',
  'acquisition_mobilier',
] as const;
export type OrigineKindComposant = (typeof ORIGINES_KIND_COMPOSANT)[number];

/**
 * Motifs de sortie d'un Composant (D-FIS-G5.2).
 */
export const MOTIFS_SORTIE_COMPOSANT = [
  'vente',
  'mise_au_rebut',
  'sinistre',
  'autre',
] as const;
export type MotifSortieComposant = (typeof MOTIFS_SORTIE_COMPOSANT)[number];

/**
 * Ordre stable des composants amortissables pour l'absorption de l'arrondi
 * dans repartirFraisAcquisition (D-FIS-G1.3, BOFIP-BIC-AMT-10-20 §110).
 * Le DERNIER composant dans cet ordre absorbe l'écart.
 */
export const ORDRE_COMPOSANTS_AMORTISSABLES: readonly TypeComposantBofip[] = [
  'gros_oeuvre',
  'toiture_facade',
  'installations_techniques',
  'agencements_interieurs',
  'mobilier',
] as const;

export interface ComposantProps {
  id?: ComposantId;
  bienId: BienId;
  type: TypeComposantBofip;
  montantHt: Money;
  dateAcquisition: Temporal.PlainDate;
  origineKind: OrigineKindComposant;
  ticketId?: TicketTravauxId | null;
  dateSortie?: Temporal.PlainDate | null;
  motifSortie?: MotifSortieComposant | null;
}

/**
 * Sub-aggregate Composant de Bien (D-FIS-G1.1).
 *
 * Immutable (copy-on-write) — toute mutation retourne une nouvelle instance.
 * Pattern analog : Justificatif (mettreEnCorbeille = copy-on-write).
 */
export class Composant {
  readonly id: ComposantId;
  readonly bienId: BienId;
  readonly type: TypeComposantBofip;
  readonly montantHt: Money;
  readonly dateAcquisition: Temporal.PlainDate;
  readonly origineKind: OrigineKindComposant;
  readonly ticketId: TicketTravauxId | null;
  readonly dateSortie: Temporal.PlainDate | null;
  readonly motifSortie: MotifSortieComposant | null;

  private constructor(id: ComposantId, props: Omit<ComposantProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.type = props.type;
    this.montantHt = props.montantHt;
    this.dateAcquisition = props.dateAcquisition;
    this.origineKind = props.origineKind;
    this.ticketId = props.ticketId ?? null;
    this.dateSortie = props.dateSortie ?? null;
    this.motifSortie = props.motifSortie ?? null;
  }

  /**
   * Factory Composant avec validation de tous les invariants.
   *
   * @throws InvariantViolated pour toute violation (D-FIS-G1.1, G1.5, G5.2)
   */
  static creer(props: ComposantProps): Composant {
    // D-FIS-G1.1 : type ∈ TYPES_COMPOSANT_BOFIP
    if (!(TYPES_COMPOSANT_BOFIP as readonly string[]).includes(props.type)) {
      throw new InvariantViolated(
        `Type de composant invalide : "${props.type}". Valeurs acceptées : ${TYPES_COMPOSANT_BOFIP.join(', ')}`,
      );
    }

    // D-FIS-G1.1 : montantHt strictement positif sauf terrain
    if (props.type !== 'terrain' && props.montantHt.egale(Money.zero())) {
      throw new InvariantViolated(
        `Le montantHt d'un Composant amortissable doit être strictement positif (type = ${props.type}). ` +
          `Seul le terrain accepte montantHt = 0 (non amortissable — CGI art. 39).`,
      );
    }

    // D-FIS-G1.5 : ticketId obligatoire si origineKind ≠ 'initial'
    if (props.origineKind !== 'initial' && (props.ticketId === null || props.ticketId === undefined)) {
      throw new InvariantViolated(
        `ticketId est obligatoire si origineKind = "${props.origineKind}" (D-FIS-G1.5). ` +
          `Rattachez ce composant à un TicketTravaux avant de le persister.`,
      );
    }

    // D-FIS-G5.2 : dateSortie >= dateAcquisition
    if (props.dateSortie !== null && props.dateSortie !== undefined) {
      const cmp = Temporal.PlainDate.compare(props.dateSortie, props.dateAcquisition);
      if (cmp < 0) {
        throw new InvariantViolated(
          `dateSortie (${props.dateSortie.toString()}) doit être >= dateAcquisition (${props.dateAcquisition.toString()}) — D-FIS-G5.2`,
        );
      }
    }

    const id = props.id ?? nouveauComposantId();
    return new Composant(id, {
      bienId: props.bienId,
      type: props.type,
      montantHt: props.montantHt,
      dateAcquisition: props.dateAcquisition,
      origineKind: props.origineKind,
      ticketId: props.ticketId ?? null,
      dateSortie: props.dateSortie ?? null,
      motifSortie: props.motifSortie ?? null,
    });
  }

  /**
   * Durée d'amortissement en années, dérivée des règles fiscales versionnées.
   *
   * Jamais stockée — calculée à partir de RegleFiscale2026.DUREES_AMORTISSEMENT_ANS[type].
   * Permet de versionner les durées en créant RegleFiscale2027 sans migration.
   *
   * Source : BOFIP-BIC-AMT-20-40, CGI art. 39 (D-FIS-G1.1).
   */
  dureeAmortissementAns(regles: RegleFiscale2026): number {
    return regles.DUREES_AMORTISSEMENT_ANS[this.type];
  }

  /**
   * Retourne true si ce composant est amortissable (D-FIS-G1.1).
   *
   * Critères : type !== 'terrain' ET dateSortie === null (composant actif).
   * Utilisé par repartirFraisAcquisition pour filtrer les composants éligibles.
   */
  estAmortissable(): boolean {
    return this.type !== 'terrain' && this.dateSortie === null;
  }

  /**
   * Copy-on-write — sort ce composant du parc actif (D-FIS-G5.2).
   *
   * Retourne un nouveau Composant avec dateSortie et motifSortie fixés.
   * @throws InvariantViolated si le composant est déjà sorti
   */
  sortir(motif: MotifSortieComposant, dateSortie: Temporal.PlainDate): Composant {
    if (this.dateSortie !== null) {
      throw new InvariantViolated(
        `Ce composant est déjà sorti (dateSortie = ${this.dateSortie.toString()}). ` +
          `Impossible de le sortir à nouveau — D-FIS-G5.2.`,
      );
    }
    return Composant.creer({
      ...this.toProps(),
      dateSortie,
      motifSortie: motif,
    });
  }

  /**
   * Retourne les props pour reconstruction ou copy-on-write.
   * Pattern analog : Justificatif.toProps().
   */
  toProps(): ComposantProps {
    return {
      id: this.id,
      bienId: this.bienId,
      type: this.type,
      montantHt: this.montantHt,
      dateAcquisition: this.dateAcquisition,
      origineKind: this.origineKind,
      ticketId: this.ticketId,
      dateSortie: this.dateSortie,
      motifSortie: this.motifSortie,
    };
  }
}
