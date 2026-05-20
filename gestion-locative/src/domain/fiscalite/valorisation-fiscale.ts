/**
 * Value Object ValorisationFiscale — bounded context Fiscalité (Phase 5).
 *
 * VO 1-1 avec Bien : représente la valorisation initiale d'un bien immobilier
 * pour le régime réel LMNP (prix d'acquisition + frais + quote-part terrain).
 *
 * Invariants (D-FIS-G1.4, D-FIS-G1.8) :
 *   - prixAcquisition strictement positif
 *   - fraisNotaire, fraisAgence >= 0
 *   - quotePartTerrainRatio ∈ [0, 0.30] — D-FIS-G1.8 (saisie libre, pas de pré-remplissage)
 *
 * Sources juridiques :
 *   - BOFIP-BIC-AMT-10-20 §110 : frais répartis au prorata sur composants amortissables
 *   - D-FIS-G1.4 : écran "Activer la fiscalité réelle" obligatoire pour le réel
 *   - D-FIS-G1.8 : quote-part terrain libre [0 %, 30 %] (R4.3 pédagogie + autonomie)
 */

import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauValorisationFiscaleId,
  type ValorisationFiscaleId,
  type BienId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';

/** Quote-part terrain maximale autorisée — D-FIS-G1.8 */
const QUOTE_PART_TERRAIN_MAX = 0.30;

export interface ValorisationFiscaleProps {
  id?: ValorisationFiscaleId;
  bienId: BienId;
  prixAcquisition: Money;
  dateAcquisition: Temporal.PlainDate;
  fraisNotaire: Money;
  fraisAgence: Money;
  quotePartTerrainRatio: number;
  activeLe: Temporal.PlainDateTime;
}

/**
 * Value Object ValorisationFiscale (1-1 avec Bien) — D-FIS-G1.4.
 *
 * Immutable — pas de copy-on-write nécessaire (pure data, jamais modifié).
 * Une activation est définitive. Correction = DeclarationCorrigee (Phase 06).
 */
export class ValorisationFiscale {
  readonly id: ValorisationFiscaleId;
  readonly bienId: BienId;
  readonly prixAcquisition: Money;
  readonly dateAcquisition: Temporal.PlainDate;
  readonly fraisNotaire: Money;
  readonly fraisAgence: Money;
  /** Quote-part terrain ∈ [0, 0.30] — D-FIS-G1.8 */
  readonly quotePartTerrainRatio: number;
  readonly activeLe: Temporal.PlainDateTime;

  private constructor(id: ValorisationFiscaleId, props: Omit<ValorisationFiscaleProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.prixAcquisition = props.prixAcquisition;
    this.dateAcquisition = props.dateAcquisition;
    this.fraisNotaire = props.fraisNotaire;
    this.fraisAgence = props.fraisAgence;
    this.quotePartTerrainRatio = props.quotePartTerrainRatio;
    this.activeLe = props.activeLe;
  }

  /**
   * Factory ValorisationFiscale avec validation des invariants.
   *
   * @throws InvariantViolated si prixAcquisition = 0 ou quotePartTerrainRatio hors [0, 0.30]
   */
  static creer(props: ValorisationFiscaleProps): ValorisationFiscale {
    // prixAcquisition strictement positif
    if (props.prixAcquisition.egale(Money.zero())) {
      throw new InvariantViolated(
        'prixAcquisition doit être strictement positif (D-FIS-G1.4). ' +
          'Un bien avec prix d\'acquisition nul ne peut pas être valorisé fiscalement.',
      );
    }

    // D-FIS-G1.8 : quotePartTerrainRatio ∈ [0, 0.30]
    if (props.quotePartTerrainRatio < 0 || props.quotePartTerrainRatio > QUOTE_PART_TERRAIN_MAX) {
      throw new InvariantViolated(
        `quotePartTerrainRatio = ${props.quotePartTerrainRatio} hors borne [0, ${QUOTE_PART_TERRAIN_MAX}]. ` +
          `La quote-part terrain ne peut pas dépasser 30 % du prix d'acquisition — D-FIS-G1.8 / BOFIP-BIC-AMT-20-40.`,
      );
    }

    const id = props.id ?? nouveauValorisationFiscaleId();
    return new ValorisationFiscale(id, {
      bienId: props.bienId,
      prixAcquisition: props.prixAcquisition,
      dateAcquisition: props.dateAcquisition,
      fraisNotaire: props.fraisNotaire,
      fraisAgence: props.fraisAgence,
      quotePartTerrainRatio: props.quotePartTerrainRatio,
      activeLe: props.activeLe,
    });
  }

  /**
   * Total des frais d'acquisition = fraisNotaire + fraisAgence.
   *
   * Source : BOFIP-BIC-AMT-10-20 §110 — ces frais sont répartis au prorata
   * sur les composants amortissables par repartirFraisAcquisition (D-FIS-G1.3).
   */
  fraisAcquisitionTotal(): Money {
    return this.fraisNotaire.additionner(this.fraisAgence);
  }

  /**
   * Retourne les props pour la persistance SQLite.
   */
  toProps(): ValorisationFiscaleProps {
    return {
      id: this.id,
      bienId: this.bienId,
      prixAcquisition: this.prixAcquisition,
      dateAcquisition: this.dateAcquisition,
      fraisNotaire: this.fraisNotaire,
      fraisAgence: this.fraisAgence,
      quotePartTerrainRatio: this.quotePartTerrainRatio,
      activeLe: this.activeLe,
    };
  }
}
