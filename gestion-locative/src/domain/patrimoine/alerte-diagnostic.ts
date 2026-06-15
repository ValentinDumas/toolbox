/**
 * Alertes diagnostics techniques immobiliers — Phase 7 / DAS-02 / D-AL-02.
 *
 * Produit une Alerte (D-AL-01) par diagnostic actif (DPE / gaz / élec) dont la
 * dateExpiration tombe dans la fenêtre [-30, +30] par rapport à maintenant.
 *
 * Règles :
 *   D-77 / D-SRC-03 — ERP exclu (validité illimitée, dateExpiration toujours null).
 *   D-79 — seul le diagnostic actif par type (le plus récent par dateEmission)
 *           est considéré ; les versions remplacées sont ignorées.
 *   D-SRC-04 — granularité 1 alerte par diagnostic actif par type (jusqu'à 3 par Bien).
 *   D-80 — un diagnostic déjà expiré (jusqu'à J-30) reste visible (miroir).
 *
 * Fonction pure, maintenant passé en argument — jamais de Temporal.Now ici.
 * Le Clock vit dans le use case (07-04, pattern Clock-driven).
 * Aucun import technique (fastify, kysely, better-sqlite3, node:).
 */

import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';
import { TYPES_DIAGNOSTIC } from '../_shared/duree-validite-diagnostic.js';

import type { Bien } from './bien.js';

const FENETRE_ALERTE_JOURS = 30;

/**
 * Retourne la liste triée des Alerte[] (D-AL-01) par joursRestants ASC
 * pour tous les diagnostics actifs (DPE / gaz / élec) dont l'expiration
 * tombe dans la fenêtre [-30, +30] jours.
 *
 * @param biens  Liste des Biens à analyser.
 * @param maintenant  Date courante injectée par le use case via Clock.
 */
export function calculerAlertesDiagnostic(
  biens: readonly Bien[],
  maintenant: Temporal.PlainDate,
): Alerte[] {
  const alertes: Alerte[] = [];

  for (const bien of biens) {
    for (const type of TYPES_DIAGNOSTIC) {
      // D-79 : diagnostic actif = le plus récent par dateEmission pour ce type
      const diag = bien.diagnosticActif(type);
      if (diag === null) continue;

      // D-77 / D-SRC-03 : ERP exclu (validité illimitée)
      if (diag.dateExpiration === null) continue;

      const j = joursAvantEcheance(diag.dateExpiration, maintenant);

      // Fenêtre [-30, +30] : hors fenêtre → pas d'alerte
      if (j > FENETRE_ALERTE_JOURS || j < -30) continue;

      alertes.push({
        type: 'diagnostic',
        joursRestants: j,
        dateEcheance: diag.dateExpiration,
        libelle: `Diagnostic ${diag.type.toUpperCase()}`,
        urlAction: `/biens/${bien.id}#diagnostics-heading`,
        source: {
          type: 'diagnostic',
          refId: diag.id,
          bienId: bien.id,
          extra: { typeDiagnostic: diag.type },
        },
      });
    }
  }

  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
