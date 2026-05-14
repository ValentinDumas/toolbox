import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId, QuittanceId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeEnc01 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
  dernierBailId: BailId | null;
  derniereEcheanceId: EcheanceLoyerId | null;
  derniereEcheance2Id: EcheanceLoyerId | null;
  derniereQuittanceId: QuittanceId | null;
  premierNumeroQuittance: string | null;
  deuxiemeNumeroQuittance: string | null;
  tmpDataDir: string | null;
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

// ─── Before/After ────────────────────────────────────────────────────────────

Before({ tags: '@enc-01' }, async function (this: MondeEnc01) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';

  // Créer un dossier tmp pour stocker les PDFs des tests
  this.tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-enc01-test-'));
  process.env['GESTION_LOCATIVE_DATA_DIR'] = this.tmpDataDir;

  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-05-31');
  this.app = await creerApp(this.db, { clock });

  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBailId = null;
  this.derniereEcheanceId = null;
  this.derniereEcheance2Id = null;
  this.derniereQuittanceId = null;
  this.premierNumeroQuittance = null;
  this.deuxiemeNumeroQuittance = null;
});

After({ tags: '@enc-01' }, async function (this: MondeEnc01) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
  if (this.tmpDataDir) {
    fs.rmSync(this.tmpDataDir, { recursive: true, force: true });
  }
  delete process.env['GESTION_LOCATIVE_DATA_DIR'];
});

// ─── Helper: créer un bail complet et l'activer ────────────────────────────

