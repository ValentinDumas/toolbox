/**
 * Port EtatDesLieuxRepository — LOC-03 (D-89).
 * Pattern identique à BailRepository (Phase 1).
 */
import type { EtatDesLieux, TypeEDL } from './etat-des-lieux.js';
import type { BailId, EtatDesLieuxId } from '../_shared/identifiants.js';

export interface EtatDesLieuxRepository {
  /** Upsert par id (onConflict → update annule_le + raison_annulation). */
  enregistrer(edl: EtatDesLieux): Promise<void>;

  trouverParId(id: EtatDesLieuxId): Promise<EtatDesLieux | null>;

  /**
   * Retourne le seul EDL actif (annule_le IS NULL) pour ce bail et ce type.
   * Null si aucun EDL actif.
   */
  trouverActifParBailEtType(bailId: BailId, type: TypeEDL): Promise<EtatDesLieux | null>;

  /**
   * Liste tous les EDL pour ce bail (y compris annulés) pour audit.
   * Triés par cree_le DESC.
   */
  listerParBail(bailId: BailId): Promise<EtatDesLieux[]>;
}
