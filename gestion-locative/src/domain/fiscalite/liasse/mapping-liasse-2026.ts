/**
 * Mapping case-par-case liasse fiscale BIC millésime 2026 (Phase 6 / FIS-05 / D-L6.3).
 *
 * Sources juridiques (à citer dans les tests BDD) :
 *   - Cerfa 2031-SD (déclaration de résultats BIC) millésime 2026 :
 *     https://www.impots.gouv.fr/sites/default/files/formulaires/2031-sd/2026/2031-sd_5396.pdf
 *   - Annexes 2033-A (bilan simplifié), 2033-B (compte de résultat),
 *     2033-C (immobilisations & amortissements), 2033-D (provisions, déficits, ARD).
 *   - CGI art. 39 (amortissements), 39 B (ARD), 50-0 (micro-BIC), 155 IV (bascule LMP).
 *
 * Couverture V1 (D-A6.1) : 2031-SD + 2033-A/B/C/D + squelette 2042-C-PRO (peuplé Plan 02).
 * Hors scope V1 : 2033-E (CVAE > 152 500 €), 2033-F/G (sans objet personne physique).
 *
 * Niveau de confiance des codes lettres : MEDIUM (RESEARCH.md §Cerfa Case Mapping).
 * Les codes lettres retenus correspondent au PDF officiel 2031-SD millésime 2026
 * (CB = bénéfice fiscal, CC = déficit fiscal, FC = recettes, FK = autres charges
 * externes, FY = dotations d'exploitation aux amortissements, GA = résultat 2033-B).
 * Au moindre doute lors de l'écriture/relecture de ce fichier, rouvrir le PDF officiel.
 *
 * **R1.1 RISKS.md — surveillance fiscale annuelle :**
 * Le cerfa peut changer chaque année (LF). Mapping revu en janvier post-LF →
 * créer `mapping-liasse-2027.ts` à la prochaine révision en revérifiant chaque
 * code lettre sur le PDF officiel impots.gouv.fr.
 *
 * **ANTI-PATTERNS à éviter (RESEARCH.md §Common Pitfalls) :**
 *   - Pitfall §1 : ne JAMAIS hardcoder un numéro de case dans `application/` ou `web/`.
 *     Tout passe par ce fichier via le port `MappingLiasseProvider`.
 *   - Pitfall §3 : `amelioration` est **immobilisable**, donc inscrite sur 2033-C
 *     (augmentations exercice) — JAMAIS sur 2033-B "Autres charges externes".
 *   - Pitfall §6 : différence sémantique vs `RegleFiscaleProvider` (triennal) — ici
 *     un seul millésime est couvert, fail-fast sur tout autre.
 */

import type {
  AnnexeLiasse,
  CaseLiasseDef,
} from './case-liasse.js';

/**
 * Interface du mapping millésimé — versionnable au cerfa annuel (D-L6.3).
 * Permet d'introduire `MappingLiasse2027` / `MappingLiasse2028` sans casser
 * les use cases qui dépendent uniquement de `pour(millesime)`.
 */
export interface MappingLiasse2026 {
  /** Millésime du cerfa couvert (verrouillé à 2026 pour V1). */
  readonly millesime: 2026;
  /** Sections par annexe — chaque section est un tableau ordonné de définitions de cases. */
  readonly sections: Readonly<Record<AnnexeLiasse, ReadonlyArray<CaseLiasseDef>>>;
}

/**
 * Mapping case-par-case officiel 2026 (D-L6.3).
 *
 * Ordre des sections rendu à l'écran (S2 UI-SPEC) :
 *   2031-SD → 2033-A → 2033-B → 2033-C → 2033-D
 *
 * Le 2042-C-PRO est exposé vide pour Wave 1 ; il sera peuplé au Plan 02 (micro-BIC).
 */