async function creerEtActiverBail(monde: MondeEnc01, avecBailleur: boolean = true): Promise<void> {
  assert.ok(monde.db, 'DB doit être initialisée');
  assert.ok(monde.app, 'App doit être initialisée');

  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();

  await monde.db.insertInto('bien').values({
    id: bienId,
    rue: '10 rue ENC-01',
    code_postal: '75001',
    ville: 'Paris',
    surface: 50,
    type: 'appartement',
    annee_construction: 2000,
  }).execute();

  await monde.db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: 'Appartement ENC-01',
    type: 'appartement',
    surface: 50,
    etage: null,
  }).execute();

  await monde.db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Dupont',
    prenom: 'Jean',
    date_naissance: '1985-01-01',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email: `enc01-${crypto.randomUUID()}@example.fr`,
    telephone: null,
    rue: '1 rue Test',
    code_postal: '75001',
    ville: 'Paris',
  }).execute();

  if (avecBailleur) {
    await monde.db.insertInto('bailleur').values({
      id: crypto.randomUUID(),
      singleton_marker: 'SINGLETON',
      nom_complet: 'Jean Bailleur',
      rue: '1 avenue Bailleur',
      code_postal: '75001',
      ville: 'Paris',
    }).onConflict((oc) => oc.column('singleton_marker').doNothing()).execute();
  }

  // Créer le bail via l'API
  const reponseCreation = await monde.app!.inject({
    method: 'POST',
    url: '/baux',
    payload: {
      bienId,
      locataireId,
      lotIds: lotId,
      dateDebut: '2026-05-01',
      dureeMois: '12',
      loyerHcEuros: '620',
      modeCharges: 'forfait',
      montantChargesEuros: '80',
      depotGarantieEuros: '700',
      irlTrimestre: '2026-T1',
      irlValeur: '145.47',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponseCreation.headers as Record<string, string | string[]>, monde.cookies);

  const location = reponseCreation.headers['location'] as string;
  monde.dernierBailId = location?.split('/').pop() as BailId ?? null;

  // Activer le bail
  const reponseActivation = await monde.app!.inject({
    method: 'POST',
    url: `/baux/${monde.dernierBailId}/activer`,
    payload: {
      actifDepuis: '2026-05-01',
      jourEcheance: '5',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponseActivation.headers as Record<string, string | string[]>, monde.cookies);
}

async function payerPremiereEcheance(monde: MondeEnc01, montant: number): Promise<void> {
  assert.ok(monde.db, 'DB doit être initialisée');
  assert.ok(monde.dernierBailId, 'BailId doit être défini');

  const echeance = await monde.db
    .selectFrom('echeance_loyer')
    .select('id')
    .where('bail_id', '=', monde.dernierBailId)
    .orderBy('periode_debut', 'asc')
    .executeTakeFirst();

  monde.derniereEcheanceId = echeance?.id as EcheanceLoyerId ?? null;

  const reponse = await monde.app!.inject({
    method: 'POST',
    url: '/encaissements',
    payload: {
      echeanceId: monde.derniereEcheanceId,
      montantEuros: String(montant),
      signe: 'positif',
      date: '2026-05-05',
      mode: 'virement',
    },
    headers: { ...(Object.keys(monde.cookies).length > 0 ? { cookie: cookieHeader(monde.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, monde.cookies);
}

// ─── Given ────────────────────────────────────────────────────────────────────

Given(/^un bail activé avec une échéance payée exactement \(700 euros\)$/, async function (this: MondeEnc01) {
  await creerEtActiverBail(this, true);
  await payerPremiereEcheance(this, 700);
});

Given(/^un bail activé avec une échéance partiellement payée \(300 euros sur 700\)$/, async function (this: MondeEnc01) {
  await creerEtActiverBail(this, true);
  await payerPremiereEcheance(this, 300);
});

Given(/^un bail activé avec une échéance payée \(aucun profil bailleur configuré\)$/, async function (this: MondeEnc01) {
  await creerEtActiverBail(this, false);
  await payerPremiereEcheance(this, 700);
});

Given('un bail activé avec deux échéances payées en 2026', async function (this: MondeEnc01) {
  await creerEtActiverBail(this, true);

  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.dernierBailId, 'BailId doit être défini');

  // Récupérer les 2 premières échéances
  const echeances = await this.db
    .selectFrom('echeance_loyer')
    .select('id')
    .where('bail_id', '=', this.dernierBailId)
    .orderBy('periode_debut', 'asc')
    .limit(2)
    .execute();

  this.derniereEcheanceId = echeances[0]?.id as EcheanceLoyerId ?? null;
  this.derniereEcheance2Id = echeances[1]?.id as EcheanceLoyerId ?? null;

  // Payer les deux
  for (const ech of echeances) {
    await this.app!.inject({
      method: 'POST',
      url: '/encaissements',
      payload: {
        echeanceId: ech.id,
        montantEuros: '700',
        signe: 'positif',
        date: '2026-05-05',
        mode: 'virement',
      },
      headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
    });
  }
});

Given("un bail activé avec une échéance payée et une quittance émise", async function (this: MondeEnc01) {
  await creerEtActiverBail(this, true);
  await payerPremiereEcheance(this, 700);

  // Générer la quittance
  const reponse = await this.app!.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheanceId },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  // Extraire l'ID de la quittance depuis la redirect
  const location = reponse.headers['location'] as string;
  this.derniereQuittanceId = location?.split('/').pop() as QuittanceId ?? null;
});

Given('un bail activé avec une quittance générée', async function (this: MondeEnc01) {
  await creerEtActiverBail(this, true);
  await payerPremiereEcheance(this, 700);

  const reponse = await this.app!.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheanceId },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  const location = reponse.headers['location'] as string;
  this.derniereQuittanceId = location?.split('/').pop() as QuittanceId ?? null;
});

// ─── When ─────────────────────────────────────────────────────────────────────

When(/^le bailleur génère la quittance via POST \/quittances$/, async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheanceId },
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
    this.derniereQuittanceId = this.derniereUrl.split('/').pop() as QuittanceId ?? null;
  } else {
    this.dernierCorps = reponse.body;
  }
});

When(/^le bailleur tente de générer la quittance via POST \/quittances$/, async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheanceId },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.derniereUrl = (reponse.headers['location'] as string) || '';

  if (this.derniereUrl && this.dernierStatut === 302) {
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

When('le bailleur génère la quittance pour la première échéance', async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheanceId },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  // Récupérer le numéro depuis la liste des quittances en DB
  assert.ok(this.db, 'DB doit être initialisée');
  const q = await this.db
    .selectFrom('quittance')
    .select(['id', 'numero'])
    .where('echeance_id', '=', this.derniereEcheanceId)
    .executeTakeFirst();
  this.premierNumeroQuittance = q?.numero ?? null;
});

When('le bailleur génère la quittance pour la deuxième échéance', async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereEcheance2Id, 'EcheanceId 2 doit être défini');

  const reponse = await this.app.inject({
    method: 'POST',
    url: '/quittances',
    payload: { echeanceId: this.derniereEcheance2Id },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  assert.ok(this.db, 'DB doit être initialisée');
  const q = await this.db
    .selectFrom('quittance')
    .select(['id', 'numero'])
    .where('echeance_id', '=', this.derniereEcheance2Id)
    .executeTakeFirst();
  this.deuxiemeNumeroQuittance = q?.numero ?? null;
});

When("le bailleur annule l'encaissement lié à cette échéance", async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');

  // Trouver l'encaissement actif
  const enc = await this.db
    .selectFrom('encaissement')
    .select('id')
    .where('echeance_id', '=', this.derniereEcheanceId)
    .where('annule_le', 'is', null)
    .executeTakeFirst();

  assert.ok(enc, 'Encaissement doit exister');

  const reponse = await this.app.inject({
    method: 'POST',
    url: `/encaissements/${enc.id}/annuler`,
    payload: { raison: 'Test annulation D-65' },
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
});

When(/^le bailleur demande GET \/quittances\/:id\/pdf$/, async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereQuittanceId, 'QuittanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/quittances/${this.derniereQuittanceId}/pdf`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
  (this as MondeEnc01 & { derniereReponse?: { rawPayload: Buffer; headers: Record<string, string> } }).derniereReponse = reponse as unknown as { rawPayload: Buffer; headers: Record<string, string> };
});

// ─── Then ─────────────────────────────────────────────────────────────────────

Then('il est redirigé vers la fiche de la quittance', function (this: MondeEnc01) {
  assert.ok(this.derniereUrl, 'URL de redirection doit être définie');
  assert.match(this.derniereUrl, /^\/quittances\/[0-9a-f-]+$/, `URL doit être /quittances/:id, obtenu: ${this.derniereUrl}`);
});

// Note: 'la page affiche {string}' step already defined in activation.steps.ts — shared globally

Then('la base contient 1 quittance avec numéro {string}', async function (this: MondeEnc01, numero: string) {
  assert.ok(this.db, 'DB doit être initialisée');
  const rows = await this.db
    .selectFrom('quittance')
    .select('numero')
    .where('numero', '=', numero)
    .execute();
  assert.equal(rows.length, 1, `Attendu 1 quittance avec numéro "${numero}", trouvé ${rows.length}`);
});

Then('le fichier PDF de la quittance existe sur disque', async function (this: MondeEnc01) {
  assert.ok(this.db, 'DB doit être initialisée');
  const row = await this.db
    .selectFrom('quittance')
    .select('chemin_fichier_relatif')
    .executeTakeFirst();
  assert.ok(row, 'Une quittance doit exister en base');

  const baseDir = process.env['GESTION_LOCATIVE_DATA_DIR'] ?? '';
  const cheminAbsolu = path.join(baseDir, row.chemin_fichier_relatif);
  assert.ok(fs.existsSync(cheminAbsolu), `Le fichier PDF doit exister à ${cheminAbsolu}`);
});

Then('la réponse est un statut 400 ou une redirection avec erreur', function (this: MondeEnc01) {
  // 400 direct ou 302 (redirect) sont tous les deux acceptables
  const isErreur = this.dernierStatut === 400 || this.dernierStatut === 302;
  assert.ok(isErreur, `Statut attendu 400 ou 302 (erreur), obtenu ${this.dernierStatut}`);
});

Then("aucune quittance n'est créée en base", async function (this: MondeEnc01) {
  assert.ok(this.db, 'DB doit être initialisée');
  const rows = await this.db
    .selectFrom('quittance')
    .select('id')
    .execute();
  assert.equal(rows.length, 0, `Attendu 0 quittance en base, trouvé ${rows.length}`);
});

Then('il est redirigé vers la page bailleur', function (this: MondeEnc01) {
  assert.ok(
    this.derniereUrl.includes('/bailleur') || this.dernierCorps.includes('/bailleur'),
    `Attendu redirection vers /bailleur, obtenu url="${this.derniereUrl}" corps="${this.dernierCorps.substring(0, 200)}"`,
  );
});

Then('les numéros respectifs sont {string} et {string}', function (this: MondeEnc01, num1: string, num2: string) {
  assert.equal(this.premierNumeroQuittance, num1, `1er numéro attendu "${num1}", obtenu "${this.premierNumeroQuittance}"`);
  assert.equal(this.deuxiemeNumeroQuittance, num2, `2ème numéro attendu "${num2}", obtenu "${this.deuxiemeNumeroQuittance}"`);
});

Then('le statut de l\'échéance redevient {string}', async function (this: MondeEnc01, statut: string) {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.derniereEcheanceId, 'EcheanceId doit être défini');
  const row = await this.db
    .selectFrom('echeance_loyer')
    .select('statut')
    .where('id', '=', this.derniereEcheanceId)
    .executeTakeFirstOrThrow();
  assert.equal(row.statut, statut, `Statut attendu "${statut}", obtenu "${row.statut}"`);
});

