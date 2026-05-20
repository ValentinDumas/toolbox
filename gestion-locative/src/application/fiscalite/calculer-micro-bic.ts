import { Money } from '../../domain/_shared/money.js';
import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';

/**
 * Résultat du calcul micro-BIC (D-FIS-G4.3, FIS-02).
 *
 * seuilDepasse=true → régime réel obligatoire (CGI art. 50-0).
 * Le caller (cloturer-exercice Plan 06) décide si seuilDepasse force le réel.
 */
export interface MicroBicResult {
  /** Abattement effectivement appliqué (max(50%, plancher 305€), plafonné aux recettes). */
  readonly abattementApplique: Money;
  /** Résultat imposable = recettes − abattementApplique. */
  readonly resultatImposable: Money;
  /** true si recettes > SEUIL_MICRO_BIC_LONGUE_DUREE (83 600 € en 2026). */
  readonly seuilDepasse: boolean;
}

/**
 * Use case pur — calcul abattement micro-BIC (CGI art. 50-0).
 *
 * Fonction pure : pas de I/O, pas de side effects. Injecte les règles fiscales
 * versionnées via RegleFiscale2026 (D-LOCK-1).
 *
 * Logique :
 *   1. seuilDepasse = recettes > SEUIL (83 600 €)
 *   2. abattementCalcule = recettes × 50 % (avec banker's rounding)
 *   3. abattementApplique = max(abattementCalcule, PLANCHER_305€), plafonné à recettes
 *   4. resultatImposable = recettes − abattementApplique
 *
 * Anti-pattern évité : ne lance PAS d'exception sur seuilDepasse — c'est au caller
 * de décider (Plan 06 cloturer-exercice).
 *
 * Sources juridiques :
 *   - CGI art. 50-0 : abattement 50 %, plancher 305 €, seuil 83 600 € (recettes 2026-2028)
 *   - BOFIP-BIC-DECLA-30-30 : comptabilité d'encaissement micro-BIC
 */
export function calculerMicroBic(
  recettes: Money,
  regles: RegleFiscale2026,
): MicroBicResult {
  const seuilDepasse = recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE);

  // Abattement 50 % avec banker's rounding
  const abattementCalcule = recettes.multiplyByFraction(
    regles.ABATTEMENT_LONGUE_DUREE_NUM,
    regles.ABATTEMENT_LONGUE_DUREE_DEN,
  );

  // max(abattementCalcule, plancher 305 €)
  const abattementAvantPlafond = abattementCalcule.superieurA(regles.PLANCHER_ABATTEMENT)
    ? abattementCalcule
    : regles.PLANCHER_ABATTEMENT;

  // Plafonnement : l'abattement ne peut jamais excéder les recettes
  const abattementApplique = abattementAvantPlafond.superieurA(recettes)
    ? recettes
    : abattementAvantPlafond;

  // resultatImposable ≥ 0 (garanti par le plafonnement ci-dessus)
  const resultatImposable = recettes.soustraire(abattementApplique);

  return { abattementApplique, resultatImposable, seuilDepasse };
}