export const MAPPING_LIASSE_2026: MappingLiasse2026 = {
  millesime: 2026,
  sections: {
    // ── 2031-SD — Déclaration de résultats BIC (régime réel) ───────────────
    // Codes lettres officiels millésime 2026 : CB (bénéfice fiscal), CC (déficit fiscal).
    // La case "régime imposition" est un poste informatif (constant `'reel'` Wave 1).
    '2031-SD': [
      {
        caseId: '2031-SD.CB',
        numero: 'CB',
        libelleOfficiel: 'Bénéfice fiscal (régime réel BIC)',
        annexe: '2031-SD',
        source: 'beneficeFiscal',
        section: 'Résultat fiscal',
      },
      {
        caseId: '2031-SD.CC',
        numero: 'CC',
        libelleOfficiel: 'Déficit fiscal (régime réel BIC)',
        annexe: '2031-SD',
        source: 'deficitFiscal',
        section: 'Résultat fiscal',
      },
      {
        caseId: '2031-SD.regime',
        numero: '—',
        libelleOfficiel: 'Régime d\'imposition (BIC réel simplifié / normal)',
        annexe: '2031-SD',
        source: 'manuel',
        section: 'Identification',
      },
    ],

    // ── 2033-A — Bilan simplifié (postes calculables uniquement, D-A6.2) ───
    // Postes calculés : immobilisations constructions/mobilier (brut), amortissements
    // cumulés, VNC. Postes non modélisés (trésorerie, créances, dettes, emprunts)
    // restent marqués "à compléter manuellement" et déclenchent le bandeau S3.
    '2033-A': [
      {
        caseId: '2033-A.constructions-brut',
        numero: 'AN',
        libelleOfficiel: 'Constructions — valeur brute',
        annexe: '2033-A',
        source: 'immobilisationsConstructionsBrut',
        section: 'Actif immobilisé',
      },
      {
        caseId: '2033-A.constructions-amort',
        numero: 'AP',
        libelleOfficiel: 'Constructions — amortissements cumulés',
        annexe: '2033-A',
        source: 'amortissementsCumulesConstructions',
        section: 'Actif immobilisé',
      },
      {
        caseId: '2033-A.constructions-vnc',
        numero: 'AQ',
        libelleOfficiel: 'Constructions — valeur nette comptable',
        annexe: '2033-A',
        source: 'vncConstructions',
        section: 'Actif immobilisé',
      },
      {
        caseId: '2033-A.mobilier-brut',
        numero: 'AT',
        libelleOfficiel: 'Autres immobilisations corporelles (mobilier) — valeur brute',
        annexe: '2033-A',
        source: 'immobilisationsMobilierBrut',
        section: 'Actif immobilisé',
      },
      {
        caseId: '2033-A.mobilier-amort',
        numero: 'AV',
        libelleOfficiel: 'Autres immobilisations corporelles (mobilier) — amortissements cumulés',
        annexe: '2033-A',
        source: 'amortissementsCumulesMobilier',
        section: 'Actif immobilisé',
      },
      {
        caseId: '2033-A.tresorerie',
        numero: 'CD',
        libelleOfficiel: 'Disponibilités (trésorerie)',
        annexe: '2033-A',
        source: 'manuel',
        section: 'Actif circulant',
      },
      {
        caseId: '2033-A.creances',
        numero: 'BX',
        libelleOfficiel: 'Créances clients et autres créances',
        annexe: '2033-A',
        source: 'manuel',
        section: 'Actif circulant',
      },
      {
        caseId: '2033-A.emprunts',
        numero: 'DV',
        libelleOfficiel: 'Emprunts auprès des établissements de crédit',
        annexe: '2033-A',
        source: 'manuel',
        section: 'Passif',
      },
      {
        caseId: '2033-A.dettes',
        numero: 'DX',
        libelleOfficiel: 'Dettes fournisseurs et autres dettes',
        annexe: '2033-A',
        source: 'manuel',
        section: 'Passif',
      },
    ],

    // ── 2033-B — Compte de résultat simplifié (cœur du brouillon, D-A6.3) ──
    // Codes lettres officiels millésime 2026 :
    //   FC = chiffre d'affaires net (recettes locatives meublées),
    //   FK = autres achats et charges externes (entretien/réparation + courantes),
    //   FX = impôts, taxes et versements assimilés (CFE, taxe foncière selon ventilation),
    //   FY = dotations d'exploitation aux amortissements,
    //   GA = résultat de l'exercice (= recettes - charges - dotations + ARD).
    //
    // Cohérence Phase 5 D-FIS-G2.2 (cf. anti-pattern §3 RESEARCH.md) :
    //   `chargesAutresExternes` somme UNIQUEMENT `entretien_reparation +
    //   charge_courante_periodique`. `amelioration` est IMMOBILISÉE
    //   (2033-C augmentations), jamais sur 2033-B.
    '2033-B': [
      {
        caseId: '2033-B.FC',
        numero: 'FC',
        libelleOfficiel: 'Chiffre d\'affaires net (recettes locatives meublées)',
        annexe: '2033-B',
        source: 'recettesTotales',
        section: 'Produits d\'exploitation',
      },
      {
        caseId: '2033-B.FK',
        numero: 'FK',
        libelleOfficiel: 'Autres achats et charges externes (entretien, réparations, charges courantes)',
        annexe: '2033-B',
        source: 'chargesAutresExternes',
        section: 'Charges d\'exploitation',
      },
      {
        caseId: '2033-B.FX',
        numero: 'FX',
        libelleOfficiel: 'Impôts, taxes et versements assimilés (CFE, taxe foncière)',
        annexe: '2033-B',
        source: 'chargesImpotsTaxes',
        section: 'Charges d\'exploitation',
      },
      {
        caseId: '2033-B.FY',
        numero: 'FY',
        libelleOfficiel: 'Dotations d\'exploitation aux amortissements (composants BOFIP)',
        annexe: '2033-B',
        source: 'dotationAmortissement',
        section: 'Charges d\'exploitation',
      },
      {
        caseId: '2033-B.ardGenere',
        numero: 'FZ',
        libelleOfficiel: 'Amortissement réputé différé (ARD) généré sur l\'exercice — CGI art. 39 B',
        annexe: '2033-B',
        source: 'ardGenere',
        section: 'Amortissements différés',
      },
      {
        caseId: '2033-B.GA',
        numero: 'GA',
        libelleOfficiel: 'Résultat de l\'exercice (bénéfice ou déficit)',
        annexe: '2033-B',
        source: 'beneficeFiscal',
        section: 'Résultat',
      },
    ],

    // ── 2033-C — Immobilisations et amortissements (D-A6.4) ────────────────
    // Cohérence flux 2033-B/2033-C : la dotation exercice 2033-C = dotation 2033-B
    // = `decl.dotationAmortissement` (invariant testé Task 2).
    '2033-C': [
      {
        caseId: '2033-C.constructions-debut',
        numero: 'KA',
        libelleOfficiel: 'Constructions — valeur début exercice',
        annexe: '2033-C',
        source: 'manuel',
        section: 'Immobilisations',
      },
      {
        caseId: '2033-C.constructions-augmentations',
        numero: 'KB',
        libelleOfficiel: 'Constructions — augmentations exercice (acquisitions, améliorations)',
        annexe: '2033-C',
        source: 'manuel',
        section: 'Immobilisations',
      },
      {
        caseId: '2033-C.constructions-fin',
        numero: 'KC',
        libelleOfficiel: 'Constructions — valeur fin exercice',
        annexe: '2033-C',
        source: 'immobilisationsConstructionsBrut',
        section: 'Immobilisations',
      },
      {
        caseId: '2033-C.amort-debut',
        numero: 'KD',
        libelleOfficiel: 'Amortissements cumulés début exercice',
        annexe: '2033-C',
        source: 'manuel',
        section: 'Amortissements',
      },
      {
        caseId: '2033-C.amort-dotation',
        numero: 'KE',
        libelleOfficiel: 'Dotation aux amortissements de l\'exercice',
        annexe: '2033-C',
        source: 'dotationAmortissement',
        section: 'Amortissements',
      },
      {
        caseId: '2033-C.amort-fin',
        numero: 'KF',
        libelleOfficiel: 'Amortissements cumulés fin exercice',
        annexe: '2033-C',
        source: 'amortissementsCumulesConstructions',
        section: 'Amortissements',
      },
    ],

    // ── 2033-D — Provisions, déficits, ARD (D-A6.4) ────────────────────────
    // ARD cumulé fin exercice = ardGenere + soldes antérieurs (Phase 5 expose le solde
    // exercice ; le cumul historique sera enrichi Plan 03 via TableauAmortRepo).
    '2033-D': [
      {
        caseId: '2033-D.ardGenere',
        numero: 'WG',
        libelleOfficiel: 'Amortissement réputé différé (ARD) — solde cumulé fin exercice — CGI art. 39 B',
        annexe: '2033-D',
        source: 'ardGenere',
        section: 'ARD reportable',
      },
      {
        caseId: '2033-D.ardConsomme',
        numero: 'WH',
        libelleOfficiel: 'ARD consommé sur l\'exercice (imputé sur bénéfice)',
        annexe: '2033-D',
        source: 'ardConsomme',
        section: 'ARD reportable',
      },
      {
        caseId: '2033-D.deficitFiscal',
        numero: 'WI',
        libelleOfficiel: 'Déficit fiscal reportable de l\'exercice',
        annexe: '2033-D',
        source: 'deficitFiscal',
        section: 'Déficits',
      },
    ],

    // ── 2042-C-PRO — Report micro-BIC (Plan 02) ────────────────────────────
    // Squelette V1 Wave 1 vide. Peuplé au Plan 02 (micro-BIC) — case 5NI
    // (recettes brutes location meublée non professionnelle longue durée).
    '2042-C-PRO': [],
  },
} as const;
