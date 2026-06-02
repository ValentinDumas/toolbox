/**
 * Step definitions @phase6-cfe-suivi : suivi déclaratif CFE 1447-C-SD.
 *
 * Stratégie : appel direct use cases enregistrer/modifier/lister (pas HTTP).
 * DB in-memory SQLite + migrations complètes.
 *
 * Couverture 06-VALIDATION.md :
 *   D-CFE6.1 / D-CFE6.2 / D-CFE6.3 / D-CFE6.4.
 *
 * Tags : @phase6 @phase6-cfe-suivi
 */

import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId, DeclarationCfeId } from '../../../src/domain/_shared/identifiants.js';

import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { enregistrerDeclarationCfe } from '../../../src/application/fiscalite/enregistrer-declaration-cfe.js';
import { modifierDeclarationCfe } from '../../../src/application/fiscalite/modifier-declaration-cfe.js';
import { listerDeclarationsCfeParBien } from '../../../src/application/fiscalite/lister-declarations-cfe-par-bien.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { StatutCfe } from '../../../src/domain/fiscalite/cfe/statut-cfe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface MondeCfe extends World {
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  bienId: BienId | null;
  derniereDeclarationCfeId: DeclarationCfeId | null;
  derniereErreur: Error | null;
  [key: string]: unknown;
}

Before({ tags: '@phase6-cfe-suivi' }, async function (this: MondeCfe) {
  process.env['SESSION_SECRET'] = 'test-secret-for-phase6-cfe-suivi-at-least32!';
  this.sqlite = new Database(':memory:');
  activerPragmas(this.sqlite);
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.bienId = null;
  this.derniereDeclarationCfeId = null;
  this.derniereErreur = null;
});

After({ tags: '@phase6-cfe-suivi' }, async function (this: MondeCfe) {
  if (this.db) await this.db.destroy();
  if (this.sqlite) this.sqlite.close();
});

function reposCfe(db: Kysely<DB>) {
  return {
    bienRepo: new BienRepositorySqlite(db),
    cfeRepo: new DeclarationCfeRepositorySqlite(db),
  };
}

// ─── Background ───────────────────────────────────────────────────────────────

Given('un bien immobilier enregistré pour la CFE', async function (this: MondeCfe) {
  assert.ok(this.db, 'DB doit être initialisée');
  const { bienRepo } = reposCfe(this.db);
  const bien = unBienValide();
  await bienRepo.enregistrer(bien);
  this.bienId = bien.id;
});

// ─── Given déclarations préalables ────────────────────────────────────────────

Given(
  /^une déclaration CFE millésime (\d{4}) statut "([^"]+)" échéance "(\d{4}-\d{2}-\d{2})"$/,
  async function (
    this: MondeCfe,
    millesimeStr: string,
    statut: string,
    echeance: string,
  ) {
    assert.ok(this.db && this.bienId, 'Bien doit être enregistré');
    const { bienRepo, cfeRepo } = reposCfe(this.db);
    const decl = await enregistrerDeclarationCfe(
      {
        bienId: this.bienId,
        millesime: parseInt(millesimeStr, 10),
        statut: statut as StatutCfe,
        dateDepotDeclaration: null,
        montantAvisCentimes: null,
        dateEcheancePaiement: Temporal.PlainDate.from(echeance),
      },
      { bienRepo, cfeRepo },
    );
    this.derniereDeclarationCfeId = decl.id;
  },
);

