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
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId, RelanceId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeRelance extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  dernierBuffer: Buffer | null;
  dernierContentType: string;
  cookies: CookieJar;
  dernierBailId: BailId | null;
  derniereEcheanceId: EcheanceLoyerId | null;
  derniereRelanceId: RelanceId | null;
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

// ─── Before/After pour @enc-05 ──────────────────────────────────────────────

Before({ tags: '@enc-05' }, async function (this: MondeRelance) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-relance-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  // default clock : 2026-05-20 (J+15 par rapport à 2026-05-05)
  const clock = ClockFixe.du('2026-05-20');
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.dernierBuffer = null;
  this.dernierContentType = '';
  this.cookies = {};
  this.dernierBailId = null;
  this.derniereEcheanceId = null;
  this.derniereRelanceId = null;
});

After({ tags: '@enc-05' }, async function (this: MondeRelance) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function creerBailAvecEcheance(
  db: Kysely<DB>,
  opts: {
    locataireEmail?: string;
    jourEcheanceAttendue?: string;
  } = {},
): Promise<{ bailId: BailId; echeanceId: EcheanceLoyerId }> {
  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();
  const bailId = crypto.randomUUID() as BailId;
  const echeanceId = crypto.randomUUID() as EcheanceLoyerId;

  await db.insertInto('bien').values({
    id: bienId,
    rue: '10 rue du Test',
    code_postal: '75010',
    ville: 'Paris',
    surface: 45,
    type: 'appartement',
    annee_construction: 1990,
  }).execute();

  await db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: 'Appartement principal',
    type: 'appartement',
    surface: 45,
    etage: null,
  }).execute();

  await db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Martin',
    prenom: 'Marie',
    date_naissance: '1985-06-15',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email: opts.locataireEmail ?? 'marie.martin@example.fr',
    telephone: '0123456789',
    rue: '10 rue du Test',
    code_postal: '75010',
    ville: 'Paris',
  }).execute();

  await db.insertInto('bail').values({
    id: bailId,
    locataire_id: locataireId,
    bien_id: bienId,
    type: 'meuble',
    date_debut: '2026-01-01',
    duree_mois: 12,
    loyer_hc: 70000,
    mode_charges: 'forfait',
    montant_charges: 0,
    depot_garantie: 140000,
    irl_trimestre: '2025-T3',
    irl_valeur: '143.03',
    cautionnement: null,
    actif_depuis: '2026-01-01',
    jour_echeance: 5,
  }).execute();

  await db.insertInto('bail_lots').values({ bail_id: bailId, lot_id: lotId }).execute();

  const jourEcheanceAttendue = opts.jourEcheanceAttendue ?? '2026-05-05';
  await db.insertInto('echeance_loyer').values({
    id: echeanceId,
    bail_id: bailId,
    periode_debut: '2026-05-01',
    periode_fin: '2026-05-31',
    jour_echeance_attendue: jourEcheanceAttendue,
    loyer_hc: 70000,
    montant_charges: 0,
    mode_charges: 'forfait',
    total: 70000,
    statut: 'en_attente',
    annule_le: null,
  }).execute();

  // Insérer le profil bailleur
  const bailleurId = crypto.randomUUID();
  const bailleurExist = await db.selectFrom('bailleur').selectAll().limit(1).executeTakeFirst();
  if (!bailleurExist) {
    await db.insertInto('bailleur').values({
      id: bailleurId,
      singleton_marker: 'unique',
      nom_complet: 'Jean Dupont',
      rue: '1 rue de la Paix',
      code_postal: '75001',
      ville: 'Paris',
    }).execute();
  }

  return { bailId, echeanceId };
}

async function inserterRelance(
  db: Kysely<DB>,
  echeanceId: EcheanceLoyerId,
  niveau: 1 | 2 | 3,
  envoyeeLe: string = '2026-05-15',
): Promise<RelanceId> {
  const id = crypto.randomUUID() as RelanceId;
  await db.insertInto('relance' as any).values({
    id,
    echeance_id: echeanceId,
    niveau,
    canal: niveau === 3 ? 'pdf' : 'email',
    envoyee_le: envoyeeLe,
    contenu_snapshot: JSON.stringify({ version: 'v1', variables: {}, contenuRendu: 'Test relance', mailtoUri: niveau < 3 ? 'mailto:test@example.fr?subject=Test' : null }),
    annule_le: null,
  } as any).execute();
  return id;
}

// ─── Given Steps ──────────────────────────────────────────────────────────────

