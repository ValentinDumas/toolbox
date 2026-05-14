import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeBailleur extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
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

Before({ tags: '@bailleur' }, async function (this: MondeBailleur) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
});

After({ tags: '@bailleur' }, async function (this: MondeBailleur) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given("l'application est prête pour la phase 2", async function (this: MondeBailleur) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.app, 'App doit être initialisée');
});

Given(
  'un profil bailleur existe avec nomComplet {string}',
  async function (this: MondeBailleur, nomComplet: string) {
    assert.ok(this.app, 'App doit être initialisée');
    const payload = new URLSearchParams({
      nomComplet,
      rue: '12 rue de la Paix',
      codePostal: '75002',
      ville: 'Paris',
    }).toString();

    const reponse = await this.app.inject({
      method: 'POST',
      url: '/bailleur',
      payload,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
      },
    });
    extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
    assert.equal(reponse.statusCode, 302, `POST /bailleur devrait retourner 302, reçu ${reponse.statusCode}`);
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When(/^le bailleur visite GET \/bailleur$/, async function (this: MondeBailleur) {
  assert.ok(this.app, 'App doit être initialisée');
  const headers: Record<string, string> = {};
  if (Object.keys(this.cookies).length > 0) {
    headers['cookie'] = cookieHeader(this.cookies);
  }
  const reponse = await this.app.inject({ method: 'GET', url: '/bailleur', headers });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

When(
  'le bailleur soumet le formulaire profil avec nomComplet {string}, rue {string}, codePostal {string}, ville {string}',
  async function (
    this: MondeBailleur,
    nomComplet: string,
    rue: string,
    codePostal: string,
    ville: string,
  ) {
    assert.ok(this.app, 'App doit être initialisée');
    const payload = new URLSearchParams({ nomComplet, rue, codePostal, ville }).toString();

    const reponse = await this.app.inject({
      method: 'POST',
      url: '/bailleur',
      payload,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
      },
    });
    extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
    this.dernierStatut = reponse.statusCode;
    this.derniereUrl = (reponse.headers['location'] as string) || '';

    // Follow redirect if 302
    if (reponse.statusCode === 302 && this.derniereUrl) {
      const suivi = await this.app.inject({
        method: 'GET',
        url: this.derniereUrl,
        headers: { cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
      this.dernierCorps = suivi.body;
    }
  },
);

When(
  "on tente d'insérer un 2e bailleur directement en base",
  async function (this: MondeBailleur) {
    assert.ok(this.db, 'DB doit être initialisée');
    try {
      await this.db
        .insertInto('bailleur')
        .values({
          id: 'second-bailleur-id',
          singleton_marker: 'unique_bailleur',
          nom_complet: 'Second Bailleur',
          rue: '1 rue Test',
          code_postal: '75001',
          ville: 'Paris',
        })
        .execute();
      this['dernierErreurUnique'] = null;
    } catch (e) {
      this['dernierErreurUnique'] = e;
    }
  },
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then('le formulaire profil bailleur est vide', function (this: MondeBailleur) {
  assert.equal(this.dernierStatut, 200, `GET /bailleur doit retourner 200, reçu ${this.dernierStatut}`);
  assert.ok(
    this.dernierCorps.includes('Profil bailleur'),
    'La page doit afficher "Profil bailleur"',
  );
});

Then('le formulaire est pré-rempli avec {string}', function (this: MondeBailleur, nomComplet: string) {
  assert.ok(
    this.dernierCorps.includes(nomComplet),
    `Le formulaire doit contenir "${nomComplet}". Corps reçu (extrait) : ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('la table SQLite bailleur contient exactement 1 ligne', async function (this: MondeBailleur) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('bailleur')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, `Table bailleur doit contenir 1 ligne, contient ${count.count}`);
});

Then(
  "l'insertion est rejetée avec une erreur UNIQUE constraint",
  function (this: MondeBailleur) {
    const erreur = this['dernierErreurUnique'] as Error | null;
    assert.ok(erreur !== null, "Une erreur UNIQUE constraint doit avoir été levée");
    assert.ok(
      erreur!.message.includes('UNIQUE constraint failed'),
      `L'erreur doit contenir 'UNIQUE constraint failed', reçu: ${erreur!.message}`,
    );
  },
);