Given(
  /^une déclaration CFE millésime (\d{4}) statut "([^"]+)" date de dépôt "(\d{4}-\d{2}-\d{2})" montant d'avis (\d+) € échéance "(\d{4}-\d{2}-\d{2})"$/,
  async function (
    this: MondeCfe,
    millesimeStr: string,
    statut: string,
    dateDepot: string,
    montantStr: string,
    echeance: string,
  ) {
    assert.ok(this.db && this.bienId, 'Bien doit être enregistré');
    const { bienRepo, cfeRepo } = reposCfe(this.db);
    const decl = await enregistrerDeclarationCfe(
      {
        bienId: this.bienId,
        millesime: parseInt(millesimeStr, 10),
        statut: statut as StatutCfe,
        dateDepotDeclaration: Temporal.PlainDate.from(dateDepot),
        montantAvisCentimes: Money.fromEuros(parseInt(montantStr, 10)),
        dateEcheancePaiement: Temporal.PlainDate.from(echeance),
      },
      { bienRepo, cfeRepo },
    );
    this.derniereDeclarationCfeId = decl.id;
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When(
  /^j'enregistre une déclaration CFE millésime (\d{4}) statut "([^"]+)" échéance "(\d{4}-\d{2}-\d{2})"$/,
  async function (
    this: MondeCfe,
    millesimeStr: string,
    statut: string,
    echeance: string,
  ) {
    assert.ok(this.db && this.bienId, 'Bien doit être enregistré');
    const { bienRepo, cfeRepo } = reposCfe(this.db);
    try {
      const decl = await enregistrerDeclarationCfe(
        {
          bienId: this.bienId,
          millesime: parseInt(millesimeStr, 10),
          statut: statut as StatutCfe,
          dateDepotDeclaration: null,
          montantAvisCentimes: null,
          dateEcheancePaiement: Temporal.PlainDate.from(echeance),
        },
        { bienRepo, cfeRepo },
      );
      this.derniereDeclarationCfeId = decl.id;
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

When(
  /^je modifie la déclaration CFE en statut "([^"]+)" avec date de dépôt "(\d{4}-\d{2}-\d{2})"$/,
  async function (this: MondeCfe, statut: string, dateDepot: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId, 'Déclaration CFE doit exister');
    const { cfeRepo } = reposCfe(this.db);
    try {
      await modifierDeclarationCfe(
        {
          id: this.derniereDeclarationCfeId,
          patch: {
            statut: statut as StatutCfe,
            dateDepotDeclaration: Temporal.PlainDate.from(dateDepot),
          },
        },
        { cfeRepo },
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

When(
  /^je tente de modifier la déclaration CFE en statut "([^"]+)" sans date de dépôt$/,
  async function (this: MondeCfe, statut: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId, 'Déclaration CFE doit exister');
    const { cfeRepo } = reposCfe(this.db);
    try {
      await modifierDeclarationCfe(
        {
          id: this.derniereDeclarationCfeId,
          patch: { statut: statut as StatutCfe },
        },
        { cfeRepo },
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

When(
  /^je tente de modifier la déclaration CFE en statut "([^"]+)" sans date de dépôt ni montant d'avis$/,
  async function (this: MondeCfe, statut: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId, 'Déclaration CFE doit exister');
    const { cfeRepo } = reposCfe(this.db);
    try {
      await modifierDeclarationCfe(
        {
          id: this.derniereDeclarationCfeId,
          patch: { statut: statut as StatutCfe },
        },
        { cfeRepo },
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

When(
  /^je modifie la déclaration CFE échéance "(\d{4}-\d{2}-\d{2})"$/,
  async function (this: MondeCfe, echeance: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId, 'Déclaration CFE doit exister');
    const { cfeRepo } = reposCfe(this.db);
    try {
      await modifierDeclarationCfe(
        {
          id: this.derniereDeclarationCfeId,
          patch: { dateEcheancePaiement: Temporal.PlainDate.from(echeance) },
        },
        { cfeRepo },
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then(
  /^la liste des déclarations CFE du bien contient (\d+) entrée[s]?$/,
  async function (this: MondeCfe, countStr: string) {
    assert.ok(this.db && this.bienId, 'Bien doit être enregistré');
    const { cfeRepo } = reposCfe(this.db);
    const liste = await listerDeclarationsCfeParBien({ bienId: this.bienId }, { cfeRepo });
    assert.strictEqual(liste.length, parseInt(countStr, 10));
  },
);

Then(
  /^la première déclaration CFE a le statut "([^"]+)"$/,
  async function (this: MondeCfe, statut: string) {
    assert.ok(this.db && this.bienId);
    const { cfeRepo } = reposCfe(this.db);
    const liste = await listerDeclarationsCfeParBien({ bienId: this.bienId }, { cfeRepo });
    assert.strictEqual(liste[0]!.statut, statut);
  },
);

Then(
  /^la première déclaration CFE a le millésime (\d{4})$/,
  async function (this: MondeCfe, millesimeStr: string) {
    assert.ok(this.db && this.bienId);
    const { cfeRepo } = reposCfe(this.db);
    const liste = await listerDeclarationsCfeParBien({ bienId: this.bienId }, { cfeRepo });
    assert.strictEqual(liste[0]!.millesime, parseInt(millesimeStr, 10));
  },
);

Then(
  /^la première déclaration CFE a une date de dépôt nulle$/,
  async function (this: MondeCfe) {
    assert.ok(this.db && this.bienId);
    const { cfeRepo } = reposCfe(this.db);
    const liste = await listerDeclarationsCfeParBien({ bienId: this.bienId }, { cfeRepo });
    assert.strictEqual(liste[0]!.dateDepotDeclaration, null);
  },
);

Then(
  /^la première déclaration CFE a un montant d'avis nul$/,
  async function (this: MondeCfe) {
    assert.ok(this.db && this.bienId);
    const { cfeRepo } = reposCfe(this.db);
    const liste = await listerDeclarationsCfeParBien({ bienId: this.bienId }, { cfeRepo });
    assert.strictEqual(liste[0]!.montantAvisCentimes, null);
  },
);

Then(
  /^la déclaration CFE a le statut "([^"]+)"$/,
  async function (this: MondeCfe, statut: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId);
    const { cfeRepo } = reposCfe(this.db);
    const decl = await cfeRepo.trouverParId(this.derniereDeclarationCfeId);
    assert.ok(decl);
    assert.strictEqual(decl.statut, statut);
  },
);

Then(
  /^la déclaration CFE a une date de dépôt "(\d{4}-\d{2}-\d{2})"$/,
  async function (this: MondeCfe, expected: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId);
    const { cfeRepo } = reposCfe(this.db);
    const decl = await cfeRepo.trouverParId(this.derniereDeclarationCfeId);
    assert.ok(decl);
    assert.strictEqual(decl.dateDepotDeclaration?.toString(), expected);
  },
);

Then(
  /^la déclaration CFE a un montant d'avis de (\d+) €$/,
  async function (this: MondeCfe, montantStr: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId);
    const { cfeRepo } = reposCfe(this.db);
    const decl = await cfeRepo.trouverParId(this.derniereDeclarationCfeId);
    assert.ok(decl);
    assert.strictEqual(
      decl.montantAvisCentimes?.egale(Money.fromEuros(parseInt(montantStr, 10))),
      true,
    );
  },
);

Then(
  /^la déclaration CFE a une date d'échéance "(\d{4}-\d{2}-\d{2})"$/,
  async function (this: MondeCfe, expected: string) {
    assert.ok(this.db && this.derniereDeclarationCfeId);
    const { cfeRepo } = reposCfe(this.db);
    const decl = await cfeRepo.trouverParId(this.derniereDeclarationCfeId);
    assert.ok(decl);
    assert.strictEqual(decl.dateEcheancePaiement.toString(), expected);
  },
);

Then(
  /^une erreur InvariantViolated est levée citant "([^"]+)"$/,
  async function (this: MondeCfe, motCle: string) {
    assert.ok(this.derniereErreur, 'Une erreur aurait dû être levée');
    assert.strictEqual(this.derniereErreur.name, 'InvariantViolated');
    assert.match(this.derniereErreur.message, new RegExp(motCle));
  },
);
