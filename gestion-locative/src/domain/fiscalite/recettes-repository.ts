import type { Money } from '../_shared/money.js';
import type { BailleurId, BienId } from '../_shared/identifiants.js';

/**
 * Port — agrégation des recettes annuelles (FIS-02, FIS-03, D-FIS-G5.1).
 *
 * Chaîne : Encaissement → EcheanceLoyer → Bail → Bailleur (single-bailleur V1, D-LOCK-2).
 *
 * Note D-LOCK-2 : le bailleurId est conservé pour la compatibilité V1.1 multi-bailleur,
 * mais en V1 tous les biens appartiennent au singleton bailleur.
 *
 * Source : BOFIP-BIC-DECLA-30-30 (comptabilité d'encaissement micro-BIC).
 */
export interface RecettesRepository {
  /**
   * Retourne la somme des encaissements actifs pour une année donnée.
   *
   * Règles :
   *   - Filtre `annule_le IS NULL` (D-60 compensateurs inclus dans la somme algébrique)
   *   - Rattachement par `date` de l'encaissement (= datePaiement D-FIS-G2.11)
   *   - Retourne Money ≥ 0 (si somme algébrique < 0 → Money.zero())
   *
   * @param bailleurId - identifiant bailleur (V1.1 multi-bailleur, ignoré en V1)
   * @param annee - exercice fiscal (ex: 2026)
   */
  sommeRecettesAnnuelles(bailleurId: BailleurId, annee: number): Promise<Money>;

  /**
   * Retourne la somme des encaissements actifs pour un bien donné et une année donnée.
   *
   * Ventilation par bien (D-FIS-G5.1) — utilisée par listerVueConsolidee.
   * Chaîne JOIN : encaissement → echeance_loyer → bail → lot WHERE lot.bien_id = bienId.
   *
   * Règles :
   *   - Filtre `annule_le IS NULL` (compensateurs inclus dans la somme algébrique)
   *   - Rattachement par `date` de l'encaissement (D-FIS-G2.11)
   *   - Retourne Money ≥ 0 (clamp à zero si somme négative)
   *
   * @param bienId - identifiant du bien (filtrage via JOIN bail → lot → bien)
   * @param annee - exercice fiscal (ex: 2026)
   */
  sommeRecettesAnnuellesParBien(bienId: BienId, annee: number): Promise<Money>;
}
