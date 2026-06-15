/**
 * Alertes fin de bail — Phase 7 / DAS-02 / Plan 07-02 / D-SRC-05 / D-FB-01..03.
 *
 * Produit des Alerte[] unifiés (contrat D-AL-01) pour les baux actifs dont la fin
 * (`dateDebut + dureeMois`) tombe dans la fenêtre [-30, +60] jours (D-SRC-05 / D-FB-03).
 *
 * V1 = alerte seule — AUCUNE mutation du Bail (pas de flag `cloture`, pas de
 * `successeur`, pas de `statut`) conformément à D-FB-01 et D-FB-04.
 * L'action cible est la fiche Bail `/baux/{id}` (D-FB-02).
 *
 * Filtre actif (D-SRC-03 fin_bail) : seuls les baux dont `actifDepuis !== null`
 * sont évalués — les brouillons ne génèrent pas d'alerte.
 *
 * Pattern Clock-driven (anti-cron) : `maintenant` est TOUJOURS passé en argument.
 * Ce module n'accède JAMAIS à Temporal.Now, à un Clock ou à une infrastructure.
 * Le Clock est injecté au point d'entrée (use case 07-04).
 *
 * Aucun import technique : seuls @js-temporal/polyfill, domaine _shared et
 * domaine locatif sont autorisés (dependency-cruiser Phase 5.1).
 */

import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';

import type { Bail } from './bail.js';

/**
 * Date de fin du bail = dateDebut + dureeMois (D-29 Phase 1).
 *
 * Utilise `Temporal.PlainDate.add({ months })` qui gère correctement le clamp
 * sur les fins de mois (ex. 2025-01-31 + 1 mois = 2025-02-28).
 */
export function dateFinBail(bail: Bail): Temporal.PlainDate {
  return bail.dateDebut.add({ months: bail.dureeMois });
}

/**
 * Vrai si la fin de bail doit déclencher une alerte.
 *
 * - `bail.actifDepuis === null` → false (D-SRC-03 — brouillon ignoré).
 * - Fenêtre RÉELLE : `j <= 30 && j >= -60` (D-SRC-05 / D-FB-03) — le code alerte
 *   30 jours AVANT la fin (j positif = jours restants) et jusqu'à 60 jours APRÈS
 *   (j négatif = jours écoulés depuis la fin). Fenêtre = [-30 avant fin, +60 après fin].
 *
 * @param bail       Bail à évaluer (lu en readonly — aucune mutation).
 * @param maintenant Date courante (injectée via Clock).
 */
export function estAlerteFinBailActive(bail: Bail, maintenant: Temporal.PlainDate): boolean {
  if (bail.actifDepuis === null) return false; // D-SRC-03 — exclut les brouillons
  const dateFin = dateFinBail(bail);
  const j = joursAvantEcheance(dateFin, maintenant);
  return j <= 30 && j >= -60; // fenêtre J-30 (avant) à J+60 (après) — D-SRC-05 / D-FB-03
}

/**
 * Retourne la liste triée des Alerte[] (type='fin_bail') pour les baux éligibles.
 *
 * - Tri : joursRestants ASC (plus urgent en premier).
 * - urlAction : `/baux/{bailId}` — fiche bail (D-FB-02).
 * - Aucune mutation du Bail (D-FB-01 / D-FB-04) : pas de flag cloture, pas de successeur.
 *
 * @param baux                Liste des baux (readonly — aucune mutation).
 * @param maintenant          Date courante (injectée via Clock).
 * @param nomLocataireParBail Map optionnelle BailId → nom complet du locataire.
 *                            Construite par le use case (jamais un repo dans le domaine).
 */
export function calculerAlertesFinBail(
  baux: readonly Bail[],
  maintenant: Temporal.PlainDate,
  nomLocataireParBail?: Map<string, string>,
): Alerte[] {
  const alertes: Alerte[] = [];

  for (const bail of baux) {
    if (!estAlerteFinBailActive(bail, maintenant)) continue;
    const dateFin = dateFinBail(bail);
    alertes.push({
      type: 'fin_bail',
      joursRestants: joursAvantEcheance(dateFin, maintenant),
      dateEcheance: dateFin,
      libelle: 'Fin de bail',
      urlAction: `/baux/${bail.id}`,
      source: {
        type: 'fin_bail',
        refId: bail.id,
        bienId: bail.bienId,
        extra: { nomLocataire: nomLocataireParBail?.get(bail.id) ?? '' },
      },
    });
  }

  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
