/**
 * Step definitions @phase7-alerte-fin-bail : alertes fin de bail.
 *
 * Stratégie : appel direct des fonctions pures du domaine (calculerAlertesFinBail).
 * Aucun repository réel — les steps construisent les entrées en mémoire.
 * Pattern miroir tests/bdd/step_definitions/alerte-irl.steps.ts.
 *
 * Couverture phase7-VALIDATION :
 *   D-SRC-03 (filtre actif) / D-SRC-05 / D-FB-03 (fenêtre 30j avant à 60j après).
 *
 * Tags : @phase7 @phase7-alerte-fin-bail
 */

import assert from 'node:assert/strict';

import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../../../src/domain/_shared/alerte.js';
import { calculerAlertesFinBail } from '../../../src/domain/locatif/alerte-fin-bail.js';
import { unBailIndexableValide, unBailValide } from '../../_builders/locatif.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';

interface MondeFinBail extends World {
  maintenant: Temporal.PlainDate;
  baux: Bail[];
  bailleurBaux: Bail[];
  alertes: Alerte[];
  [key: string]: unknown;
}

Before({ tags: '@phase7-alerte-fin-bail' }, function (this: MondeFinBail) {
  this.maintenant = Temporal.PlainDate.from('2026-06-12');
  this.baux = [];
  this.bailleurBaux = [];
  this.alertes = [];
});

// ─── Background ───────────────────────────────────────────────────────────────

Given(
  'un bail actif dont la fin est calculée à partir de dateDebut + dureeMois',
  function (this: MondeFinBail) {
    // Bail créé dans les étapes spécifiques selon le scénario
  },
);

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  /^la fin du bail est dans (\d+) jours$/,
  function (this: MondeFinBail, joursStr: string) {
    const jours = parseInt(joursStr, 10);
    const dateFin = this.maintenant.add({ days: jours });
    const dateDebut = dateFin.subtract({ months: 12 });
    this.baux = [unBailIndexableValide({ dateDebut, dureeMois: 12 })];
  },
);

Given(
  /^la fin du bail était il y a (\d+) jours$/,
  function (this: MondeFinBail, joursStr: string) {
    const jours = parseInt(joursStr, 10);
    const dateFin = this.maintenant.add({ days: -jours });
    const dateDebut = dateFin.subtract({ months: 12 });
    this.baux = [unBailIndexableValide({ dateDebut, dureeMois: 12 })];
  },
);

Given(
  /^un bail non activé dont la fin serait dans (\d+) jours$/,
  function (this: MondeFinBail, joursStr: string) {
    const jours = parseInt(joursStr, 10);
    const dateFin = this.maintenant.add({ days: jours });
    const dateDebut = dateFin.subtract({ months: 12 });
    // unBailValide n'active pas le bail (actifDepuis = null)
    this.bailleurBaux = [unBailValide({ dateDebut, dureeMois: 12 })];
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When('je calcule les alertes fin de bail', function (this: MondeFinBail) {
  this.alertes = calculerAlertesFinBail(this.baux, this.maintenant);
});

When('je calcule les alertes fin de bail avec le bail non activé', function (this: MondeFinBail) {
  this.alertes = calculerAlertesFinBail(this.bailleurBaux, this.maintenant);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then(
  /^(\d+) alerte[s]? fin de bail (?:est|sont) retournée[s]?$/,
  function (this: MondeFinBail, countStr: string) {
    assert.strictEqual(this.alertes.length, parseInt(countStr, 10));
  },
);

Then(
  /^l'alerte fin de bail a joursRestants égal à (\d+)$/,
  function (this: MondeFinBail, joursStr: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(this.alertes[0]!.joursRestants, parseInt(joursStr, 10));
  },
);
