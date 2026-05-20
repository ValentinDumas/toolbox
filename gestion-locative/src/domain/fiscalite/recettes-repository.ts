import type { Money } from '../_shared/money.js';
import type { BailleurId } from '../_shared/identifiants.js';

/**
 * Port — agrégation des recettes annuelles (FIS-02, FIS-03).
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
}
