import type { EcheanceLoyerId, BailId } from '../_shared/identifiants.js';
import type { EcheanceLoyer, StatutEcheanceLoyer } from './echeance-loyer.js';

/**
 * Port repository EcheanceLoyer.
 * PAS de supprimer — D-74 interdit la suppression physique.
 * Le soft-delete se fait via annule_le (D-60).
 */
export interface EcheanceLoyerRepository {
  enregistrer(echeance: EcheanceLoyer): Promise<void>;

  /** Insère N échéances en transaction atomique (génération à l'activation). */
  enregistrerBatch(echeances: EcheanceLoyer[]): Promise<void>;

  trouverParId(id: EcheanceLoyerId | string): Promise<EcheanceLoyer | null>;

  /** Retourne toutes les échéances d'un bail, triées par periode_debut ASC. Exclut les annulées. */
  listerParBail(bailId: BailId): Promise<EcheanceLoyer[]>;

  mettreAJourStatut(id: EcheanceLoyerId | string, statut: StatutEcheanceLoyer): Promise<void>;

  /** Retourne les échéances non payées (statut IN ('en_attente','partiellement_payee') AND annule_le IS NULL). */
  listerNonPayees(): Promise<EcheanceLoyer[]>;

  /** Compte les échéances existantes pour un bail (utilisé par ActiviteBailDetector D-74). */
  compterParBail(bailId: BailId): Promise<number>;
}
