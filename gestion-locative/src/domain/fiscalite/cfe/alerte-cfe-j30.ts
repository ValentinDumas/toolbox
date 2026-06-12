/**
 * Alerte CFE J-30 — Phase 6 / FIS-06 / Plan 06-07 / D-CFE6.5.
 * Refactoré Phase 7 / DAS-02 / 07-01 : calculerAlertesCfe produit désormais
 * des Alerte[] unifiés (D-AL-01). La compatibilité Phase 6 est assurée par la
 * projection plate AlerteCfe au niveau du use case lister-alertes-cfe-actives.ts.
 *
 * Calcul À LA DEMANDE via Clock injecté — PAS de cron, PAS de setInterval
 * (anti-pattern §6 RESEARCH + Pattern critique 4 Phase 3 D-90 banner IRL).
 *
 * Fonctions pures domain — aucune dépendance infra/Clock/repo en interne.
 * Le Clock est injecté au point d'entrée (use case) qui calcule `maintenant`
 * et le passe en argument.
 *
 * Pitfall §5 RESEARCH : les statuts `payee`, `exoneree_premiere_annee` et
 * `exoneree_commune` sont strictement filtrés AVANT calcul — pas de banner
 * sur CFE déjà payée ou exonérée.
 */

import { Temporal } from '@js-temporal/polyfill';

import type { BienId, DeclarationCfeId } from '../../_shared/identifiants.js';
import { type Alerte, joursAvantEcheance } from '../../_shared/alerte.js';

import type { DeclarationCfe } from './declaration-cfe.js';
import type { StatutCfe } from './statut-cfe.js';

// Ré-export pour compatibilité avec les imports Phase 6 existants
export { joursAvantEcheance } from '../../_shared/alerte.js';

const FENETRE_ALERTE_JOURS = 30;

const STATUTS_ALERTABLES: ReadonlySet<StatutCfe> = new Set(['non_deposee', 'deposee']);

/**
 * Projection plate Phase 6 — DTO consommé par les routes web et le partial EJS.
 *
 * Cette interface est la projection de compatibilité Phase 6 ; elle est produite
 * par le use case lister-alertes-cfe-actives.ts à partir des Alerte[] unifiés.
 * Le dashboard Phase 7 (07-04/07-05) consomme directement les Alerte[] unifiés.
 */
export interface AlerteCfe {
  readonly declarationCfeId: DeclarationCfeId;
  readonly bienId: BienId;
  readonly millesime: number;
  /** Peut être négatif si l'échéance est dépassée. */
  readonly joursRestants: number;
  readonly dateEcheancePaiement: Temporal.PlainDate;
  readonly statutCfe: StatutCfe;
}

/**
 * Vrai si la CFE doit déclencher un banner d'alerte.
 * - Filtre statut : seuls `non_deposee` et `deposee` peuvent déclencher (D-CFE6.5 + pitfall §5).
 * - Fenêtre : `joursRestants <= 30` (toutes les valeurs ≤ 30, y compris les négatives).
 *   - J-30 à J-0 : warning / warning forte.
 *   - J+1 et plus : destructive (échéance dépassée).
 * - Borne inférieure pour les vieilles déclarations non payées : `-60 jours` (au-delà,
 *   pas de banner — l'utilisateur est de toute façon hors délai au point que l'alerte
 *   devient du bruit, à voir avec retours utilisateurs).
 */
export function estAlerteActive(
  d: DeclarationCfe,
  maintenant: Temporal.PlainDate,
): boolean {
  if (!STATUTS_ALERTABLES.has(d.statut)) return false;
  const j = joursAvantEcheance(d.dateEcheancePaiement, maintenant);
  return j <= FENETRE_ALERTE_JOURS && j >= -60;
}

/**
 * Retourne la liste triée des Alerte[] unifiés (D-AL-01) par `joursRestants ASC`
 * (plus urgent en premier).
 *
 * Le dashboard 07-04/07-05 consomme ces Alerte[] directement sans mapping.
 * La projection vers AlerteCfe plat est faite dans le use case lister-alertes-cfe-actives.ts.
 */
export function calculerAlertesCfe(
  declarations: readonly DeclarationCfe[],
  maintenant: Temporal.PlainDate,
): Alerte[] {
  const alertes: Alerte[] = [];
  for (const d of declarations) {
    if (!estAlerteActive(d, maintenant)) continue;
    const joursRestants = joursAvantEcheance(d.dateEcheancePaiement, maintenant);
    alertes.push({
      type: 'cfe',
      joursRestants,
      dateEcheance: d.dateEcheancePaiement,
      libelle: `CFE ${d.millesime}`,
      urlAction: `/biens/${d.bienId}/cfe/${d.id}/editer`,
      source: {
        type: 'cfe',
        refId: d.id,
        bienId: d.bienId,
        extra: {
          millesime: d.millesime,
          statutCfe: d.statut,
          dateEcheancePaiement: d.dateEcheancePaiement,
        },
      },
    });
  }
  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
