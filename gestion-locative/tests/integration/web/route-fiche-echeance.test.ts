/**
 * Tests d'intégration HTTP — Route GET /echeances/:id (fiche échéance).
 *
 * Couvre :
 *   - GET /echeances/:id avec id existant → 200 + période, statut, nom locataire, CTA encaissement.
 *   - GET /echeances/:id avec id inconnu → 404.
 *
 * Pattern miroir : relances-mailto.test.ts (creerBailAvecEcheanceImpayee + app.inject).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

async function creerFixture(db: Kysely<DB>): Promise<{ bailId: BailId; echeanceId: EcheanceLoyerId }> {
  const bienId = crypto.randomUUID();
  const lotId = crypto.randomUUID();
  const locataireId = crypto.randomUUID();
  const bailId = crypto.randomUUID() as BailId;
  const echeanceId = crypto.randomUUID() as EcheanceLoyerId;

  await db.insertInto('bien').values({
    id: bienId,
    rue: '5 rue des Tests',
    code_postal: '75001',
    ville: 'Paris',
    surface: 40,
    type: 'appartement',
    annee_construction: 2000,
  }).execute();

  await db.insertInto('lot').values({
    id: lotId,
    bien_id: bienId,
    designation: 'Appartement T2',
    type: 'appartement',
    surface: 40,
    etage: null,
  }).execute();

  await db.insertInto('locataire').values({
    id: locataireId,
    nom: 'Dupont',
    prenom: 'Alice',
    date_naissance: '1990-03-20',
    commune_naissance: 'Lyon',
    pays_naissance: 'France',
    nationalite: 'française',
    email: `alice.dupont.${locataireId.substring(0, 8)}@example.fr`,
    telephone: '0600000001',
    rue: '5 rue des Tests',
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
    loyer_hc: 80000,
    mode_charges: 'forfait',
    montant_charges: 0,
    depot_garantie: 160000,
    irl_trimestre: '2025-T3',
    irl_valeur: '143.03',
    cautionnement: null,
    actif_depuis: '2026-01-01',
    jour_echeance: 1,
  }).execute();

  await db.insertInto('bail_lots').values({ bail_id: bailId, lot_id: lotId }).execute();

  await db.insertInto('echeance_loyer').values({
    id: echeanceId,
    bail_id: bailId,
    periode_debut: '2026-05-01',
    periode_fin: '2026-05-31',
    jour_echeance_attendue: '2026-05-01',
    loyer_hc: 80000,
    montant_charges: 0,
    mode_charges: 'forfait',
    total: 80000,
    statut: 'en_attente',
    annule_le: null,
  }).execute();

  return { bailId, echeanceId };
}

describe('GET /echeances/:id (fiche échéance)', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let echeanceId: EcheanceLoyerId;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-fiche-echeance-32chars!!';
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    const clock = ClockFixe.du('2026-06-16');
    app = await creerApp(db, { clock });

    const fixture = await creerFixture(db);
    echeanceId = fixture.echeanceId;
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
  });

  it('(a) id existant → 200, période, statut, nom locataire, CTA encaissement', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/echeances/${echeanceId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('2026-05'); // période
    expect(res.body).toContain('en_attente'); // statut ou libellé
    expect(res.body).toContain('Alice'); // nom locataire
    expect(res.body).toContain('Saisir un encaissement'); // CTA
  });

  it('(b) id inconnu → 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/echeances/id-inconnu-qui-nexiste-pas',
    });

    expect(res.statusCode).toBe(404);
  });
});
