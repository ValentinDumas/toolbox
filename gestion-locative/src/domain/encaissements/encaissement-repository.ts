import type { EcheanceLoyerId, EncaissementId } from '../_shared/identifiants.js';
import type { Money } from '../_shared/money.js';
import type { Encaissement } from './encaissement.js';

/**
 * Port repository Encaissement.
 * PAS de supprimer — D-60 impose le soft-delete via annule_le.
 * PAS d'UPDATE montant — correction via compensateur.
 */
export interface EncaissementRepository {
  enregistrer(encaissement: Encaissement): Promise<void>;

  trouverParId(id: EncaissementId | string): Promise<Encaissement | null>;

  /**
   * Retourne tous les encaissements liés à une échéance.
   * Si inclureAnnules=false, exclut ceux avec annule_le NOT NULL.
   */
  listerParEcheance(
    echeanceId: EcheanceLoyerId | string,
    opts?: { inclureAnnules?: boolean },
  ): Promise<Encaissement[]>;

  listerTous(opts?: { inclureAnnules?: boolean }): Promise<Encaissement[]>;

  /**
   * Somme des montants actifs (annule_le IS NULL) pour une échéance donnée.
   * Intègre les compensateurs (montants négatifs).
   * Retourne Money.zero() si aucun encaissement actif.
   */
  sommePaieeParEcheance(echeanceId: EcheanceLoyerId | string): Promise<Money>;
}
