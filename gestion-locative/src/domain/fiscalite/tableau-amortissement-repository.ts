/**
 * Port TableauAmortissementRepository — BC Fiscalité (Phase 5, Plan 04).
 *
 * Read-model append-only AmortissementExercice (D-FIS-G1.7).
 * Implémentation SQLite dans src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts.
 *
 * Garanties d'intégrité :
 *   - enregistrerBatch : append-only strict — JAMAIS de onConflict.
 *     Une réinsertion sur (bien_id, composant_id, exercice) = UNIQUE violation (attendu).
 *   - listerParBienExercice : lecture-seule pour pré-affichage S4.
 *   - dernierArdCumule : lookup du dernier ARD cumulé disponible (SYNTHESE_BIEN exercice N-1).
 *
 * Sources juridiques :
 *   - CGI art. 39 B : ARD cumulé disponible reportable sans limite
 *   - D-FIS-G1.7 : read-model matérialisé append-only
 *   - T-05-04-02 : Append-only violé par onConflict (threat mitigé)
 *
 * Analog : src/domain/locatif/bail-indexation-repository.ts (append-only port)
 */

import type { Money } from '../_shared/money.js';
import type { BienId, BailleurId } from '../_shared/identifiants.js';
import type { AmortissementExercice } from './amortissement-exercice.js';

/**
 * Port repository append-only pour le read-model AmortissementExercice.
 *
 * NE PAS ajouter de méthode UPDATE ni DELETE — append-only strict (T-05-04-02).
 */
export interface TableauAmortissementRepository {
  /**
   * Insère un lot de lignes AmortissementExercice.
   *
   * Append-only strict : JAMAIS de onConflict. Une réinsertion sur le même
   * (bien_id, composant_id, exercice) lèvera une UNIQUE violation SQLite.
   * Ce comportement est ATTENDU (protection contre la double clôture).
   *
   * Paramètre trxArg : transaction Kysely optionnelle (Plan 06 cloturer-exercice).
   *
   * @param lignes - lignes à insérer (COMPOSANT + SYNTHESE_BIEN)
   * @param trxArg - transaction Kysely optionnelle
   */
  enregistrerBatch(lignes: AmortissementExercice[], trxArg?: unknown): Promise<void>;

  /**
   * Liste toutes les lignes AmortissementExercice pour un bien + exercice donnés.
   *
   * Utilisé par recalculerTableauAmortissement (pré-affichage lecture-seule S4)
   * et par cloturer-exercice (vérification prérequis Plan 06).
   *
   * @param bienId - identifiant du bien
   * @param exercice - année fiscale
   * @returns toutes les lignes COMPOSANT + SYNTHESE_BIEN de cet exercice
   */
  listerParBienExercice(bienId: BienId, exercice: number): Promise<AmortissementExercice[]>;

  /**
   * Retourne l'ARD cumulé disponible du dernier exercice clôturé (≤ exerciceMax).
   *
   * Lookup : ligne SYNTHESE_BIEN WHERE bien_id = ? AND exercice = ? ORDER BY exercice DESC LIMIT 1.
   * Retourne Money.zero() si aucune ligne trouvée (premier exercice du bien).
   *
   * Utilisé par recalculerTableauAmortissement pour initialiser ardCumuleEnEntree.
   *
   * Source : CGI art. 39 B — ARD reportable sans limite de durée.
   *
   * @param bienId - identifiant du bien
   * @param exerciceMax - exercice maximal (on cherche exerciceMax-1 → N-1)
   * @returns ARD cumulé disponible en Money (≥ 0)
   */
  dernierArdCumule(bienId: BienId, exerciceMax: number): Promise<Money>;

  /**
   * Retourne l'ARD cumulé disponible TOTAL pour un bailleur et un exercice exact.
   *
   * Agrège toutes les lignes SYNTHESE_BIEN de tous les biens du bailleur
   * pour l'exercice exactement égal à exerciceMax.
   *
   * Utilisation : cloturer-exercice N+1 → dernierArdCumuleBailleur(bailleurId, N)
   * pour initialiser ardCumuleEnEntree lors du calcul de l'exercice N+1.
   *
   * D-LOCK-2 : mono-bailleur V1 — tous les biens appartiennent au même bailleur.
   * JOIN bien b ON b.id = ae.bien_id (pas de colonne bailleur_id directe sur amortissement_exercice).
   *
   * Retourne Money.zero() si aucune SYNTHESE_BIEN trouvée pour exerciceMax
   * (premier exercice de clôture du bailleur).
   *
   * Source : CGI art. 39 B — ARD reportable sans limite, propagation cross-exercice (T-05-06-11).
   *
   * @param bailleurId - identifiant bailleur (D-LOCK-2 : tous les biens du bailleur)
   * @param exerciceMax - exercice exact à consulter (exercice N-1 lors de la clôture N)
   * @returns ARD cumulé disponible total bailleur en Money (≥ 0)
   */
  dernierArdCumuleBailleur(bailleurId: BailleurId, exerciceMax: number): Promise<Money>;
}
