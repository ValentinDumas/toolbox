/**
 * Step definitions @phase7-alerte-irl : alertes révision IRL J-30.
 *
 * Stratégie : appel direct des fonctions pures du domaine (calculerAlertesIrl).
 * Aucun repository réel — les steps construisent les entrées en mémoire.
 * Pattern miroir tests/bdd/step_definitions/indexation-irl.steps.ts.
 *
 * Couverture phase7-VALIDATION :
 *   D-SRC-03 / D-91 / D-92 / D-SRC-02 (fenêtre J-30).
 *
 * Tags : @phase7 @phase7-alerte-irl
 */

import assert from 'node:assert/strict';

import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import type { BailId, BienId } from '../../../src/domain/_shared/identifiants.js';
import type { Alerte } from '../../../src/domain/_shared/alerte.js';
import { calculerAlertesIrl } from '../../../src/domain/locatif/alerte-irl.js';
import { unBailIndexableValide, unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unBienAvecDpeF } from '../../_builders/patrimoine.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';
import type { Bien } from '../../../src/domain/patrimoine/bien.js';

interface MondeIrl extends World {
  maintenant: Temporal.PlainDate;
  baux: Bail[];
  biens: Bien[];
  indexationsParBail: Map<BailId, boolean>;
  alertes: Alerte[];
  [key: string]: unknown;
}

const BIEN_ID = '11111111-1111-4111-8111-111111111111' as BienId;
const BAIL_ID = '33333333-3333-4333-8333-333333333333' as BailId;

Before({ tags: '@phase7-alerte-irl' }, function (this: MondeIrl) {
  this.maintenant = Temporal.PlainDate.from('2026-06-12');
  this.baux = [];
  this.biens = [];
  this.indexationsParBail = new Map<BailId, boolean>();
  this.alertes = [];
});

// ─── Background ───────────────────────────────────────────────────────────────

Given('un bail actif sur un bien DPE classé C', function (this: MondeIrl) {
  // Bail et bien créés par les étapes "Given la date du jour..." — le Background
  // initialise uniquement le contexte ; les fixtures concrètes sont construites
  // selon le scénario pour contrôler la date d'anniversaire.
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  /^la date du jour est à (\d+) jours avant l'anniversaire du bail$/,
  function (this: MondeIrl, joursStr: string) {
    const jours = parseInt(joursStr, 10);
    const dateAnniversaire = this.maintenant.add({ days: jours });
    const dateDebut = dateAnniversaire.subtract({ years: 1 });
    const bail = unBailIndexableValide({
      id: BAIL_ID,
      bienId: BIEN_ID,
      dateDebut,
      dureeMois: 12,
    });
    const bien = unBienValide({ id: BIEN_ID });
    this.baux = [bail];
    this.biens = [bien];
  },
);

Given(
  "la date du jour est à 15 jours avant l'anniversaire d'un bail non activé",
  function (this: MondeIrl) {
    const dateAnniversaire = this.maintenant.add({ days: 15 });
    const dateDebut = dateAnniversaire.subtract({ years: 1 });
    // unBailValide n'active pas le bail (actifDepuis = null)
    const bail = unBailValide({
      id: BAIL_ID,
      bienId: BIEN_ID,
      dateDebut,
      dureeMois: 12,
    });
    const bien = unBienValide({ id: BIEN_ID });
    this.baux = [bail];
    this.biens = [bien];
  },
);

Given('le bien est classé DPE F', function (this: MondeIrl) {
  // Remplacer le bien par un bien DPE F
  this.biens = [unBienAvecDpeF({ id: BIEN_ID })];
});

Given("aucune indexation n'est enregistrée pour l'exercice courant", function (this: MondeIrl) {
  this.indexationsParBail = new Map<BailId, boolean>();
});

Given("une indexation est déjà enregistrée pour l'exercice courant", function (this: MondeIrl) {
  assert.ok(this.baux.length > 0, 'Bail doit être configuré avant de marquer l\'indexation');
  const bail = this.baux[0]!;
  this.indexationsParBail = new Map([[bail.id as BailId, true]]);
});

// ─── When ─────────────────────────────────────────────────────────────────────

When('je calcule les alertes IRL', function (this: MondeIrl) {
  this.alertes = calculerAlertesIrl(this.baux, this.biens, this.indexationsParBail, this.maintenant);
});

When('je calcule les alertes IRL avec le bail non activé', function (this: MondeIrl) {
  this.alertes = calculerAlertesIrl(this.baux, this.biens, this.indexationsParBail, this.maintenant);
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then(/^(\d+) alerte[s]? IRL (?:est|sont) retournée[s]?$/, function (this: MondeIrl, countStr: string) {
  assert.strictEqual(this.alertes.length, parseInt(countStr, 10));
});

Then(
  /^l'alerte IRL a joursRestants égal à (\d+)$/,
  function (this: MondeIrl, joursStr: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(this.alertes[0]!.joursRestants, parseInt(joursStr, 10));
  },
);
