/**
 * Règles fiscales LMNP 2026 versionnées (D-LOCK-1).
 *
 * Sources juridiques (à citer dans les tests BDD et JSDoc) :
 *   - SEUIL_MICRO_BIC_LONGUE_DUREE : CGI art. 50-0 (révision triennale 2026-2028)
 *   - PLANCHER_ABATTEMENT : CGI art. 50-0 (plancher 305 € abattement micro-BIC)
 *   - ABATTEMENT_LONGUE_DUREE : CGI art. 50-0 (taux 50 % location meublée longue durée)
 *   - SEUIL_LMP_RECETTES : CGI art. 155 IV (critère (a) bascule LMP)
 *   - DUREES_AMORTISSEMENT_ANS : CGI art. 39 / BOFIP-BIC-AMT-20-40 (composants BOFIP LMNP)
 *   - LF_2025_DATE_EFFET_PV : LF 2025 art. 84 (loi 2025-127 du 14/02/2025) — réintégration amortissements gros œuvre dans la plus-value (CGI art. 150 VB III)
 *   - ARD_DUREE_REPORT_SANS_LIMITE : CGI art. 39 B (Amortissement Réputé Différé)
 *
 * Seuil micro-BIC 2026 : révision triennale 2025 → 77 700 € (recettes 2025) → 83 600 € (recettes 2026-2028).
 * Source vérifiée : https://www.monmeublesaisonnier.com/blog/micro-bic-lmnp-seuils-abattements-fiscal
 *
 * LF 2026 : aucun amortissement retiré du statut LMNP (sous-amendement 2 %/an rejeté).
 * Source vérifiée : https://www.jedeclaremonmeuble.com/lmnp-2026/
 *
 * Pattern d'évolution : créer regles-2029.ts à la prochaine révision triennale.
 * RegleFiscaleProvider résout par année.
 *
 * ANTI-PATTERN à éviter :
 *   - Ne JAMAIS hardcoder les seuils directement dans les use cases.
 *   - Toujours passer par RegleFiscaleProvider injecté.
 *   - Jamais de float (Money BigInt centimes partout).
 */

import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../_shared/money.js';

/**
 * Les 6 types de composants amortissables selon le BOFIP-BIC-AMT-20-40.
 * Alignés avec la liasse 2031 annexe 2033-B.
 * Le terrain est non amortissable (CGI art. 39) mais modélisé pour la répartition.
 */
export type TypeComposantBofip =
  | 'terrain'
  | 'gros_oeuvre'
  | 'toiture_facade'
  | 'installations_techniques'
  | 'agencements_interieurs'
  | 'mobilier';

/**
 * Interface des règles fiscales — versionnée par année.
 * Permet d'introduire RegleFiscale2027 / RegleFiscale2028 sans toucher les use cases.
 */
export interface RegleFiscale2026 {
  /** Seuil recettes micro-BIC longue durée — CGI art. 50-0 */
  readonly SEUIL_MICRO_BIC_LONGUE_DUREE: Money;
  /** Plancher d'abattement micro-BIC — CGI art. 50-0 (305 €) */
  readonly PLANCHER_ABATTEMENT: Money;
  /** Numérateur du ratio d'abattement (1/2 = 50 %) — CGI art. 50-0 */
  readonly ABATTEMENT_LONGUE_DUREE_NUM: bigint;
  /** Dénominateur du ratio d'abattement (1/2 = 50 %) — CGI art. 50-0 */
  readonly ABATTEMENT_LONGUE_DUREE_DEN: bigint;
  /** Seuil recettes bascule LMP (critère a) — CGI art. 155 IV */
  readonly SEUIL_LMP_RECETTES: Money;
  /** Date d'effet LF 2025 art. 84 — réintégration amortissements gros œuvre dans PV */
  readonly LF_2025_DATE_EFFET_PV: Temporal.PlainDate;
  /** Durées d'amortissement BOFIP par composant (en années) — BOFIP-BIC-AMT-20-40 */
  readonly DUREES_AMORTISSEMENT_ANS: Readonly<Record<TypeComposantBofip, number>>;
  /** ARD reportable sans limite — CGI art. 39 B */
  readonly ARD_DUREE_REPORT_SANS_LIMITE: boolean;
}