Given(
  'un bail activé avec un locataire et une échéance impayée depuis 15 jours (clock 2026-05-20)',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // jourEcheanceAttendue = 2026-05-05, clock = 2026-05-20 → J+15 ≥ J+10
    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db, {
      jourEcheanceAttendue: '2026-05-05',
    });
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'un bail activé avec relance niveau 1 envoyée et échéance toujours impayée à J+30',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // Recrée app avec clock J+30 (2026-05-05 + 30 = 2026-06-04)
    if (this.app) await this.app.close();
    const clock = ClockFixe.du('2026-06-04');
    this.app = await creerApp(this.db, { clock });

    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    await inserterRelance(this.db, echeanceId, 1, '2026-05-15');
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'un bail activé avec une échéance impayée depuis 71 jours sans aucune relance (clock 2026-07-15)',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // Recrée app avec clock 2026-07-15 (J+71 par rapport à 2026-05-05)
    if (this.app) await this.app.close();
    const clock = ClockFixe.du('2026-07-15');
    this.app = await creerApp(this.db, { clock });

    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'un bail activé avec relances 1 et 2 envoyées et échéance impayée à J+60',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // Recrée app avec clock J+60 (2026-05-05 + 60 = 2026-07-04)
    if (this.app) await this.app.close();
    const clock = ClockFixe.du('2026-07-04');
    this.app = await creerApp(this.db, { clock });

    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    await inserterRelance(this.db, echeanceId, 1, '2026-05-15');
    await inserterRelance(this.db, echeanceId, 2, '2026-06-05');
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'un bail activé sans aucune relance envoyée',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'un bail activé avec relance niveau 1 envoyée à J+10 (clock encore J+10)',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // clock = J+10 exactement = 2026-05-15
    if (this.app) await this.app.close();
    const clock = ClockFixe.du('2026-05-15');
    this.app = await creerApp(this.db, { clock });

    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    await inserterRelance(this.db, echeanceId, 1, '2026-05-15');
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
  },
);

Given(
  'une Relance niveau 3 enregistrée pour une échéance impayée',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    // clock J+65 pour que niveau 3 soit disponible
    if (this.app) await this.app.close();
    const clock = ClockFixe.du('2026-07-09');
    this.app = await creerApp(this.db, { clock });

    const { bailId, echeanceId } = await creerBailAvecEcheance(this.db);
    await inserterRelance(this.db, echeanceId, 1, '2026-05-15');
    await inserterRelance(this.db, echeanceId, 2, '2026-06-05');
    const relanceId = await inserterRelance(this.db, echeanceId, 3, '2026-07-08');
    this.dernierBailId = bailId;
    this.derniereEcheanceId = echeanceId;
    this.derniereRelanceId = relanceId;
  },
);

// ─── When Steps ───────────────────────────────────────────────────────────────

When(
  /^le bailleur navigue vers GET \/impayes$/,
  async function (this: MondeRelance) {
    assert.ok(this.app, 'App non initialisée');
    const response = await this.app.inject({
      method: 'GET',
      url: '/impayes',
      headers: { cookie: cookieHeader(this.cookies) },
    });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
    extraireCookies(response.headers as Record<string, string | string[] | undefined>, this.cookies);
  },
);

When(
  /^le bailleur soumet POST \/relances avec niveau 1$/,
  async function (this: MondeRelance) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.derniereEcheanceId, 'EcheanceId non défini');

    const response = await this.app.inject({
      method: 'POST',
      url: '/relances',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookieHeader(this.cookies),
      },
      payload: `echeanceId=${this.derniereEcheanceId}&niveau=1`,
    });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
    this.dernierContentType = (response.headers['content-type'] as string) ?? '';
    extraireCookies(response.headers as Record<string, string | string[] | undefined>, this.cookies);
  },
);

When(
  /^le bailleur soumet POST \/relances avec niveau 3$/,
  async function (this: MondeRelance) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.derniereEcheanceId, 'EcheanceId non défini');

    const response = await this.app.inject({
      method: 'POST',
      url: '/relances',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookieHeader(this.cookies),
      },
      payload: `echeanceId=${this.derniereEcheanceId}&niveau=3`,
    });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
    this.dernierBuffer = response.rawPayload;
    this.dernierContentType = (response.headers['content-type'] as string) ?? '';
    extraireCookies(response.headers as Record<string, string | string[] | undefined>, this.cookies);
  },
);

When(
  /^le bailleur navigue vers GET \/relances$/,
  async function (this: MondeRelance) {
    assert.ok(this.app, 'App non initialisée');
    const response = await this.app.inject({
      method: 'GET',
      url: '/relances',
      headers: { cookie: cookieHeader(this.cookies) },
    });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
    extraireCookies(response.headers as Record<string, string | string[] | undefined>, this.cookies);
  },
);

