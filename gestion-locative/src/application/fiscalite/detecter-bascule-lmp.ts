/**
 * Use case pur : détection de bascule LMNP → LMP (CGI art. 155 IV).
 *
 * Retourne un verdict tri-état :
 *   - 'lmnp_confirme' : recettes ≤ seuil LMP (23 000 €), ou recettes > seuil
 *     mais revenus foyer ≥ recettes (critère (b) non rempli).
 *   - 'lmp_probable' : recettes > seuil (critère a) ET recettes > revenus foyer (critère b).
 *   - 'indetermine_revenus_foyer_manquants' : recettes > seuil mais revenus foyer non renseignés.
 *
 * Sources juridiques :
 *   CGI art. 155 IV — critères LMP depuis Conseil Constitutionnel n° 2009-587 DC
 *     (suppression de la condition d'inscription au RCS).
 *   D-FIS-G3.3 — verdict tri-état (LMNP confirmé / Indéterminé / LMP probable).
 *   D-FIS-G3.4 — évaluation INDÉPENDANTE par exercice (anti-sticky LMP).
 *     Aucune base légale pour verrouiller LMP depuis la décision du Conseil Constitutionnel.
 *
 * Anti-patterns :
 *   - Ne JAMAIS verrouiller LMP sur N+1 (sticky LMP — CONTEXT.md §<anti_patterns> §7).
 *   - Ce use case est PUR : pas d'état, pas d'I/O. Mêmes inputs → même output toujours.
 *   - Toute persistance du verdict se fait via snapshot dans DeclarationAnnuelle (Plan 06).
 */

import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import { Money } from '../../domain/_shared/money.js';

// Re-export depuis le domaine — Plan 06 : VerdictLmp déplacé dans le domaine
// pour permettre son import par les agrégats (DeclarationAnnuelle, DeclarationCorrigee)
// sans violer la règle no-domain-to-infra (D-FIS architecture hexagonale).
export type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';

/**
 * Labels français pour affichage utilisateur (S7 UI-SPEC, D-FIS-G3.3).
 */
export const LABELS_VERDICT_LMP: Record<VerdictLmp, string> = {
  lmnp_confirme: 'LMNP confirmé',
  lmp_probable: 'LMP probable',
  indetermine_revenus_foyer_manquants: 'Indéterminé (revenus foyer manquants)',
};

/**
 * Détecte la bascule LMNP → LMP pour un exercice donné.
 *
 * Logique CGI art. 155 IV (depuis décision CC n° 2009-587 DC) :
 *   (a) recettes > 23 000 € (SEUIL_LMP_RECETTES) — critère strict supérieur
 *   (b) recettes > revenus actifs du foyer (BOFIP-BIC-CHAMP-40-20) — critère strict supérieur
 *   LMP : (a) ET (b). LMNP : (a) non rempli, ou (b) non rempli. Indéterminé : (a) rempli mais (b) inconnu.
 *
 * @param input.recettes — recettes annuelles de location meublée (Money)
 * @param input.revenusFoyer — revenus actifs annuels du foyer (Money) ou null si non renseignés
 * @param regles — règles fiscales versionnées (REGLES_2026 ou équivalent pour autre année)
 * @returns VerdictLmp
 *
 * @see D-FIS-G3.3 — verdict tri-état
 * @see D-FIS-G3.4 — anti-sticky : chaque exercice est évalué indépendamment
 * @see Conseil Constitutionnel n° 2009-587 DC — suppression condition RCS
 */
export function detecterBasculeLmp(
  input: { recettes: Money; revenusFoyer: Money | null },
  regles: RegleFiscale2026,
): VerdictLmp {
  // Critère (a) : recettes > seuil LMP (strict supérieur — CGI art. 155 IV)
  const criterADePasse = input.recettes.superieurA(regles.SEUIL_LMP_RECETTES);

  // Si critère (a) non rempli : LMNP confirmé (revenus foyer pas nécessaires)
  if (!criterADePasse) {
    return 'lmnp_confirme';
  }

  // Critère (a) rempli — vérification critère (b)
  if (input.revenusFoyer === null) {
    // Revenus foyer absents : impossible de trancher → indéterminé (D-FIS-G3.3)
    return 'indetermine_revenus_foyer_manquants';
  }

  // Critère (b) : recettes > revenus actifs foyer (strict supérieur — CGI art. 155 IV)
  const criterBDePasse = input.recettes.superieurA(input.revenusFoyer);

  if (criterBDePasse) {
    // Les deux critères stricts remplis → LMP probable
    return 'lmp_probable';
  }

  // Critère (a) rempli mais (b) non rempli (recettes ≤ revenus foyer) → LMNP confirmé
  return 'lmnp_confirme';
}
