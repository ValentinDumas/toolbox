/**
 * Step definitions @phase7-alerte-agregation : agrégation multi-source des alertes dashboard.
 *
 * Stratégie : appel direct du use case calculerToutesAlertes avec des repos in-memory
 * (objets littéraux implémentant les interfaces domaine) + ClockFixe.
 * Aucun serveur Fastify, aucun supertest — couverture application pure.
 *
 * Couverture Phase 7 / DAS-02 :
 *   DAS-02 (fusion 4 sources) / D-AL-01 (tri ASC global) / D-AL-04 (Clock-driven).
 *   D-SRC-03 IRL (filtre exercice courant pré-calculé par le use case).
 *
 * Tags : @phase7 @phase7-alerte-agregation
 */

import assert from 'node:assert/strict';

import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import type { Alerte } from '../../../src/domain/_shared/alerte.js';
import {
  calculerToutesAlertes,
  type CalculerToutesAlertesDeps,
} from '../../../src/application/dashboard/calculer-toutes-alertes.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { DeclarationCfeRepository } from '../../../src/domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { BailIndexationRepository } from '../../../src/domain/locatif/bail-indexation-repository.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';
import type { Bien } from '../../../src/domain/patrimoine/bien.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';
import type { DeclarationCfe } from '../../../src/domain/fiscalite/cfe/declaration-cfe.js';
import type { BailIndexation } from '../../../src/domain/locatif/bail-indexation.js';
import { unBienValide, unDiagnosticDpeValide } from '../../_builders/patrimoine.js';
import { unBailIndexableValide, uneBailIndexationAppliqueeValide } from '../../_builders/locatif.js';
import { uneDeclarationCfe } from '../../_builders/fiscalite.js';

// Date fixe pour déterminisme des scénarios (2026-06-11)
const MAINTENANT = Temporal.PlainDate.from('2026-06-11');
const CLOCK = ClockFixe.du('2026-06-11');

interface MondeAgregation extends World {
  biens: Bien[];
  baux: Bail[];
  cfeMap: Map<string, DeclarationCfe[]>;
  indexationsMap: Map<string, BailIndexation | null>;
  alertes: Alerte[];
  [key: string]: unknown;
}

function buildDeps(monde: MondeAgregation): CalculerToutesAlertesDeps {
  const bienRepo: BienRepository = {
    listerTous: async () => monde.biens,
    trouverParId: async () => null,
    enregistrer: async () => { throw new Error('non utilisé'); },
    supprimer: async () => { throw new Error('non utilisé'); },
  };

  const bailRepo: BailRepository = {
    listerTous: async () => monde.baux,
    trouverParId: async () => null,
    listerParLocataire: async () => [],
    enregistrer: async () => { throw new Error('non utilisé'); },
    supprimer: async () => { throw new Error('non utilisé'); },
  };

  const cfeRepo: DeclarationCfeRepository = {
    listerParBien: async (bienId) => monde.cfeMap.get(bienId as string) ?? [],
    enregistrer: async () => { throw new Error('non utilisé'); },
    trouverParId: async () => { throw new Error('non utilisé'); },
    trouverParBienMillesime: async () => { throw new Error('non utilisé'); },
  };

  const bailIndexationRepo: BailIndexationRepository = {
    dernierePourBail: async (bailId) => monde.indexationsMap.get(bailId as string) ?? null,
    enregistrer: async () => { throw new Error('non utilisé'); },
    trouverParId: async () => { throw new Error('non utilisé'); },
    listerParBail: async () => { throw new Error('non utilisé'); },
  };

  return { bienRepo, bailRepo, cfeRepo, bailIndexationRepo, clock: CLOCK };
}

Before({ tags: '@phase7-alerte-agregation' }, function (this: MondeAgregation) {
  this.biens = [];
  this.baux = [];
  this.cfeMap = new Map();
  this.indexationsMap = new Map();
  this.alertes = [];
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  'des données produisant 1 alerte CFE, 1 alerte IRL, 1 alerte diagnostic et 1 alerte fin de bail',
  function (this: MondeAgregation) {
    // CFE: J-30 (2026-07-11)
    const bienCfe = unBienValide();
    const decl = uneDeclarationCfe({
      bienId: bienCfe.id,
      statut: 'non_deposee',
      dateEcheancePaiement: MAINTENANT.add({ days: 30 }),
    });
    this.cfeMap.set(bienCfe.id as string, [decl]);

    // Diagnostic DPE: J-5 (expire 2026-06-16 → dateEmission = 2016-06-16)
    const bienDiag = unBienValide({
      diagnostics: [
        unDiagnosticDpeValide({ dateEmission: Temporal.PlainDate.from('2016-06-16') }),
      ],
    });

    // IRL: anniversary=2026-06-21 (J+10), dureeMois=36 (fin 2028-06-21, hors fenêtre fin_bail)
    const bailIrl = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
      dureeMois: 36,
    });

    // Fin de bail: fin=2026-07-01 (J+20), anniversary=2026-08-01 (J+51, hors fenêtre IRL)
    const bailFin = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2024-08-01'),
      dureeMois: 23,
    });

    this.biens = [bienCfe, bienDiag];
    this.baux = [bailIrl, bailFin];
  },
);

