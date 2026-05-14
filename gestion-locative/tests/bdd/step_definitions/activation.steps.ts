import { After, Before, Given, Then, When, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { marquerWizardComplete } from '../../../src/infrastructure/lifecycle/premier-lancement.js';
import { creerApp } from '../../../src/main.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { InjectOptions } from 'fastify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeActivation extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
}

Before(async function (this: MondeActivation) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  const sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(this.db, sqlite, MIGRATIONS_DIR);
  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
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
      'lots[0].designation': lotDesignation,
      'lots[0].type': lotType,
      // surface lot : appartement requiert surface > 0
      'lots[0].surface': lotType === 'appartement' || lotType === 'local_commercial' ? String(surface) : '',
      'lots[0].etage': '',
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

Then(/^le Bien est visible dans la liste GET \/biens$/, async function (this: MondeActivation) {
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

// Helper: parse Set-Cookie headers and merge into cookie jar
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
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

async function requeteAvecCookies(
  monde: MondeActivation,
  opts: InjectOptions,
): Promise<{ statusCode: number; location: string; body: string }> {
  assert.ok(monde.app, 'App doit être initialisée');
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (Object.keys(monde.cookies).length > 0) {
    headers['cookie'] = cookieHeader(monde.cookies);
  }
  const reponse = await monde.app.inject({ ...opts, headers });
  extraireCookies(reponse.headers as Record<string, string | string[]>, monde.cookies);
  const location = (reponse.headers['location'] as string) || '';
  if (reponse.statusCode === 302 && location) {
    const suivi = await monde.app.inject({
      method: 'GET',
      url: location,
      headers: { cookie: cookieHeader(monde.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, monde.cookies);
    return { statusCode: reponse.statusCode, location, body: suivi.body };
  }
  return { statusCode: reponse.statusCode, location, body: reponse.body };
}

// ─── Nouveaux steps wizard ────────────────────────────────────────────────

Given("l'application a déjà complété le wizard", async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  await marquerWizardComplete(this.db);
});

When('le bailleur visite {string}', async function (this: MondeActivation, url: string) {
  assert.ok(this.app, 'App doit être initialisée');
  const headers: Record<string, string> = {};
  if (Object.keys(this.cookies).length > 0) {
    headers['cookie'] = cookieHeader(this.cookies);
  }
  const reponse = await this.app.inject({ method: 'GET', url, headers });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.derniereUrl = (reponse.headers['location'] as string) || url;

  if (reponse.statusCode === 302 && this.derniereUrl) {
    const suivi = await this.app.inject({
      method: 'GET',
      url: this.derniereUrl,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
    this.dernierCorps = suivi.body;
  } else {
    this.dernierCorps = reponse.body;
  }
});

Then('il est redirigé vers {string}', function (this: MondeActivation, urlAttendue: string) {
  assert.equal(this.derniereUrl, urlAttendue, `Attendu redirect vers "${urlAttendue}", obtenu "${this.derniereUrl}"`);
});

Then('la page affiche {string}', function (this: MondeActivation, texte: string) {
  assert.ok(
    this.dernierCorps.includes(texte),
    `La page doit afficher "${texte}". Corps reçu (extrait) : ${this.dernierCorps.substring(0, 500)}`,
  );
});

When(
  'le bailleur soumet le formulaire wizard bien avec l\'adresse {string}, code postal {string}, ville {string}, surface {int}, type {string}, année {int}, lot désignation {string}, type lot {string}',
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
    const payload = new URLSearchParams({
      rue,
      codePostal,
      ville,
      surface: String(surface),
      type,
      anneeConstruction: String(anneeConstruction),
      'lots[0].designation': lotDesignation,
      'lots[0].type': lotType,
      'lots[0].surface': lotType === 'appartement' || lotType === 'local_commercial' ? String(surface) : '',
      'lots[0].etage': '',
    }).toString();

    const result = await requeteAvecCookies(this, {
      method: 'POST',
      url: '/wizard/bien',
      payload,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.dernierStatut = result.statusCode;
    this.derniereUrl = result.location;
    this.dernierCorps = result.body;
  },
);

When(
  'le bailleur soumet le formulaire wizard locataire avec nom {string}, prénom {string}, email {string}, date de naissance {string}, commune {string}, pays {string}, nationalité {string}, téléphone {string}, rue {string}, code postal {string}, ville {string}',
  async function (
    this: MondeActivation,
    nom: string,
    prenom: string,
    email: string,
    dateNaissance: string,
    communeNaissance: string,
    paysNaissance: string,
    nationalite: string,
    telephone: string,
    rue: string,
    codePostal: string,
    ville: string,
  ) {
    const payload = new URLSearchParams({
      nom, prenom, email, dateNaissance, communeNaissance, paysNaissance, nationalite,
      telephone, rue, codePostal, ville,
    }).toString();

    const result = await requeteAvecCookies(this, {
      method: 'POST',
      url: '/wizard/locataire',
      payload,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.dernierStatut = result.statusCode;
    this.derniereUrl = result.location;
    this.dernierCorps = result.body;
  },
);

When(
  'le bailleur soumet le formulaire wizard bail avec loyer {int}, charges {int}, mode {string}, dépôt {int}, IRL trimestre {string}, IRL valeur {string}, date début {string}, durée {int}',
  async function (
    this: MondeActivation,
    loyer: number,
    charges: number,
    mode: string,
    depot: number,
    irlTrimestre: string,
    irlValeur: string,
    dateDebut: string,
    dureeMois: number,
  ) {
    assert.ok(this.db, 'DB doit être initialisée');
    // Récupère les lots du bien créé à l'étape 1
    const lots = await this.db.selectFrom('lot').select('id').execute();
    const params = new URLSearchParams({
      loyerHcEuros: String(loyer),
      montantChargesEuros: String(charges),
      modeCharges: mode,
      depotGarantieEuros: String(depot),
      irlTrimestre,
      irlValeur,
      dateDebut,
      dureeMois: String(dureeMois),
    });
    for (const lot of lots) {
      params.append('lotIds', lot.id);
    }

    const result = await requeteAvecCookies(this, {
      method: 'POST',
      url: '/wizard/bail',
      payload: params.toString(),
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    this.dernierStatut = result.statusCode;
    this.derniereUrl = result.location;
    this.dernierCorps = result.body;
  },
);

Then('la table SQLite bien contient 1 ligne', async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('bien')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, 'Table bien doit contenir 1 ligne');
});

Then('la table SQLite locataire contient 1 ligne', async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('locataire')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, 'Table locataire doit contenir 1 ligne');
});

Then('la table SQLite bail contient 1 ligne', async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('bail')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, 'Table bail doit contenir 1 ligne');
});

Then('la table SQLite bail_lots contient 1 ligne', async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('bail_lots')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, 'Table bail_lots doit contenir 1 ligne');
});

Then('la table SQLite meta contient wizard_complete', async function (this: MondeActivation) {
  assert.ok(this.db, 'DB doit être initialisée');
  const row = await this.db
    .selectFrom('meta')
    .selectAll()
    .where('cle', '=', 'wizard_complete')
    .executeTakeFirst();
  assert.ok(row, 'Table meta doit contenir la clé wizard_complete');
  assert.equal(row.valeur, '1', 'meta.wizard_complete doit valoir "1"');
});
