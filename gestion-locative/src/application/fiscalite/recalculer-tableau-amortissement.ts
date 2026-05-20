/**
 * Use case recalculerTableauAmortissement — pré-affichage S4 (lecture-seule).
 *
 * Orchestre les lookups I/O puis appelle le calcul pur calculerAmortissement.
 * Ce use case est LECTURE-SEULE — il NE PERSISTE PAS (pas d'enregistrerBatch).
 * La persistance définitive est effectuée par cloturer-exercice (Plan 06).
 *
 * Garantie T-05-04-03 : avant clôture, le calcul est recalculé à chaque requête S4.
 * Cohérence assurée par la nature pure du calcul (mêmes inputs → mêmes outputs).
 *
 * Sources juridiques :
 *   - CGI art. 39 : calcul prorata + plafond résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite, lu depuis le dernier exercice clôturé
 *   - D-FIS-G1.7 : read-model matérialisé, pré-affichage lecture-seule avant clôture
 *
 * Analog : src/application/locatif/simuler-indexation-irl.ts (orchestration pure + lookup)
 */

import { Temporal } from '@js-temporal/polyfill';
import type { BienId, BailleurId } from '../../domain/_shared/identifiants.js';
import type { ComposantRepository } from '../../domain/fiscalite/composant-repository.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../domain/fiscalite/charges-repository.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import type { RegleFiscaleProvider } from '../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { Money } from '../../domain/_shared/money.js';
import { TableauAmortissementExercice } from '../../domain/fiscalite/tableau-amortissement.js';
import { calculerAmortissement } from './calculer-amortissement.js';

export interface RecalculerTableauAmortissementRepos {
  composantRepo: ComposantRepository;
  recettesRepo: RecettesRepository;
  chargesRepo: ChargesRepository;
  tableauAmortissementRepo: TableauAmortissementRepository;
}

/**
 * Calcule le tableau d'amortissement pour un bien et un exercice donnés.
 *
 * Séquence :
 *   (1) lookup composants actifs via composantRepo.listerParBien (tous — le calcul filtre par exercice)
 *   (2) lookup ARD cumulé N-1 via tableauAmortissementRepo.dernierArdCumule
 *   (3) lookup recettes annuelles via recettesRepo.sommeRecettesAnnuelles
 *   (4) lookup charges déductibles via chargesRepo.sommeChargesParCategorie
 *   (5) calculer resultatAvantAmortissement = max(0, recettes - chargesDeductibles)
 *   (6) appel pur calculerAmortissement (use case Task 1)
 *   (7) retourner TableauAmortissementExercice — NE PAS PERSISTER (lecture-seule)
 *
 * @param bienId    - identifiant du bien
 * @param bailleurId - identifiant bailleur (D-LOCK-2 single-bailleur V1)
 * @param exercice  - année fiscale (ex: 2026)
 * @param repos     - repositories injectés (hexagonal port pattern)
 * @param regleFiscale - règles fiscales versionnées (RegleFiscaleProvider)
 * @param clock     - horloge injectée (ClockSysteme ou ClockFixe en tests)
 * @returns TableauAmortissementExercice calculé (lecture-seule, non persisté)
 */
export async function recalculerTableauAmortissement(
  bienId: BienId,
  bailleurId: BailleurId,
  exercice: number,
  repos: RecalculerTableauAmortissementRepos,
  regleFiscale: RegleFiscaleProvider,
  clock: Clock,
): Promise<TableauAmortissementExercice> {
  const regles = regleFiscale.pour(exercice);
  const today = clock.aujourdhui();

  // (1) Lookup composants (tous — le use case pur filtre par exercice actif)
  const composants = await repos.composantRepo.listerParBien(bienId);

  // (2) ARD cumulé de l'exercice précédent (N-1)
  const ardCumuleEnEntree = await repos.tableauAmortissementRepo.dernierArdCumule(bienId, exercice);

  // (3) Recettes annuelles (comptabilité d'encaissement — BOFIP-BIC-DECLA-30-40-20)
  const recettes = await repos.recettesRepo.sommeRecettesAnnuelles(bailleurId, exercice);

  // (4) Charges déductibles par catégorie (D-FIS-G2.2)
  const chargesParCategorie = await repos.chargesRepo.sommeChargesParCategorie(bailleurId, exercice);

  // (5) Calcul resultatAvantAmortissement = max(0, recettes - chargesDeductibles)
  // Charges déductibles = entretien_reparation + charge_courante_periodique + amelioration
  // (non_deductible exclus — CGI art. 39)
  const chargesDeductibles = (chargesParCategorie['entretien_reparation'] ?? Money.zero())
    .additionner(chargesParCategorie['charge_courante_periodique'] ?? Money.zero())
    .additionner(chargesParCategorie['amelioration'] ?? Money.zero());

  const resultatAvantAmortissement = recettes.toCentimes() >= chargesDeductibles.toCentimes()
    ? recettes.soustraire(chargesDeductibles)
    : Money.zero();

  // (6) Calcul pur — use case Task 1 (aucun I/O)
  return calculerAmortissement(
    composants,
    exercice,
    regles,
    {
      resultatAvantAmortissement,
      ardCumuleEnEntree,
    },
  );
}
