import type { EcheanceLoyerId, QuittanceId } from '../_shared/identifiants.js';
import type { Quittance } from './quittance.js';

/**
 * Port repository Quittance.
 * L'annulation est une mise à jour (annulee_le + raison_annulation) — pas de DELETE (D-63).
 */
export interface QuittanceRepository {
  enregistrer(quittance: Quittance, trx?: unknown): Promise<void>;

  trouverParId(id: QuittanceId | string): Promise<Quittance | null>;

  /** Retourne la quittance NON annulée pour une échéance, ou null. */
  trouverActiveParEcheance(echeanceId: EcheanceLoyerId | string): Promise<Quittance | null>;

  listerToutes(opts?: { inclureAnnulees?: boolean }): Promise<Quittance[]>;

  /**
   * Retourne le prochain numéro de quittance pour l'année donnée (AAAA-NNN).
   * Incrémente le compteur dans meta.compteur_quittance_{annee} (UPSERT atomique).
   * Si trx fourni, utilise trx pour l'atomicité (appelé dans la transaction du use case).
   */
  prochainNumero(annee: number, trx?: unknown): Promise<string>;
}
