/**
 * Step definitions @phase7-alerte-diagnostic : alertes diagnostics techniques immobiliers.
 *
 * Stratégie : appel direct de la fonction pure du domaine (calculerAlertesDiagnostic).
 * Aucun repository réel, aucune couche HTTP — domaine pur en mémoire.
 * Pattern miroir tests/bdd/step_definitions/alerte-fin-bail.steps.ts.
 *
 * Couverture Phase 7 / DAS-02 :
 *   D-77 / D-SRC-03 (ERP exclu) / D-SRC-04 (granularité) / D-80 (déjà expiré visible).
 *
 * Tags : @phase7 @phase7-alerte-diagnostic
 */

import assert from 'node:assert/strict';

import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../../../src/domain/_shared/alerte.js';
import { calculerAlertesDiagnostic } from '../../../src/domain/patrimoine/alerte-diagnostic.js';
import {
  unBienValide,
  unDiagnosticDpeValide,
  unDiagnosticGazValide,
  unDiagnosticElecValide,
  unDiagnosticErpValide,
} from '../../_builders/patrimoine.js';
import type { Bien } from '../../../src/domain/patrimoine/bien.js';

// Date fixe pour déterminisme des scénarios (2026-06-11)
const MAINTENANT = Temporal.PlainDate.from('2026-06-11');

interface MondeDiagnostic extends World {
  biens: Bien[];
  alertes: Alerte[];
  [key: string]: unknown;
}

Before({ tags: '@phase7-alerte-diagnostic' }, function (this: MondeDiagnostic) {
  this.biens = [];
  this.alertes = [];
});

// ─── Background ───────────────────────────────────────────────────────────────

Given('un Bien avec un seul diagnostic', function (this: MondeDiagnostic) {
  // Initialisé dans chaque scénario selon le type de diagnostic attendu
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given('un Bien avec un diagnostic ERP', function (this: MondeDiagnostic) {
  const diag = unDiagnosticErpValide({ dateEmission: Temporal.PlainDate.from('2025-01-15') });
  this.biens = [unBienValide({ diagnostics: [diag] })];
});

Given('un Bien avec un DPE expirant dans 15 jours', function (this: MondeDiagnostic) {
  // DPE durée 10 ans : dateExpiration = MAINTENANT + 15 jours → dateEmission = dateExpiration - 10 ans
  const dateExpiration = MAINTENANT.add({ days: 15 });
  const dateEmission = dateExpiration.subtract({ years: 10 });
  const diag = unDiagnosticDpeValide({ dateEmission });
  this.biens = [unBienValide({ diagnostics: [diag] })];
});

Given(
  'un Bien avec DPE, gaz et élec actifs expirant dans la fenêtre',
  function (this: MondeDiagnostic) {
    // DPE : expire dans 10 jours
    const expDpe = MAINTENANT.add({ days: 10 });
    const dpe = unDiagnosticDpeValide({ dateEmission: expDpe.subtract({ years: 10 }) });

    // gaz : expire dans 5 jours
    const expGaz = MAINTENANT.add({ days: 5 });
    const gaz = unDiagnosticGazValide({ dateEmission: expGaz.subtract({ years: 6 }) });

    // élec : expire dans 20 jours
    const expElec = MAINTENANT.add({ days: 20 });
    const elec = unDiagnosticElecValide({ dateEmission: expElec.subtract({ years: 6 }) });

    this.biens = [unBienValide({ diagnostics: [dpe, gaz, elec] })];
  },
);

Given('un Bien avec un gaz expiré depuis 10 jours', function (this: MondeDiagnostic) {
  // gaz durée 6 ans : dateExpiration = MAINTENANT - 10 jours → dateEmission = dateExpiration - 6 ans
  const dateExpiration = MAINTENANT.subtract({ days: 10 });
  const dateEmission = dateExpiration.subtract({ years: 6 });
  const diag = unDiagnosticGazValide({ dateEmission });
  this.biens = [unBienValide({ diagnostics: [diag] })];
});

Given('un Bien avec un élec expirant dans 45 jours', function (this: MondeDiagnostic) {
  // élec durée 6 ans : dateExpiration = MAINTENANT + 45 jours → hors fenêtre +30
  const dateExpiration = MAINTENANT.add({ days: 45 });
  const dateEmission = dateExpiration.subtract({ years: 6 });
  const diag = unDiagnosticElecValide({ dateEmission });
  this.biens = [unBienValide({ diagnostics: [diag] })];
});

// ─── When ─────────────────────────────────────────────────────────────────────

When('je calcule les alertes diagnostic', function (this: MondeDiagnostic) {
  this.alertes = calculerAlertesDiagnostic(this.biens, MAINTENANT);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then("aucune alerte diagnostic n'est retournée", function (this: MondeDiagnostic) {
  assert.strictEqual(this.alertes.length, 0);
});

Then(
  /^(\d+) alertes? diagnostic (?:est|sont) retournée[s]?$/,
  function (this: MondeDiagnostic, countStr: string) {
    assert.strictEqual(this.alertes.length, parseInt(countStr, 10));
  },
);

Then(
  /^l'alerte diagnostic a le type "([^"]+)"$/,
  function (this: MondeDiagnostic, typeDiagnostic: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(this.alertes[0]!.source.extra?.['typeDiagnostic'], typeDiagnostic);
  },
);

Then(
  /^l'alerte diagnostic a joursRestants égal à (-?\d+)$/,
  function (this: MondeDiagnostic, joursStr: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(this.alertes[0]!.joursRestants, parseInt(joursStr, 10));
  },
);
