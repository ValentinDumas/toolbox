/**
 * Step definitions @phase7-baux-indexations — page /baux/indexations (Phase 7 / DAS-01 / D-DASH-04 / D-90).
 *
 * Stratégie : montage Fastify via creerApp + DB in-memory + ClockFixe + app.inject.
 * Harnais miroir de dashboard.steps.ts.
 *
 * Couverture :
 *   - table peuplée (bail IRL dû sur bien DPE C, sans indexation exercice courant)
 *   - exclusion gel DPE F/G (D-92) + paragraphe pédagogique décret 2022-1313 (R4.3)
 *   - exclusion exercice courant (D-SRC-03 IRL)
 *   - empty-state (aucun bail dans fenêtre J-30)
 *
 * Tags : @phase7 @phase7-baux-indexations
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { After, Before, Given, Then, World } from '@cucumber/cucumber';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { marquerWizardComplete } from '../../../src/infrastructure/lifecycle/premier-lancement.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailIndexationRepositorySqlite } from '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBienValide, unBienAvecDpeF, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide, uneBailIndexationAppliqueeValide } from '../../_builders/locatif.js';
import type { BienId, LotId, LocataireId, BailId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

// Date fixe : 2026-06-12
const TODAY_STR = '2026-06-12';

interface MondeIndexations extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  dernierCorps: string;
  adresseBien: string;
  nomLocataire: string;
  bailId: BailId | null;
  [key: string]: unknown;
}

Before({ tags: '@phase7-baux-indexations' }, async function (this: MondeIndexations) {
  process.env['SESSION_SECRET'] = 'test-secret-baux-indexations-32chars!!';
  this.sqlite = new Database(':memory:');
  activerPragmas(this.sqlite);
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du(TODAY_STR);
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.dernierCorps = '';
  this.adresseBien = '';
  this.nomLocataire = '';
  this.bailId = null;

  await marquerWizardComplete(this.db);
});

After({ tags: '@phase7-baux-indexations' }, async function (this: MondeIndexations) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
  if (this.sqlite) this.sqlite.close();
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  /^un bail actif IRL dû \(anniversaire J-15\) sur un bien DPE classé C sans indexation cette année$/,
  async function (this: MondeIndexations) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);

    // Bien DPE C avec adresse distincte
    const rue = '42 rue de la Paix';
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ rue, lots: [lot], classeDpe: 'C' });
    await bienRepo.enregistrer(bien);
    this.adresseBien = rue;

    const locataire = unLocataireValide({ nom: 'Martin', prenom: 'Jean' });
    await locataireRepo.enregistrer(locataire);
    this.nomLocataire = `${locataire.prenom} ${locataire.nom}`;

    // dateDebut 2025-06-27 → anniversaire 2026-06-27 = J+15 depuis 2026-06-12
    const bail = unBailIndexableValide({
      bienId: bien.id as BienId,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id as LotId],
      dateDebut: Temporal.PlainDate.from('2025-06-27'),
      loyerHc: Money.fromEuros(800),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    await bailRepo.enregistrer(bail);
    this.bailId = bail.id as BailId;
    // Pas d'indexation enregistrée → exercice courant non couvert
  },
);

Given(
  /^un bail actif IRL dû sur un bien DPE classé F sans indexation cette année$/,
  async function (this: MondeIndexations) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);

    // Bien DPE F → gel Climat (D-92) → exclu de calculerAlertesIrl
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienAvecDpeF({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    // anniversaire J+15 → devrait déclencher alerte, MAIS gel DPE F → exclu
    const bail = unBailIndexableValide({
      bienId: bien.id as BienId,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id as LotId],
      dateDebut: Temporal.PlainDate.from('2025-06-27'),
      loyerHc: Money.fromEuros(800),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    await bailRepo.enregistrer(bail);
    this.bailId = bail.id as BailId;
  },
);

Given(
  /^un bail actif IRL dû mais déjà indexé sur l'exercice courant$/,
  async function (this: MondeIndexations) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);
    const indexationRepo = new BailIndexationRepositorySqlite(this.db);

    // Bien DPE C
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot], classeDpe: 'C' });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    // anniversaire J+15 → alerte IRL due, MAIS indexation sur exercice 2026 → exclu (D-SRC-03)
    const bail = unBailIndexableValide({
      bienId: bien.id as BienId,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id as LotId],
      dateDebut: Temporal.PlainDate.from('2025-06-27'),
      loyerHc: Money.fromEuros(800),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    await bailRepo.enregistrer(bail);
    this.bailId = bail.id as BailId;

    // Enregistrer une indexation avec dateEffet en 2026 → exercice courant couvert
    const indexation = uneBailIndexationAppliqueeValide({
      bailId: bail.id as BailId,
      dateEffet: Temporal.PlainDate.from('2026-01-01'),
    });
    await indexationRepo.enregistrer(indexation);
  },
);

Given(
  /^aucun bail dont la révision IRL est due dans la fenêtre J-30$/,
  async function (this: MondeIndexations) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);

    // Bail avec anniversaire dans 60 jours → hors fenêtre J-30
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot], classeDpe: 'C' });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    // dateDebut 2025-08-11 → anniversaire 2026-08-11 = J+60 depuis 2026-06-12 (hors fenêtre J-30)
    const bail = unBailIndexableValide({
      bienId: bien.id as BienId,
      locataireId: locataire.id as LocataireId,
      lotIds: [lot.id as LotId],
      dateDebut: Temporal.PlainDate.from('2025-08-11'),
      loyerHc: Money.fromEuros(800),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    await bailRepo.enregistrer(bail);
  },
);

// ─── When / Then spécifiques (les steps génériques "je visite", "la réponse a un statut",
// "la page contient/ne contient pas" sont définis dans dashboard.steps.ts / activation.steps.ts)
// ─────────────────────────────────────────────────────────────────────────────

Then(
  "la page contient l'adresse du bien dans la table IRL",
  function (this: MondeIndexations) {
    assert.ok(
      this.dernierCorps.includes(this.adresseBien),
      `La page devrait contenir l'adresse "${this.adresseBien}"`,
    );
  },
);

Then(
  "la page contient le nom du locataire dans la table IRL",
  function (this: MondeIndexations) {
    assert.ok(
      this.dernierCorps.includes(this.nomLocataire),
      `La page devrait contenir le nom du locataire "${this.nomLocataire}"`,
    );
  },
);

Then(
  "la page contient un lien d'action indexer IRL",
  function (this: MondeIndexations) {
    assert.ok(this.bailId, 'bailId doit être défini');
    const lienAttendu = `/baux/${this.bailId}/indexer`;
    assert.ok(
      this.dernierCorps.includes(lienAttendu),
      `La page devrait contenir le lien "${lienAttendu}"`,
    );
  },
);
