import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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

// Helper : créer un bail + locataire + bien + 1 échéance impayée
async function creerBailAvecEcheanceImpayee(
  db: Kysely<DB>,
  opts: { jourEcheanceAttendue?: string } = {},
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
    email: `marie.martin.${locataireId.substring(0, 8)}@example.fr`,
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

  const jourEcheanceAttendue = opts.jourEcheanceAttendue ?? '2026-04-10';
  await db.insertInto('echeance_loyer').values({
    id: echeanceId,
    bail_id: bailId,
    periode_debut: '2026-04-01',
    periode_fin: '2026-04-30',
    jour_echeance_attendue: jourEcheanceAttendue,
    loyer_hc: 70000,
    montant_charges: 0,
    mode_charges: 'forfait',
    total: 70000,
    statut: 'en_attente',
    annule_le: null,
  }).execute();

  // Profil bailleur requis par enregistrerRelance niveau 3
  const bailleurExist = await db.selectFrom('bailleur').selectAll().limit(1).executeTakeFirst();
  if (!bailleurExist) {
    await db.insertInto('bailleur').values({
      id: crypto.randomUUID(),
      singleton_marker: 'unique',
      nom_complet: 'Jean Dupont',
      rue: '1 rue de la Paix',
      code_postal: '75001',
      ville: 'Paris',
    }).execute();
  }

  return { bailId, echeanceId };
}

// Helper : insérer une relance directement en DB
async function inserterRelance(
  db: Kysely<DB>,
  echeanceId: EcheanceLoyerId,
  niveau: 1 | 2 | 3,
  envoyeeLe: string,
): Promise<void> {
  const id = crypto.randomUUID();
  await (db as any).insertInto('relance').values({
    id,
    echeance_id: echeanceId,
    niveau,
    canal: niveau === 3 ? 'pdf' : 'email',
    envoyee_le: envoyeeLe,
    contenu_snapshot: JSON.stringify({ version: 'v1', variables: {}, contenuRendu: 'Test', mailtoUri: niveau < 3 ? 'mailto:test@example.fr?subject=Test' : null }),
    annule_le: null,
  } as any).execute();
}

describe('POST /relances (gap G8 — mailto auto-trigger + régression PDF niveau 3)', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let echeanceId: EcheanceLoyerId;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-G8-integration-32chars!!';
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    // Clock fixe au 2026-05-15 ; échéance au 2026-04-10 → 35 jours de retard
    const clock = ClockFixe.du('2026-05-15');
    app = await creerApp(db, { clock });

    const created = await creerBailAvecEcheanceImpayee(db, {
      jourEcheanceAttendue: '2026-04-10',
    });
    echeanceId = created.echeanceId;
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
  });

  it('T1 — canal email (niveau 1) retourne HTML 200 avec mailto + script auto-trigger + lien retour', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/relances',
      payload: `echeanceId=${echeanceId}&niveau=1`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/html/);
    // Fallback link avec href mailto:
    expect(res.body).toMatch(/<a [^>]*href="mailto:[^"]+"/);
    // Auto-trigger script
    expect(res.body).toContain('window.location.href');
    // Lien retour
    expect(res.body).toContain('/impayes');
  });

  it('T2 (régression R1) — canal pdf (niveau 3) reste application/pdf inchangé après le fix G8', async () => {
    // Setup : clock au 2026-06-10 (J+61 depuis échéance 2026-04-10), niveau 3 disponible
    // après relances 1 et 2 déjà envoyées
    await app.close();
    const clockNiveau3 = ClockFixe.du('2026-06-10');
    const appNiveau3 = await creerApp(db, { clock: clockNiveau3 });

    try {
      await inserterRelance(db, echeanceId, 1, '2026-04-25');
      await inserterRelance(db, echeanceId, 2, '2026-05-10');

      const res = await appNiveau3.inject({
        method: 'POST',
        url: '/relances',
        payload: `echeanceId=${echeanceId}&niveau=3`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      // Signature PDF valide en début de buffer
      const buf = res.rawPayload;
      expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    } finally {
      await appNiveau3.close();
    }
  });
});
