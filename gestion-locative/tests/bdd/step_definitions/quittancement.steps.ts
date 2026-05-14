import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { unBailValide } from '../../_builders/locatif.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeD74 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
  dernierBailId: BailId | null;
  [key: string]: unknown;
}

function extraireCookies(headers: Record<string, string | string[] | undefined>, jar: CookieJar): void {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    jar[name] = value;
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ─── Before/After pour @D-74 ──────────────────────────────────────────────

Before({ tags: '@D-74' }, async function (this: MondeD74) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBailId = null;
});

After({ tags: '@D-74' }, async function (this: MondeD74) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  "l'application est prête avec un détecteur d'activité qui signale toujours une activité",
  async function (this: MondeD74) {
    // Recrée l'app avec un stub activiteBailDetector qui retourne toujours true
    if (this.app) await this.app.close();
    const stubDetecteur = { aDeLActivite: async () => true };
    this.app = await creerApp(this.db!, { activiteBailDetector: stubDetecteur });
    assert.ok(this.app, 'App doit être initialisée');
  },
);

Given('un bail est enregistré en base', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  const bail = unBailValide();
  const repo = new BailRepositorySqlite(this.db);

  // Créer un bien et un locataire factices en base
  const bienId = bail.bienId;
  const lotId = bail.lotIds[0];
  const locataireId = bail.locataireId;

  await this.db.insertInto('bien').values({
    id: bienId,
    rue: '12 rue de la Paix',
    code_postal: '75002',
    ville: 'Paris',
    surface: 45,
    type: 'appartement',
    annee_construction: 1990,
  }).execute();

  await this.db.insertInto('lot').values({
    id: lotId as string,
    bien_id: bienId,
    designation: 'Appartement principal',
    type: 'appartement',
    surface: 45,
    etage: null,
  }).execute();

  await this.db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Dupont',
    prenom: 'Marie',
    date_naissance: '1985-06-15',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email: 'marie@example.fr',
    telephone: '0123456789',
    rue: '1 rue Test',
    code_postal: '75001',
    ville: 'Paris',
  }).execute();

  await repo.enregistrer(bail);
  this.dernierBailId = bail.id;
});

Given('un bail actif existe avec actif_depuis non null', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  const repo = new BailRepositorySqlite(this.db);

  const bailBrouillon = unBailValide();
  const bienId = bailBrouillon.bienId;
  const lotId = bailBrouillon.lotIds[0];
  const locataireId = bailBrouillon.locataireId;

  await this.db.insertInto('bien').values({
    id: bienId,
    rue: '5 avenue Victor Hugo',
    code_postal: '75016',
    ville: 'Paris',
    surface: 60,
    type: 'appartement',
    annee_construction: 1975,
  }).execute();

  await this.db.insertInto('lot').values({
    id: lotId as string,
    bien_id: bienId,
    designation: 'Appartement',
    type: 'appartement',
    surface: 60,
    etage: null,
  }).execute();

  await this.db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Martin',
    prenom: 'Jean',
    date_naissance: '1980-03-20',
    commune_naissance: 'Lyon',
    pays_naissance: 'France',
    nationalite: 'française',
    email: 'jean@example.fr',
    telephone: null,
    rue: '10 rue Test',
    code_postal: '75010',
    ville: 'Paris',
  }).execute();

  const bailActif = bailBrouillon.activer(Temporal.PlainDate.from('2026-06-01'), 5);
  await repo.enregistrer(bailActif);
  this.dernierBailId = bailActif.id;
});

// ─── When ─────────────────────────────────────────────────────────────────────

When('le bailleur soumet POST supprimer sur ce bail', async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: `/baux/${this.dernierBailId}/supprimer`,
    headers: {
      ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
    },
  });

  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.derniereUrl = (reponse.headers['location'] as string) || '';

  // Follow redirect
  if (reponse.statusCode === 302 && this.derniereUrl) {
    const suivi = await this.app.inject({
      method: 'GET',
      url: this.derniereUrl,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
    this.dernierCorps = suivi.body;
  }
});

When('le bailleur soumet POST desactiver sur ce bail', async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: `/baux/${this.dernierBailId}/desactiver`,
    headers: {
      ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
    },
  });

  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.derniereUrl = (reponse.headers['location'] as string) || '';

  // Follow redirect
  if (reponse.statusCode === 302 && this.derniereUrl) {
    const suivi = await this.app.inject({
      method: 'GET',
      url: this.derniereUrl,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
    this.dernierCorps = suivi.body;
  }
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then('il est redirigé vers la fiche du bail', function (this: MondeD74) {
  assert.ok(this.dernierBailId, 'BailId doit être défini');
  assert.equal(
    this.derniereUrl,
    `/baux/${this.dernierBailId}`,
    `Attendu redirect vers /baux/${this.dernierBailId}, obtenu "${this.derniereUrl}"`,
  );
});

Then('le bail est toujours présent en base', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');
  const row = await this.db
    .selectFrom('bail')
    .select('id')
    .where('id', '=', this.dernierBailId)
    .executeTakeFirst();
  assert.ok(row, `Le bail ${this.dernierBailId} doit toujours être en base`);
});

Then('le bail a actif_depuis null en base', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');
  const row = await this.db
    .selectFrom('bail')
    .select('actif_depuis')
    .where('id', '=', this.dernierBailId)
    .executeTakeFirstOrThrow();
  assert.equal(row.actif_depuis, null, `actif_depuis doit être null, reçu: ${row.actif_depuis}`);
});
