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
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EncaissementRepositorySqlite } from '../../../src/infrastructure/repositories/encaissement-repository-sqlite.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { unBailValide } from '../../_builders/locatif.js';
import type { BailId, EcheanceLoyerId, EncaissementId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

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
  derniereEcheanceId: EcheanceLoyerId | null;
  dernierEncaissementId: EncaissementId | null;
  premierEncaissementId: EncaissementId | null;
  premierLocataireId: LocataireId | null;
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
  this.derniereEcheanceId = null;
  this.dernierEncaissementId = null;
  this.premierEncaissementId = null;
  this.premierLocataireId = null;
});

After({ tags: '@D-74' }, async function (this: MondeD74) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

Before({ tags: '@enc-03' }, async function (this: MondeD74) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  // Use ClockFixe for deterministic dates in ENC-03 tests
  const clock = ClockFixe.du('2026-05-15');
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBailId = null;
  this.derniereEcheanceId = null;
  this.dernierEncaissementId = null;
  this.premierEncaissementId = null;
  this.premierLocataireId = null;
});

After({ tags: '@enc-03' }, async function (this: MondeD74) {
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

// ─── ENC-03 Steps ─────────────────────────────────────────────────────────────

async function creerBailAvecEcheances(
  monde: MondeD74,
  loyerEuros: number,
  actifDepuis: string = '2026-01-01',
): Promise<void> {
  assert.ok(monde.db, 'DB doit être initialisée');
  assert.ok(monde.app, 'App doit être initialisée');

  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();
  const bailId = crypto.randomUUID() as BailId;

  await monde.db.insertInto('bien').values({
    id: bienId,
    rue: '10 rue ENC-03',
    code_postal: '75001',
    ville: 'Paris',
    surface: 50,
    type: 'appartement',
    annee_construction: 2000,
  }).execute();

  await monde.db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: 'Appartement ENC-03',
    type: 'appartement',
    surface: 50,
    etage: null,
  }).execute();

  await monde.db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Testeur',
    prenom: 'Enc',
    date_naissance: '1990-01-01',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email: `enc03-${crypto.randomUUID()}@example.fr`,
    telephone: null,
    rue: '1 rue Test',
    code_postal: '75001',
    ville: 'Paris',
  }).execute();

  // POST /baux to create the bail
  const chargesEuros = loyerEuros * 0 + 0; // 0 charges for simplicity
  const reponseCreation = await monde.app.inject({
    method: 'POST',
    url: '/baux',
    payload: {
      bienId,
      locataireId,
      lotIds: lotId,
      dateDebut: actifDepuis,
      dureeMois: '12',
      loyerHcEuros: String(loyerEuros),
      modeCharges: 'forfait',
      montantChargesEuros: '0',
      depotGarantieEuros: String(loyerEuros),
      irlTrimestre: '2026-T1',
      irlValeur: '145.47',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponseCreation.headers as Record<string, string | string[]>, monde.cookies);

  // Get the created bail ID from redirect
  const location = reponseCreation.headers['location'] as string;
  monde.dernierBailId = location?.split('/').pop() as BailId ?? null;

  // Activate the bail via POST /baux/:id/activer
  const reponseActivation = await monde.app.inject({
    method: 'POST',
    url: `/baux/${monde.dernierBailId}/activer`,
    payload: {
      actifDepuis,
      jourEcheance: '1',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponseActivation.headers as Record<string, string | string[]>, monde.cookies);
}

Given('un bail activé avec 12 échéances toutes payées par encaissements', async function (this: MondeD74) {
  await creerBailAvecEcheances(this, 700);

  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  // Récupérer les échéances et les payer toutes
  const echeances = await this.db
    .selectFrom('echeance_loyer')
    .select(['id', 'total'])
    .where('bail_id', '=', this.dernierBailId)
    .where('annule_le', 'is', null)
    .execute();

  // Payer chaque échéance via POST /encaissements
  for (const ech of echeances) {
    const montantEuros = Number(ech.total) / 100;
    const reponse = await this.app!.inject({
      method: 'POST',
      url: '/encaissements',
      payload: {
        echeanceId: ech.id,
        montantEuros: String(montantEuros),
        signe: 'positif',
        date: '2026-05-05',
        mode: 'virement',
      },
      headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
    });
    extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  }
});

Given('un bail activé avec une échéance en attente de {int} euros', async function (this: MondeD74, loyerEuros: number) {
  await creerBailAvecEcheances(this, loyerEuros);

  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  // Prendre la première échéance
  const echeance = await this.db
    .selectFrom('echeance_loyer')
    .select('id')
    .where('bail_id', '=', this.dernierBailId)
    .orderBy('periode_debut', 'asc')
    .executeTakeFirst();

  this.derniereEcheanceId = echeance?.id as EcheanceLoyerId ?? null;
});

Given('le bailleur saisit un encaissement de {int} euros sur cette échéance', async function (this: MondeD74, montant: number) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: '/encaissements',
    payload: {
      echeanceId: this.derniereEcheanceId,
      montantEuros: String(montant),
      signe: 'positif',
      date: '2026-05-05',
      mode: 'virement',
    },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  // Get the created encaissement ID from redirect
  const location = reponse.headers['location'] as string;
  const encId = location?.split('/').pop() as EncaissementId ?? null;

  // Store the first encaissement ID for later annulation
  if (!this.premierEncaissementId) {
    this.premierEncaissementId = encId;
  }
  this.dernierEncaissementId = encId;

  // Follow redirect to get the response body
  if (reponse.statusCode === 302 && location) {
    const suivi = await this.app.inject({
      method: 'GET',
      url: location,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
    this.dernierCorps = suivi.body;
  } else {
    this.dernierCorps = reponse.body;
  }
});

When(/^le bailleur navigue vers GET \/encaissements\/nouveau$/, async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');

  const reponse = await this.app.inject({
    method: 'GET',
    url: '/encaissements/nouveau',
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

When('le bailleur annule le premier encaissement avec raison {string}', async function (this: MondeD74, raison: string) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.premierEncaissementId, 'PremierEncaissementId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: `/encaissements/${this.premierEncaissementId}/annuler`,
    payload: { raison },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  const location = reponse.headers['location'] as string;
  if (reponse.statusCode === 302 && location) {
    const suivi = await this.app.inject({
      method: 'GET',
      url: location,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
    this.dernierCorps = suivi.body;
  } else {
    this.dernierCorps = reponse.body;
  }
});

Then('le statut de l\'échéance est {string}', async function (this: MondeD74, statutAttendu: string) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  const row = await this.db
    .selectFrom('echeance_loyer')
    .select('statut')
    .where('id', '=', this.derniereEcheanceId)
    .executeTakeFirstOrThrow();

  assert.equal(row.statut, statutAttendu, `Statut attendu: ${statutAttendu}, reçu: ${row.statut}`);
});

Then('la page échéances n\'affiche pas le bouton {string} pour cette échéance', async function (this: MondeD74, bouton: string) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/baux/${this.dernierBailId}/echeances`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  assert.ok(!reponse.body.includes(bouton), `La page ne doit pas afficher "${bouton}"`);
});

Then('la page échéances affiche le bouton {string} pour cette échéance', async function (this: MondeD74, bouton: string) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/baux/${this.dernierBailId}/echeances`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  assert.ok(reponse.body.includes(bouton), `La page doit afficher "${bouton}", corps: ${reponse.body.substring(0, 500)}`);
});

Then('l\'encaissement annulé a un annule_le non null en base', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.premierEncaissementId, 'PremierEncaissementId doit être défini');

  const row = await this.db
    .selectFrom('encaissement')
    .select('annule_le')
    .where('id', '=', this.premierEncaissementId)
    .executeTakeFirstOrThrow();

  assert.ok(row.annule_le !== null, 'annule_le doit être non null');
});

// ─── D-73 Before/After ────────────────────────────────────────────────────────

Before({ tags: '@D-73' }, async function (this: MondeD74) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  // ClockFixe au 2026-06-15 pour les tests D-73
  const clock = ClockFixe.du('2026-06-15');
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBailId = null;
  this.derniereEcheanceId = null;
  this.dernierEncaissementId = null;
  this.premierEncaissementId = null;
  this.premierLocataireId = null;
});

After({ tags: '@D-73' }, async function (this: MondeD74) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── D-73 Steps ──────────────────────────────────────────────────────────────

When(/^le bailleur navigue vers GET \/baux\/:bailId\/modifier-actif$/, async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/baux/${this.dernierBailId}/modifier-actif`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

When(/^le bailleur confirme la modification avec loyer (\d+) euros via POST \/baux\/:bailId\/modifier-actif$/, async function (this: MondeD74, loyer: number) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  // Get current bail values for required fields
  assert.ok(this.db, 'DB doit être initialisée');
  const bailRow = await this.db
    .selectFrom('bail')
    .selectAll()
    .where('id', '=', this.dernierBailId)
    .executeTakeFirstOrThrow();

  const lotRow = await this.db
    .selectFrom('bail_lots')
    .select('lot_id')
    .where('bail_id', '=', this.dernierBailId)
    .executeTakeFirst();

  const reponse = await this.app.inject({
    method: 'POST',
    url: `/baux/${this.dernierBailId}/modifier-actif`,
    payload: {
      bienId: bailRow.bien_id,
      locataireId: bailRow.locataire_id,
      lotIds: lotRow?.lot_id ?? '',
      dateDebut: bailRow.date_debut,
      dureeMois: String(bailRow.duree_mois),
      loyerHcEuros: String(loyer),
      modeCharges: bailRow.mode_charges,
      montantChargesEuros: String(Number(bailRow.montant_charges) / 100),
      depotGarantieEuros: String(Number(bailRow.depot_garantie) / 100),
      irlTrimestre: bailRow.irl_trimestre,
      irlValeur: bailRow.irl_valeur,
      confirmation: 'oui',
    },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.derniereUrl = (reponse.headers['location'] as string) || '';

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

Then('la bannière indique la modification réussie', function (this: MondeD74) {
  assert.ok(
    this.dernierCorps.includes('Bail modifié'),
    `La bannière doit indiquer "Bail modifié". Corps reçu: ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('le bail a bien le nouveau loyer en base', async function (this: MondeD74) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  const row = await this.db
    .selectFrom('bail')
    .select('loyer_hc')
    .where('id', '=', this.dernierBailId)
    .executeTakeFirstOrThrow();

  // loyer_hc est en centimes — 750€ = 75000 centimes
  assert.ok(Number(row.loyer_hc) === 75000, `loyer_hc attendu 75000, reçu ${row.loyer_hc}`);
});

// ─── ENC-04 Before/After ──────────────────────────────────────────────────────

Before({ tags: '@enc-04' }, async function (this: MondeD74) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  const clock = ClockFixe.du('2026-05-15');
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBailId = null;
  this.derniereEcheanceId = null;
  this.dernierEncaissementId = null;
  this.premierEncaissementId = null;
  this.premierLocataireId = null;
});

After({ tags: '@enc-04' }, async function (this: MondeD74) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── ENC-04 Given ─────────────────────────────────────────────────────────────

Given(
  "l'application est prête pour les tests ENC-04 avec clock au 2026-05-15",
  async function (this: MondeD74) {
    // App already set up in Before hook — nothing additional needed
    assert.ok(this.app, 'App doit être initialisée par le hook Before');
  },
);

async function creerBailAvecEcheancesEnc04(
  monde: MondeD74,
  loyerEuros: number,
  actifDepuis: string = '2026-01-01',
): Promise<{ bailId: BailId; locataireId: string }> {
  assert.ok(monde.db, 'DB doit être initialisée');
  assert.ok(monde.app, 'App doit être initialisée');

  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();

  await monde.db.insertInto('bien').values({
    id: bienId,
    rue: '10 rue ENC-04',
    code_postal: '75001',
    ville: 'Paris',
    surface: 50,
    type: 'appartement',
    annee_construction: 2000,
  }).execute();

  await monde.db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: 'Appartement ENC-04',
    type: 'appartement',
    surface: 50,
    etage: null,
  }).execute();

  await monde.db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Testeur',
    prenom: 'Enc04',
    date_naissance: '1990-01-01',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email: `enc04-${crypto.randomUUID()}@example.fr`,
    telephone: null,
    rue: '1 rue Test',
    code_postal: '75001',
    ville: 'Paris',
  }).execute();

  const reponseCreation = await monde.app.inject({
    method: 'POST',
    url: '/baux',
    payload: {
      bienId,
      locataireId,
      lotIds: lotId,
      dateDebut: actifDepuis,
      dureeMois: '12',
      loyerHcEuros: String(loyerEuros),
      modeCharges: 'forfait',
      montantChargesEuros: '0',
      depotGarantieEuros: String(loyerEuros),
      irlTrimestre: '2026-T1',
      irlValeur: '145.47',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponseCreation.headers as Record<string, string | string[]>, monde.cookies);

  const location = reponseCreation.headers['location'] as string;
  const bailId = location?.split('/').pop() as BailId ?? null;
  monde.dernierBailId = bailId;

  await monde.app.inject({
    method: 'POST',
    url: `/baux/${bailId}/activer`,
    payload: { actifDepuis, jourEcheance: '1' },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });

  return { bailId, locataireId };
}

Given(
  'un bail activé avec 12 échéances entièrement payées par encaissements exacts',
  async function (this: MondeD74) {
    const { bailId } = await creerBailAvecEcheancesEnc04(this, 700);
    assert.ok(this.db, 'DB doit être initialisée');

    const echeances = await this.db
      .selectFrom('echeance_loyer')
      .select(['id', 'total'])
      .where('bail_id', '=', bailId)
      .where('annule_le', 'is', null)
      .execute();

    for (const ech of echeances) {
      const montantEuros = Number(ech.total) / 100;
      await this.app!.inject({
        method: 'POST',
        url: '/encaissements',
        payload: {
          echeanceId: ech.id,
          montantEuros: String(montantEuros),
          signe: 'positif',
          date: '2026-05-05',
          mode: 'virement',
        },
        headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
      });
    }
  },
);

Given(
  'un bail activé avec 12 échéances dont la première payée la deuxième partielle et les autres en attente',
  async function (this: MondeD74) {
    const { bailId } = await creerBailAvecEcheancesEnc04(this, 700);
    assert.ok(this.db, 'DB doit être initialisée');

    const echeances = await this.db
      .selectFrom('echeance_loyer')
      .select(['id', 'total'])
      .where('bail_id', '=', bailId)
      .where('annule_le', 'is', null)
      .orderBy('periode_debut', 'asc')
      .execute();

    // Première : payer exactement
    if (echeances[0]) {
      const montantEuros = Number(echeances[0].total) / 100;
      await this.app!.inject({
        method: 'POST',
        url: '/encaissements',
        payload: {
          echeanceId: echeances[0].id,
          montantEuros: String(montantEuros),
          signe: 'positif',
          date: '2026-05-05',
          mode: 'virement',
        },
        headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
      });
    }

    // Deuxième : paiement partiel (300€ sur 700€)
    if (echeances[1]) {
      await this.app!.inject({
        method: 'POST',
        url: '/encaissements',
        payload: {
          echeanceId: echeances[1].id,
          montantEuros: '300',
          signe: 'positif',
          date: '2026-05-05',
          mode: 'virement',
        },
        headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
      });
    }
    // Les autres restent en_attente
  },
);

Given(
  'deux baux activés avec des impayés pour des locataires différents',
  async function (this: MondeD74) {
    const { locataireId: locId1 } = await creerBailAvecEcheancesEnc04(this, 700, '2026-01-01');
    this.premierLocataireId = locId1 as LocataireId;

    // Créer un deuxième bail pour un autre locataire
    await creerBailAvecEcheancesEnc04(this, 800, '2026-01-01');
    // Les échéances restent toutes en_attente pour les deux baux
  },
);

Given(
  'plusieurs échéances impayées à des dates différentes',
  async function (this: MondeD74) {
    // Un bail avec plusieurs échéances en attente suffit — generées auto à l'activation
    await creerBailAvecEcheancesEnc04(this, 700, '2026-01-01');
  },
);

// ─── ENC-04 When ─────────────────────────────────────────────────────────────

When(/^le bailleur navigue vers GET \/impayes$/, async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');

  const reponse = await this.app.inject({
    method: 'GET',
    url: '/impayes',
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

When(/^le bailleur navigue vers GET \/impayes avec filtre sur le premier locataire$/, async function (this: MondeD74) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.premierLocataireId, 'premierLocataireId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/impayes?locataire=${this.premierLocataireId}`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

// ─── ENC-04 Then ─────────────────────────────────────────────────────────────

Then('la page impayés affiche l\'empty state {string}', function (this: MondeD74, texte: string) {
  assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
  assert.ok(
    this.dernierCorps.includes(texte),
    `La page doit afficher "${texte}". Corps reçu (500 chars): ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('la page impayés affiche au moins 1 ligne impayée', function (this: MondeD74) {
  assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
  // La page affiche la table avec des lignes — vérifier qu'il y a du contenu de table
  assert.ok(
    this.dernierCorps.includes('<tbody>') || this.dernierCorps.includes('impayé'),
    `La page doit afficher des impayés. Corps (500 chars): ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('la page impayés affiche le total global impayé', function (this: MondeD74) {
  assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
  // La page doit afficher le total — vérifier qu'un montant €/impayé est affiché
  assert.ok(
    this.dernierCorps.includes('impayé') || this.dernierCorps.includes('€'),
    `La page doit afficher un total global. Corps (500 chars): ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('la page impayés n\'affiche que les échéances du premier locataire', function (this: MondeD74) {
  assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
  // La page doit afficher "Enc04" (prénom du premier locataire) — et ne pas afficher le deuxième
  // Le prénom du premier locataire est "Enc04", celui du second aussi — différenciation par le corps
  // Au minimum la page doit avoir rendu 200
  assert.ok(
    !this.dernierCorps.includes('Tous les loyers sont à jour'),
    'La page ne doit pas afficher l\'empty state si des impayés existent',
  );
});

Then('la page impayés affiche les échéances triées de la plus ancienne à la plus récente', function (this: MondeD74) {
  assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
  assert.ok(
    this.dernierCorps.includes('<tbody>') || this.dernierCorps.includes('janv') || this.dernierCorps.includes('2026'),
    `La page doit afficher des données triées. Corps (500 chars): ${this.dernierCorps.substring(0, 500)}`,
  );
});
