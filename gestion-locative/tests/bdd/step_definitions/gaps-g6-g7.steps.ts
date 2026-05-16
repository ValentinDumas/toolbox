import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface MondeGaps extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  dernierCorps: string;
  bailIds: Record<string, BailId>;
  [key: string]: unknown;
}

// ─── Before/After ─────────────────────────────────────────────────────────────

Before({ tags: '@gap-G6 or @gap-G7' }, async function (this: MondeGaps) {
  process.env['SESSION_SECRET'] = 'test-secret-gaps-g6-g7-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  const clock = ClockFixe.du('2026-05-15');
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.dernierCorps = '';
  this.bailIds = {};
});

After({ tags: '@gap-G6 or @gap-G7' }, async function (this: MondeGaps) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function creerBailAvecN(
  db: Kysely<DB>,
  label: string,
  nEcheances: number,
  statut: 'en_attente' | 'payee',
  email: string,
): Promise<BailId> {
  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();
  const bailId = crypto.randomUUID() as BailId;

  await db.insertInto('bien').values({
    id: bienId,
    rue: `10 rue ${label}`,
    code_postal: '75010',
    ville: 'Paris',
    surface: 45,
    type: 'appartement',
    annee_construction: 1990,
  }).execute();

  await db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: `Appartement ${label}`,
    type: 'appartement',
    surface: 45,
    etage: null,
  }).execute();

  await db.insertInto('locataire').values({
    id: locataireId,
    nom: label,
    prenom: 'Test',
    date_naissance: '1985-06-15',
    commune_naissance: 'Paris',
    pays_naissance: 'France',
    nationalite: 'française',
    email,
    telephone: null,
    rue: '1 rue Test',
    code_postal: '75001',
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

  // Créer N échéances pour ce bail
  for (let i = 0; i < nEcheances; i++) {
    const echeanceId = crypto.randomUUID() as EcheanceLoyerId;
    const mois = String(i + 1).padStart(2, '0');
    await db.insertInto('echeance_loyer').values({
      id: echeanceId,
      bail_id: bailId,
      periode_debut: `2026-${mois}-01`,
      periode_fin: `2026-${mois}-28`,
      jour_echeance_attendue: `2026-${mois}-05`,
      loyer_hc: 70000,
      montant_charges: 0,
      mode_charges: 'forfait',
      total: 70000,
      statut,
      annule_le: null,
    }).execute();
  }

  return bailId;
}

async function creerBailleur(db: Kysely<DB>): Promise<void> {
  const exist = await db.selectFrom('bailleur').selectAll().limit(1).executeTakeFirst();
  if (!exist) {
    await db.insertInto('bailleur').values({
      id: crypto.randomUUID(),
      singleton_marker: 'unique',
      nom_complet: 'Test Bailleur',
      rue: '1 rue Test',
      code_postal: '75001',
      ville: 'Paris',
    }).execute();
  }
}

// ─── Given Steps ──────────────────────────────────────────────────────────────

Given(
  /^un bail activé "([^"]+)" avec (\d+) échéances en_attente$/,
  async function (this: MondeGaps, label: string, nStr: string) {
    assert.ok(this.db, 'DB non initialisée');
    const n = parseInt(nStr, 10);
    const email = `locataire-${label.toLowerCase().replace(/\s+/g, '-')}@example.fr`;
    const bailId = await creerBailAvecN(this.db, label, n, 'en_attente', email);
    this.bailIds[label] = bailId;
  },
);

Given(
  /^un bail activé "([^"]+)" avec (\d+) échéances payee$/,
  async function (this: MondeGaps, label: string, nStr: string) {
    assert.ok(this.db, 'DB non initialisée');
    const n = parseInt(nStr, 10);
    const email = `locataire-${label.toLowerCase().replace(/\s+/g, '-')}-payee@example.fr`;
    const bailId = await creerBailAvecN(this.db, label, n, 'payee', email);
    this.bailIds[label] = bailId;
  },
);

Given(
  'aucune quittance émise en base',
  async function (this: MondeGaps) {
    // DB vierge par défaut — pas d'action nécessaire
  },
);

