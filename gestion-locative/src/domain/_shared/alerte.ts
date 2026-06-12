/**
 * Contrat partagé Alerte unifié — Phase 7 / DAS-02 / D-AL-01.
 *
 * Ce module définit le read-model commun aux 4 sources d'alerte (CFE, IRL,
 * diagnostic, fin de bail). Il est consommé par l'agrégateur 07-04 et par
 * les plans 07-02 / 07-03 / 07-05.
 *
 * Principe Clock-driven : `maintenant` est TOUJOURS passé en argument aux
 * fonctions pures — ce module n'accède JAMAIS à un Clock, à Temporal.Now,
 * ni à aucune infrastructure. Le Clock est injecté au point d'entrée (use
 * case), cf. pattern miroir Phase 3 D-90 banner IRL et Phase 6 D-CFE6.5.
 *
 * Aucun import technique : seuls @js-temporal/polyfill et ./identifiants.js
 * sont autorisés (domaine pur, dependency-cruiser Phase 5.1).
 */

import { Temporal } from '@js-temporal/polyfill';

import type { BienId } from './identifiants.js';

/** Discriminant des 4 sources d'alerte de la Phase 7 (D-AL-01). */
export type TypeAlerte = 'cfe' | 'irl' | 'diagnostic' | 'fin_bail';

/**
 * Read-model unifié Alerte (D-AL-01, forme verrouillée).
 *
 * Produit par les fonctions pures du domaine (calculerAlertesCfe, etc.)
 * et consommé directement par l'agrégateur 07-04 sans mapping supplémentaire.
 */
export interface Alerte {
  /** Discriminant — permet aux consommateurs de narrower sur la source. */
  readonly type: TypeAlerte;
  /** Jours entre aujourd'hui et l'échéance. Peut être négatif si dépassée. */
  readonly joursRestants: number;
  /** Date d'échéance de l'alerte. */
  readonly dateEcheance: Temporal.PlainDate;
  /** Libellé pré-calculé côté domaine (ex. 'CFE 2026', 'IRL T1 2026'). */
  readonly libelle: string;
  /** URL de l'action associée — string brut V1, route Phase 6/7 existante. */
  readonly urlAction: string;
  /** Données d'origine pour le narrowing et l'affichage enrichi. */
  readonly source: {
    readonly type: TypeAlerte;
    /** Identifiant de l'entité source (DeclarationCfeId, BailId, DiagnosticId…). */
    readonly refId: string;
    /** Bien concerné (optionnel selon la source). */
    readonly bienId?: BienId;
    /** Données complémentaires propres à chaque source (millesime, statutCfe, classeDpe…). */
    readonly extra?: Record<string, unknown>;
  };
}

/**
 * Nombre de jours entre `maintenant` et `dateEcheance`.
 *
 * - Positif : l'échéance est future.
 * - 0 : jour J.
 * - Négatif : l'échéance est dépassée.
 *
 * @param dateEcheance Date de l'échéance.
 * @param maintenant Date courante (injectée par le use case via Clock).
 */
export function joursAvantEcheance(
  dateEcheance: Temporal.PlainDate,
  maintenant: Temporal.PlainDate,
): number {
  return maintenant.until(dateEcheance, { largestUnit: 'days' }).days;
}
