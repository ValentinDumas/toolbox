import { After, Before, Given, Then, When, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = path.resolve(__dirname, '../../../migrations/0001_init.sql');

interface MondeActivation extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
}

Before(async function (this: MondeActivation) {
  // DB en mémoire pour les tests BDD
  const sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerMigrationsBrutes(this.db, sqlite, MIGRATIONS_PATH);
  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
});

After(async function (this: MondeActivation) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

Given("l'application est lancée pour la première fois", async function (this: MondeActivation) {
  // DB vide — setup déjà fait dans Before
  assert.ok(this.db, 'DB doit être initialisée');
});

When(
  "le bailleur soumet le formulaire Bien avec l'adresse {string}, code postal {string}, ville {string}, surface {int}, type {string}, année {int}, lot désignation {string}, type lot {string}",
  async function (
    this: MondeActivation,
    rue: string,
    codePostal: string,
    ville: string,
    surface: number,
    type: string,
    anneeConstruction: number,
    lotDesignation: string,
    lotType: string,
  ) {
    assert.ok(this.app, 'App doit être initialisée');

    const payload = new URLSearchParams({
      rue,
      codePostal,
      ville,
      surface: String(surface),
      type,
      anneeConstruction: String(anneeConstruction),
      lot1_designation: lotDesignation,
      lot1_type: lotType,
    }).toString();

    const reponse = await this.app.inject({
      method: 'POST',
      url: '/biens',
      payload,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    this.dernierStatut = reponse.statusCode;
    this.derniereUrl = reponse.headers['location'] as string;
  },
);

Then('le Bien est visible dans la liste GET /biens', async function (this: MondeActivation) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.equal(this.dernierStatut, 302, `POST /biens doit retourner 302, obtenu: ${this.dernierStatut}`);

  const reponseGet = await this.app.inject({
    method: 'GET',
    url: '/biens',
  });

  assert.equal(reponseGet.statusCode, 200, `GET /biens doit retourner 200`);
  this.dernierCorps = reponseGet.body;
});

Then('la liste contient {string}', function (this: MondeActivation, texteAttendu: string) {
  assert.ok(
    this.dernierCorps.includes(texteAttendu),
    `La page /biens doit contenir "${texteAttendu}"`,
  );
});

Then(
  'la table SQLite bien contient 1 ligne et lot contient 1 ligne',
  async function (this: MondeActivation) {
    assert.ok(this.db, 'DB doit être initialisée');

    const countBien = await this.db
      .selectFrom('bien')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();

    const countLot = await this.db
      .selectFrom('lot')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();

    assert.equal(Number(countBien.count), 1, 'Table bien doit contenir 1 ligne');
    assert.equal(Number(countLot.count), 1, 'Table lot doit contenir 1 ligne');
  },
);