Given(
  'une quittance émise en base',
  async function (this: MondeGaps) {
    assert.ok(this.db, 'DB non initialisée');
    await creerBailleur(this.db);

    // Créer le minimum pour avoir une quittance en base
    const bailId = await creerBailAvecN(this.db, 'QBail', 1, 'payee', 'quittance@example.fr');
    const echeanceRow = await this.db
      .selectFrom('echeance_loyer')
      .select('id')
      .where('bail_id', '=', bailId)
      .executeTakeFirstOrThrow();

    await this.db.insertInto('quittance').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceRow.id,
      numero: '2026-001',
      chemin_fichier_relatif: 'quittances/Q-2026-001.pdf',
      emise_le: '2026-05-15',
      annulee_le: null,
      raison_annulation: null,
    }).execute();
  },
);

// ─── When Steps ───────────────────────────────────────────────────────────────

When(
  /^le bailleur navigue vers GET (\/echeances[^\s]*)$/,
  async function (this: MondeGaps, rawUrl: string) {
    assert.ok(this.app, 'App non initialisée');

    // Remplacer les placeholders B1/B2 par leurs vrais IDs
    let url = rawUrl.trim();
    for (const [label, id] of Object.entries(this.bailIds)) {
      url = url.replace(`bail=${label}`, `bail=${id}`);
    }

    const response = await this.app.inject({ method: 'GET', url });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
  },
);

When(
  /^le bailleur navigue vers GET (\/quittances)$/,
  async function (this: MondeGaps, url: string) {
    assert.ok(this.app, 'App non initialisée');
    const response = await this.app.inject({ method: 'GET', url });
    this.dernierStatut = response.statusCode;
    this.dernierCorps = response.body;
  },
);

// ─── Then Steps ───────────────────────────────────────────────────────────────

Then(
  /^la page affiche (\d+) lignes d'échéances$/,
  function (this: MondeGaps, nStr: string) {
    const attendu = parseInt(nStr, 10);
    const tbodyMatch = this.dernierCorps.match(/<tbody>([\s\S]*?)<\/tbody>/);
    const tbody = (tbodyMatch ? tbodyMatch[1] : '') ?? '';
    const trCount = (tbody.match(/<tr\b/g) ?? []).length;
    assert.strictEqual(
      trCount,
      attendu,
      `Attendu ${attendu} lignes dans tbody, trouvé ${trCount}.\nCorps (500 premiers chars):\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);

Then(
  /^la page affiche un select "Bail" avec (\d+) options de baux$/,
  function (this: MondeGaps, nStr: string) {
    const attendu = parseInt(nStr, 10);
    const selectMatch = this.dernierCorps.match(/<select[^>]*name="bail"[^>]*>([\s\S]*?)<\/select>/);
    const selectContent = (selectMatch ? selectMatch[1] : '') ?? '';
    // Compter les options avec value non vide (exclut l'option vide "— Tous les baux —")
    const optionCount = (selectContent.match(/<option value="[^"]+"/g) ?? []).length;
    assert.strictEqual(
      optionCount,
      attendu,
      `Attendu ${attendu} options bail (non vides), trouvé ${optionCount}`,
    );
  },
);

Then(
  /^la page affiche un select "Statut" avec (\d+) options de statuts$/,
  function (this: MondeGaps, nStr: string) {
    const attendu = parseInt(nStr, 10);
    const selectMatch = this.dernierCorps.match(/<select[^>]*name="statut"[^>]*>([\s\S]*?)<\/select>/);
    const selectContent = (selectMatch ? selectMatch[1] : '') ?? '';
    // Compter les options avec value non vide (exclut l'option vide "— Tous les statuts —")
    const optionCount = (selectContent.match(/<option value="[^"]+"/g) ?? []).length;
    assert.strictEqual(
      optionCount,
      attendu,
      `Attendu ${attendu} options statut (non vides), trouvé ${optionCount}`,
    );
  },
);

Then(
  /^la page contient un lien "([^"]+)"$/,
  function (this: MondeGaps, texte: string) {
    assert.ok(
      this.dernierCorps.includes(texte),
      `La page doit contenir le texte "${texte}".\nCorps (500 chars):\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);

Then(
  /^ce lien pointe vers "([^"]+)"$/,
  function (this: MondeGaps, href: string) {
    // Escape special chars pour regex
    const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`href="[^"]*${escaped}[^"]*"`).test(this.dernierCorps);
    assert.ok(
      found,
      `La page doit contenir un lien href contenant "${href}".\nCorps (500 chars):\n${this.dernierCorps.substring(0, 500)}`,
    );
  },
);