When(
  /^le bailleur navigue vers GET \/relances\/:id\/pdf$/,
  async function (this: MondeRelance) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.derniereRelanceId, 'RelanceId non défini');

    const response = await this.app.inject({
      method: 'GET',
      url: `/relances/${this.derniereRelanceId}/pdf`,
      headers: { cookie: cookieHeader(this.cookies) },
    });
    this.dernierStatut = response.statusCode;
    this.dernierBuffer = response.rawPayload;
    this.dernierContentType = (response.headers['content-type'] as string) ?? '';
    extraireCookies(response.headers as Record<string, string | string[] | undefined>, this.cookies);
  },
);

// ─── Then Steps ───────────────────────────────────────────────────────────────

Then(
  'la page impayés affiche le bouton {string}',
  function (this: MondeRelance, labelBouton: string) {
    assert.ok(
      this.dernierCorps.includes(labelBouton),
      `Page impayés doit afficher le bouton "${labelBouton}". Corps reçu:\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);

Then(
  "la page impayés n'affiche pas le bouton niveau 3",
  function (this: MondeRelance) {
    assert.ok(
      !this.dernierCorps.includes('Télécharger la mise en demeure PDF'),
      'Page impayés ne doit pas afficher le bouton niveau 3 (chaînage strict)',
    );
  },
);

Then(
  "la page impayés n'affiche pas le bouton relance niveau 1",
  function (this: MondeRelance) {
    assert.ok(
      !this.dernierCorps.includes('Lancer la relance amiable'),
      'Page impayés ne doit pas afficher le bouton niveau 1 (relance 1 déjà envoyée)',
    );
  },
);

Then(
  'la relance niveau 1 est enregistrée en base',
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.derniereEcheanceId, 'EcheanceId non défini');

    const relances = await (this.db as any)
      .selectFrom('relance')
      .selectAll()
      .where('echeance_id', '=', this.derniereEcheanceId)
      .where('niveau', '=', 1)
      .where('annule_le', 'is', null)
      .execute();

    assert.ok(relances.length >= 1, 'Aucune relance niveau 1 trouvée en base');
  },
);

Then(
  'la réponse indique un succès ou affiche un mailto',
  function (this: MondeRelance) {
    // Soit redirect 302 (succès) soit 200 avec mailtoUri, soit réponse PDF
    const estSucces = this.dernierStatut === 302 || this.dernierStatut === 200;
    assert.ok(estSucces, `Statut attendu 200 ou 302, reçu ${this.dernierStatut}`);
  },
);

Then(
  'la réponse est un PDF avec Content-Type application/pdf',
  function (this: MondeRelance) {
    assert.ok(
      this.dernierContentType.includes('application/pdf'),
      `Content-Type attendu application/pdf, reçu ${this.dernierContentType}`,
    );
    assert.ok(this.dernierBuffer, 'Buffer PDF non défini');
    // Commence par %PDF-
    const header = this.dernierBuffer.slice(0, 5).toString();
    assert.ok(header === '%PDF-', `Buffer ne commence pas par %PDF-, commence par: ${header}`);
  },
);

Then(
  'le PDF contient {string}',
  function (this: MondeRelance, mention: string) {
    assert.ok(this.dernierBuffer, 'Buffer PDF non défini');
    const contenu = this.dernierBuffer.toString('latin1');
    assert.ok(
      contenu.includes(mention),
      `PDF doit contenir "${mention}"`,
    );
  },
);

Then(
  'la page relances affiche {string}',
  function (this: MondeRelance, texte: string) {
    assert.ok(
      this.dernierCorps.includes(texte),
      `Page relances doit afficher "${texte}". Corps reçu:\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);

Then(
  "aucune nouvelle relance n'est créée en base",
  async function (this: MondeRelance) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.derniereEcheanceId, 'EcheanceId non défini');

    const relances = await (this.db as any)
      .selectFrom('relance')
      .selectAll()
      .where('echeance_id', '=', this.derniereEcheanceId)
      .execute();

    // Il y a exactement 3 relances (1, 2, 3) — pas plus
    assert.equal(relances.length, 3, `Attendu 3 relances, trouvé ${relances.length}`);
  },
);

Then(
  'la page relances affiche "Lancer la relance ferme"',
  function (this: MondeRelance) {
    assert.ok(
      this.dernierCorps.includes('Lancer la relance ferme'),
      `Page impayés doit afficher "Lancer la relance ferme". Corps:\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);