Given(
  'des alertes de sources différentes avec joursRestants 5, 10, 20 et 30',
  function (this: MondeAgregation) {
    // Same data as scenario 01 — produces 4 alerts with J-5, J-10, J-20, J-30
    // CFE: J-30
    const bienCfe = unBienValide();
    const decl = uneDeclarationCfe({
      bienId: bienCfe.id,
      statut: 'non_deposee',
      dateEcheancePaiement: MAINTENANT.add({ days: 30 }),
    });
    this.cfeMap.set(bienCfe.id as string, [decl]);

    // Diagnostic DPE: J-5
    const bienDiag = unBienValide({
      diagnostics: [
        unDiagnosticDpeValide({ dateEmission: Temporal.PlainDate.from('2016-06-16') }),
      ],
    });

    // IRL: J+10
    const bailIrl = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
      dureeMois: 36,
    });

    // Fin de bail: J+20
    const bailFin = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2024-08-01'),
      dureeMois: 23,
    });

    this.biens = [bienCfe, bienDiag];
    this.baux = [bailIrl, bailFin];
  },
);

Given(
  "un bail dont une indexation a été enregistrée en 2026",
  function (this: MondeAgregation) {
    // Bail avec anniversary dans la fenêtre IRL
    const bien = unBienValide();
    const bail = unBailIndexableValide({
      bienId: bien.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
      dureeMois: 36,
    });

    // Indexation 2026 (exercice courant)
    const indexation = uneBailIndexationAppliqueeValide({
      bailId: bail.id,
      dateEffet: Temporal.PlainDate.from('2026-05-01'),
    });

    this.biens = [bien];
    this.baux = [bail];
    this.indexationsMap.set(bail.id as string, indexation);
  },
);

Given(
  'aucun bien, bail ou déclaration CFE',
  function (this: MondeAgregation) {
    // Tous les repos sont vides (valeurs par défaut)
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When('je calcule toutes les alertes', async function (this: MondeAgregation) {
  this.alertes = await calculerToutesAlertes(buildDeps(this));
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then(
  /^(\d+) alertes? sont retournées?$/,
  function (this: MondeAgregation, countStr: string) {
    assert.strictEqual(this.alertes.length, parseInt(countStr, 10));
  },
);

Then(
  /^les 4 types d'alerte sont présents \(cfe, irl, diagnostic, fin_bail\)$/,
  function (this: MondeAgregation) {
    const types = new Set(this.alertes.map((a) => a.type));
    assert.ok(types.has('cfe'), 'alerte cfe manquante');
    assert.ok(types.has('irl'), 'alerte irl manquante');
    assert.ok(types.has('diagnostic'), 'alerte diagnostic manquante');
    assert.ok(types.has('fin_bail'), 'alerte fin_bail manquante');
  },
);

Then(
  'les alertes sont triées par joursRestants croissant',
  function (this: MondeAgregation) {
    const jours = this.alertes.map((a) => a.joursRestants);
    assert.deepStrictEqual(jours, [...jours].sort((a, b) => a - b));
  },
);

Then(
  /^la première alerte a joursRestants égal à (\d+)$/,
  function (this: MondeAgregation, joursStr: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(this.alertes[0]!.joursRestants, parseInt(joursStr, 10));
  },
);

Then(
  /^la dernière alerte a joursRestants égal à (\d+)$/,
  function (this: MondeAgregation, joursStr: string) {
    assert.ok(this.alertes.length > 0, 'Au moins une alerte doit exister');
    assert.strictEqual(
      this.alertes[this.alertes.length - 1]!.joursRestants,
      parseInt(joursStr, 10),
    );
  },
);

Then(
  "aucune alerte IRL n'est retournée pour ce bail",
  function (this: MondeAgregation) {
    const alertesIrl = this.alertes.filter((a) => a.type === 'irl');
    assert.strictEqual(alertesIrl.length, 0);
  },
);

Then(
  "aucune alerte n'est retournée",
  function (this: MondeAgregation) {
    assert.strictEqual(this.alertes.length, 0);
  },
);
