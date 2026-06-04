/**
 * Types DTO — brouillon liasse fiscale Phase 6 / FIS-05.
 *
 * Sources :
 *   - D-L6.1 : case-par-case `{numéro + libelléOfficiel + valeur}` (3 champs obligatoires).
 *   - D-A6.1 : annexes V1 strictement limitées à 2031-SD + 2033-A/B/C/D + 2042-C-PRO.
 *   - D-A6.2 : poste 2033-A non modélisé → `valeur: null` + `mention: "à compléter manuellement"`.
 *   - D-T6.4 : la `valeur` provient TOUJOURS du snapshot `DeclarationAnnuelle` (Phase 5).
 *
 * Le DTO est extensible Wave 2/3 (Plans 03-05 ajoutent traçabilité, réconciliation, rectificative)
 * mais Wave 1 livre uniquement la fondation case-par-case régime réel.
 */

import { Temporal } from '@js-temporal/polyfill';

import type { Money } from '../../_shared/money.js';

/**
 * Annexes V1 couvertes par le brouillon liasse.
 *
 * - `2031-SD` : déclaration de résultats BIC (régime réel) — formulaire principal.
 * - `2033-A` : bilan simplifié — postes calculables uniquement (D-A6.2).
 * - `2033-B` : compte de résultat simplifié — cœur du brouillon (D-A6.3).
 * - `2033-C` : immobilisations et amortissements — composants Phase 5 (D-A6.4).
 * - `2033-D` : provisions, déficits, ARD reportable — solde `ardGenere/Consomme` (D-A6.4).
 * - `2042-C-PRO` : report micro-BIC sur la déclaration de revenus — peuplé Plan 02.
 *
 * 2033-E (CVAE) : V1.1 (rare LMNP). 2033-F/G : exclues personne physique.
 */
export type AnnexeLiasse =
  | '2031-SD'
  | '2033-A'
  | '2033-B'
  | '2033-C'
  | '2033-D'
  | '2042-C-PRO';

/**
 * Clé de résolution de la valeur d'une case côté snapshot.
 *
 * Le use case `genererBrouillonLiasse` (Task 2) lit cette clé et la résout
 * contre un champ du snapshot `DeclarationAnnuelle` ou contre un calcul dérivé.
 * En aucun cas le use case ne lit un nom de variable libre — tout transite
 * par ce type union strict (anti-pattern §1 RESEARCH.md : pas de hardcode).
 *
 * `manuel` = la case n'est pas calculable Wave 1 → la valeur reste `null` et
 * la case porte la mention "à compléter manuellement" (D-A6.2).
 */
export type SourceCleSnapshot =
  | 'recettesTotales'
  | 'beneficeFiscal'
  | 'deficitFiscal'
  | 'dotationAmortissement'
  | 'ardGenere'
  | 'ardConsomme'
  | 'chargesAutresExternes'
  | 'chargesImpotsTaxes'
  | 'immobilisationsConstructionsBrut'
  | 'immobilisationsMobilierBrut'
  | 'amortissementsCumulesConstructions'
  | 'amortissementsCumulesMobilier'
  | 'vncConstructions'
  | 'manuel';

/**
 * Définition statique d'une case (vit dans `mapping-liasse-2026.ts`).
 *
 * - `caseId` est unique au sein du mapping millésimé (clé d'injectivité testée).
 * - `numero` est le code cerfa visible (ex. `CB`, `FK`, `FY`, `1GF`).
 * - `libelleOfficiel` est la copie exacte du formulaire (D-L6.1).
 * - `source` indique au use case quelle valeur du snapshot lui injecter.
 * - `section` est un libellé sémantique optionnel pour regrouper visuellement
 *   plusieurs cases d'une même annexe (ex. "Produits" / "Charges" sur 2033-B).
 */
export interface CaseLiasseDef {
  readonly caseId: string;
  readonly numero: string;
  readonly libelleOfficiel: string;
  readonly annexe: AnnexeLiasse;
  readonly source: SourceCleSnapshot;
  readonly section?: string;
}

/**
 * Case résolue présentée à la vue HTML (D-L6.1).
 *
 * - `valeur` = `null` si le snapshot ne porte pas la donnée (D-A6.2).
 *   Dans ce cas la vue affiche la `mention` (par défaut "à compléter manuellement").
 * - `valeur` est TOUJOURS dérivée du snapshot `DeclarationAnnuelle`, jamais recalculée
 *   côté UI (D-T6.4 + anti-pattern Phase 5 #3).
 */
/**
 * Source vivante drillable (Plan 06-03 / D-T6.1 / D-T6.2).
 *
 * `type` distingue les 3 catégories de pièces consommées (recette / charge / amortissement).
 * `url` est un lien interne audit-friendly vers la pièce ou un listing filtré.
 */
export interface SourceDto {
  readonly type: 'recette' | 'charge' | 'amortissement';
  readonly label: string;
  readonly url: string;
  readonly montant: Money;
}

export interface CaseLiasseDto {
  readonly numero: string;
  readonly libelleOfficiel: string;
  readonly annexe: AnnexeLiasse;
  readonly valeur: Money | null;
  readonly mention?: string;
  /** Plan 06-03 — Sources vivantes drillables (D-T6.1). Vide ou absent si case non sourceable. */
  readonly sources?: ReadonlyArray<SourceDto>;
}

/**
 * Section d'une annexe rendue à l'écran (un tableau par section).
 *
 * - `titre` est l'en-tête `<h3>` lisible (ex. "Annexe 2033-B — Compte de résultat 2026").
 * - `bandeauPostesManuels` (utilisé sur 2033-A) déclenche le rendu d'un
 *   `banniere-warning` au-dessus du tableau (D-A6.2).
 */
export interface SectionLiasseDto {
  readonly titre: string;
  readonly annexe: AnnexeLiasse;
  readonly cases: ReadonlyArray<CaseLiasseDto>;
  readonly bandeauPostesManuels?: boolean;
}

/**
 * DTO racine du brouillon liasse (one declaration → one brouillon).
 *
 * Wave 1 livre les champs minimaux. Plans suivants ajouteront sans casser :
 *   - Plan 03 (FIS-05.2) : `tracabiliteParCase` + `reconciliation` (D-T6.x).
 *   - Plan 04 (FIS-05.3) : `motifRectification` quand la liasse vient de `DeclarationCorrigee`.
 *   - Plan 05 (FIS-05.4) : pas de modif du DTO ; ajout d'un builder PDF + d'un use case CSV.
 */
export interface BrouillonLiasseDto {
  readonly exercice: number;
  readonly regimeApplique: 'micro_bic' | 'reel';
  readonly bailleurNom: string;
  readonly sections: ReadonlyArray<SectionLiasseDto>;
  readonly clotureLe: Temporal.PlainDate;
  /** Plan 06-03 — résultat de la réconciliation snapshot/vivant (D-T6.4). */
  readonly reconciliation?: import('../reconciliation.js').ResultatReconciliation;
  /** Plan 06-04 — si le brouillon est rendu depuis une DeclarationCorrigee. */
  readonly motifRectification?: string;
  /** Plan 06-04 — URL vers la liasse originale (audit-friendly). */
  readonly urlOriginale?: string;
}
