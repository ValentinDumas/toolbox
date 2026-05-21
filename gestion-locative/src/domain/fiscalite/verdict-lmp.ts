/**
 * Type VerdictLmp — verdict tri-état de la bascule LMNP/LMP (D-FIS-G3.3).
 *
 * Domaine pur : aucun import technique.
 * Défini ici pour être importable par les agrégats du domaine (DeclarationAnnuelle, DeclarationCorrigee).
 * Re-exporté par src/application/fiscalite/detecter-bascule-lmp.ts (rétrocompatibilité).
 *
 * Sources juridiques :
 *   CGI art. 155 IV — critères LMP depuis Conseil Constitutionnel n° 2009-587 DC
 *   D-FIS-G3.3 — verdict tri-état
 *   D-FIS-G3.4 — anti-sticky : chaque exercice évalué indépendamment
 */

/**
 * Verdict tri-état de la bascule LMNP/LMP.
 *
 * Source : D-FIS-G3.3 (CONTEXT.md Phase 5).
 * Valeurs :
 *   - 'lmnp_confirme' : les deux critères CGI 155 IV ne sont pas tous remplis.
 *   - 'lmp_probable' : recettes > 23 000 € ET recettes > revenus actifs foyer.
 *   - 'indetermine_revenus_foyer_manquants' : recettes > 23 000 € mais revenus foyer absents.
 */
export type VerdictLmp =
  | 'lmnp_confirme'
  | 'lmp_probable'
  | 'indetermine_revenus_foyer_manquants';