Then(/^GET \/quittances\/:id affiche le warning quittance invalide$/, async function (this: MondeEnc01) {
  assert.ok(this.app, 'App doit être initialisée');
  assert.ok(this.derniereQuittanceId, 'QuittanceId doit être défini');

  const reponse = await this.app.inject({
    method: 'GET',
    url: `/quittances/${this.derniereQuittanceId}`,
    headers: { ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}) },
  });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);

  const corps = reponse.body;
  const contientWarning =
    corps.includes('invalide') ||
    corps.includes('Attention') ||
    corps.includes('Marquer comme annulée');
  assert.ok(
    contientWarning,
    `La page doit afficher un warning quittance invalide. Corps: ${corps.substring(0, 500)}`,
  );
});

Then(/^la réponse est Content-Type application\/pdf$/, function (this: MondeEnc01) {
  const reponse = (this as MondeEnc01 & { derniereReponse?: { headers: Record<string, string> } }).derniereReponse;
  assert.ok(reponse, 'Une réponse doit être stockée');
  const contentType = reponse.headers['content-type'] ?? '';
  assert.ok(contentType.includes('application/pdf'), `Content-Type attendu application/pdf, obtenu "${contentType}"`);
});

Then('le corps commence par le magic bytes PDF', function (this: MondeEnc01) {
  const reponse = (this as MondeEnc01 & { derniereReponse?: { rawPayload: Buffer } }).derniereReponse;
  assert.ok(reponse, 'Une réponse doit être stockée');
  const debut = reponse.rawPayload.slice(0, 5).toString('binary');
  assert.equal(debut, '%PDF-', `Magic bytes attendu "%PDF-", obtenu "${debut}"`);
});
