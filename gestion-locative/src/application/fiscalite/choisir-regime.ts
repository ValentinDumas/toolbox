/**
 * Use case PUR — Choix du régime fiscal micro-BIC vs réel (D-FIS-G4.3).
 *
 * AUCUN I/O, AUCUN side-effect — fonction pure au sens mathématique.
 * Les mêmes inputs produisent toujours les mêmes outputs.
 *
 * Logique (D-FIS-G4.3 + BOFIP-BIC-DECLA-10-30) :
 *   (a) si recettes > SEUIL_MICRO_BIC_LONGUE_DUREE → 'reel' (forcé, override ignoré)
 *   (b) si recettes ≤ seuil ET regimeChoisi='reel' → 'reel' (option bailleur)
 *   (c) sinon → 'micro_bic' (régime par défaut)
 *
 * Sources juridiques :
 *   - CGI art. 50-0 : seuil micro-BIC 83 600 € (2026-2028)
 *   - BOFIP-BIC-DECLA-10-30 : option régime réel renouvelable 1 an tacitement
 *   - D-FIS-G4.3 : choix libre tant que recettes < seuil ; forcé au-delà
 *   - T-05-06-08 : threat mitigation — override 'micro_bic' ignoré si recettes > seuil
 *
 * Anti-patterns :
 *   - JAMAIS d'import technique dans ce fichier
 *   - JAMAIS de hardcode du seuil — toujours via regles injectées
 */

import type { Money } from '../../domain/_shared/money.js';
import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';

/**
 * Détermine le régime fiscal applicable pour un exercice donné.
 *
 * @param recettes - recettes annuelles de location meublée (Money)
 * @param regimeChoisi - choix explicite du bailleur ('micro_bic' | 'reel') ou undefined (auto)
 * @param regles - règles fiscales versionnées (REGLES_2026 ou équivalent)
 * @returns 'micro_bic' | 'reel'
 *
 * @see D-FIS-G4.3 — choix régime libre sous seuil, forcé au-dessus
 * @see CGI art. 50-0 — seuil micro-BIC (83 600 € en 2026-2028)
 * @see BOFIP-BIC-DECLA-10-30 — option réel renouvelable 1 an tacitement
 * @see T-05-06-08 — threat mitigation : override ignoré si > seuil
 */
export function choisirRegime(
  recettes: Money,
  regimeChoisi: 'micro_bic' | 'reel' | undefined,
  regles: RegleFiscale2026,
): 'micro_bic' | 'reel' {
  // (a) Forçage réel : recettes > seuil micro-BIC — CGI art. 50-0
  // T-05-06-08 : override 'micro_bic' ignoré silencieusement dans ce cas
  if (recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE)) {
    return 'reel';
  }

  // (b) Option bailleur : override 'reel' sous le seuil — BOFIP-BIC-DECLA-10-30
  if (regimeChoisi === 'reel') {
    return 'reel';
  }

  // (c) Défaut micro-BIC sous le seuil
  return 'micro_bic';
}