/**
 * Constantes fiscales LMNP versionnées pour 2026 (D-LOCK-1).
 *
 * Recettes 2026-2028 : seuil micro-BIC 83 600 € (révision triennale CGI art. 50-0).
 * Abattement longue durée : 50 % (CGI art. 50-0), plancher 305 €.
 * Bascule LMP : recettes > 23 000 € ET recettes > revenus actifs foyer (CGI art. 155 IV).
 *
 * Toutes les valeurs monétaires sont en CENTIMES (BigInt) — jamais de float.
 * Ratios exprimés en num/den BigInt pour réutiliser Money.multiplyByFraction.
 */
export const REGLES_2026: RegleFiscale2026 = {
  /**
   * Seuil micro-BIC longue durée 2026.
   * Source : CGI art. 50-0 (révision triennale 2026-2028 — 83 600 €).
   * Vérifié : révision de 77 700 € (2025) → 83 600 € (2026-2028).
   */
  SEUIL_MICRO_BIC_LONGUE_DUREE: Money.fromCentimes(8_360_000n), // 83 600,00 €

  /**
   * Plancher d'abattement micro-BIC.
   * Source : CGI art. 50-0 (305 €).
   * L'abattement minimum garanti est de 305 € même si 50 % des recettes < 305 €.
   */
  PLANCHER_ABATTEMENT: Money.fromCentimes(30_500n), // 305,00 €

  /**
   * Ratio d'abattement longue durée (50 %) en BigInt pour Money.multiplyByFraction.
   * Source : CGI art. 50-0.
   * Utilisation : recettesFiscales = max(recettes × (1 - 1/2), PLANCHER_ABATTEMENT).
   */
  ABATTEMENT_LONGUE_DUREE_NUM: 1n, // 50 % = 1/2
  ABATTEMENT_LONGUE_DUREE_DEN: 2n, // 50 % = 1/2

  /**
   * Seuil de bascule LMP (critère (a) : recettes > 23 000 €).
   * Source : CGI art. 155 IV.
   * Note : depuis décision Conseil Constitutionnel n° 2009-587 DC, la condition
   * d'inscription au RCS est supprimée. Seuls les deux critères (a) et (b) subsistent.
   * Critère (b) (recettes > revenus actifs foyer) évalué séparément en use case.
   */
  SEUIL_LMP_RECETTES: Money.fromCentimes(2_300_000n), // 23 000,00 €

  /**
   * Date d'effet LF 2025 art. 84 — réintégration amortissements gros œuvre dans PV.
   * Source : loi 2025-127 du 14/02/2025 — CGI art. 150 VB III.
   * Les amortissements gros œuvre postérieurs à cette date sont réintégrés dans
   * l'assiette de la plus-value à la cession (préparation SIM-02 V1.1).
   */
  LF_2025_DATE_EFFET_PV: Temporal.PlainDate.from('2025-02-15'),

  /**
   * Durées d'amortissement BOFIP par composant (en années).
   * Source : CGI art. 39 / BOFIP-BIC-AMT-20-40.
   * Aligné avec la liasse 2031 annexe 2033-B.
   * Le terrain (durée 0) est non amortissable (CGI art. 39).
   */
  DUREES_AMORTISSEMENT_ANS: {
    terrain: 0,                     // non amortissable — CGI art. 39
    gros_oeuvre: 40,                // BOFIP-BIC-AMT-20-40
    toiture_facade: 25,             // BOFIP
    installations_techniques: 20,  // BOFIP
    agencements_interieurs: 15,     // BOFIP
    mobilier: 7,                    // BOFIP (référence typique LMNP : 5-10 ans, 7 par défaut)
  } as const,

  /**
   * ARD (Amortissement Réputé Différé) reportable sans limite de durée.
   * Source : CGI art. 39 B.
   * Champ informatif — la logique ARD est portée par les use cases calcul-amortissement
   * et cloturer-exercice. Cette constante sert de traçabilité réglementaire.
   */
  ARD_DUREE_REPORT_SANS_LIMITE: true,
} as const;
