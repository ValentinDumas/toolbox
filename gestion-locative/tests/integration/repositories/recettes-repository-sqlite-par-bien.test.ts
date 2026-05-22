/**
 * Tests d'intégration — RecettesRepositorySqlite.sommeRecettesAnnuellesParBien (D-FIS-G5.1).
 *
 * RED phase : tests écrits avant l'implémentation de la méthode sommeRecettesAnnuellesParBien.
 *
 * Setup : in-memory SQLite + appliquerToutesMigrations + 2 biens (B1, B2) + lots + baux.
 * La méthode JOIN : encaissement → echeance_loyer → bail → lot WHERE lot.bien_id = ?.
 *
 * Sources :
 *   - D-FIS-G5.1 : ventilation par bien via JOIN bail → lot → bien
 *   - D-FIS-G2.11 : rattachement par date de l'encaissement
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import type { BienId, LotId, BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('RecettesRepositorySqlite.sommeRecettesAnnuellesParBien (D-FIS-G5.1)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: RecettesRepositorySqlite;

  let bienId1: BienId;
  let bienId2: BienId;
  let lotId1: LotId;
  let lotId2: LotId;
  let bailId1: BailId;
  let bailId2: BailId;
  let echeanceId1: EcheanceLoyerId;
  let echeanceId2: EcheanceLoyerId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new RecettesRepositorySqlite(db);

    // Setup : 2 biens
    bienId1 = crypto.randomUUID() as BienId;
    bienId2 = crypto.randomUUID() as BienId;
    for (const [bienId, adresse] of [[bienId1, '1 rue paris'], [bienId2, '2 rue lyon']] as const) {
      await db.insertInto('bien').values({
        id: bienId, rue: adresse, code_postal: '75001', ville: 'Paris',
        surface: 40, type: 'appartement', annee_construction: 2000,
        classe_dpe: null, supprime_le: null,
      }).execute();
    }

    // 1 lot par bien
    lotId1 = crypto.randomUUID() as LotId;
    lotId2 = crypto.randomUUID() as LotId;
    await db.insertInto('lot').values({ id: lotId1, bien_id: bienId1, designation: 'T2', surface: 40, type: 'appartement', etage: 1, supprime_le: null }).execute();
    await db.insertInto('lot').values({ id: lotId2, bien_id: bienId2, designation: 'T3', surface: 60, type: 'appartement', etage: 2, supprime_le: null }).execute();

    // Locataire partagé pour les deux baux
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId, nom: 'Locataire', prenom: 'Test',
      date_naissance: '1990-01-01', commune_naissance: 'Paris', pays_naissance: 'France',
      nationalite: 'Française', email: 'test@test.fr', telephone: null,
      rue: '1 rue loc', code_postal: '75001', ville: 'Paris', supprime_le: null,
    }).execute();

    // 1 bail par lot
    bailId1 = crypto.randomUUID() as BailId;
    bailId2 = crypto.randomUUID() as BailId;
    await db.insertInto('bail').values({
      id: bailId1, locataire_id: locataireId, bien_id: bienId1,
      type: 'meuble', date_debut: '2026-01-01', duree_mois: 12,
      loyer_hc: 70000, mode_charges: 'forfait', montant_charges: 8000,
      depot_garantie: 140000, irl_trimestre: '2025-T4', irl_valeur: '142.06',
      cautionnement: null, actif_depuis: '2026-01-01', jour_echeance: 5,
      mobilier: null, supprime_le: null,
    }).execute();
    await db.insertInto('bail').values({
      id: bailId2, locataire_id: locataireId, bien_id: bienId2,
      type: 'meuble', date_debut: '2026-01-01', duree_mois: 12,
      loyer_hc: 80000, mode_charges: 'forfait', montant_charges: 9000,
      depot_garantie: 160000, irl_trimestre: '2025-T4', irl_valeur: '142.06',
      cautionnement: null, actif_depuis: '2026-01-01', jour_echeance: 5,
      mobilier: null, supprime_le: null,
    }).execute();

    // 1 échéance par bail
    echeanceId1 = crypto.randomUUID() as EcheanceLoyerId;
    echeanceId2 = crypto.randomUUID() as EcheanceLoyerId;
    await db.insertInto('echeance_loyer').values({
      id: echeanceId1, bail_id: bailId1,
      periode_debut: '2026-01-01', periode_fin: '2026-01-31',
      jour_echeance_attendue: '2026-01-05',
      loyer_hc: 70000, montant_charges: 8000, mode_charges: 'forfait',
      total: 78000, statut: 'payee', annule_le: null,
    }).execute();
    await db.insertInto('echeance_loyer').values({
      id: echeanceId2, bail_id: bailId2,
      periode_debut: '2026-01-01', periode_fin: '2026-01-31',
      jour_echeance_attendue: '2026-01-05',
      loyer_hc: 80000, montant_charges: 9000, mode_charges: 'forfait',
      total: 89000, statut: 'payee', annule_le: null,
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  function insertEncaissement(echeanceId: EcheanceLoyerId, date: string, montant: number, annuleLe: string | null = null) {
    return db.insertInto('encaissement').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId,
      montant_centimes: montant,
      date,
      mode: 'virement',
      annule_le: annuleLe,
      raison_annulation: null,
    }).execute();
  }

  it('Test 1 : sommeRecettesAnnuellesParBien(B1, 2026) retourne uniquement les encaissements de B1', async () => {
    await insertEncaissement(echeanceId1, '2026-01-05', 78_000); // B1 : 780 €
    await insertEncaissement(echeanceId2, '2026-01-05', 89_000); // B2 : 890 €

    const sommeB1 = await repo.sommeRecettesAnnuellesParBien(bienId1, 2026);
    const sommeB2 = await repo.sommeRecettesAnnuellesParBien(bienId2, 2026);

    expect(sommeB1.centimes).toBe(78_000n);
    expect(sommeB2.centimes).toBe(89_000n);
  });

  it('Test 2 : exclusion encaissements annulés (annule_le NOT NULL)', async () => {
    await insertEncaissement(echeanceId1, '2026-01-05', 78_000);
    await insertEncaissement(echeanceId1, '2026-01-06', 10_000, '2026-01-07'); // annulé

    const somme = await repo.sommeRecettesAnnuellesParBien(bienId1, 2026);

    expect(somme.centimes).toBe(78_000n); // seulement le premier
  });

  it('Test 3 : filtre année correct (substr(e.date, 1, 4))', async () => {
    await insertEncaissement(echeanceId1, '2025-12-05', 50_000); // 2025
    await insertEncaissement(echeanceId1, '2026-01-05', 78_000); // 2026

    const somme2025 = await repo.sommeRecettesAnnuellesParBien(bienId1, 2025);
    const somme2026 = await repo.sommeRecettesAnnuellesParBien(bienId1, 2026);

    expect(somme2025.centimes).toBe(50_000n);
    expect(somme2026.centimes).toBe(78_000n);
  });

  it('régression CR-01 : 100 encaissements de 1 centime sur un bien = 100 centimes exact, sans perte d\'arrondi flottant', async () => {
    // Verrouille la sémantique exacte du SUM en BigInt pour la variante par bien :
    // après le fix CR-01, plus aucun float ne transite entre SQLite et Money.fromCentimes().
    // 100 × 1n centime DOIT donner exactement 100n centimes.
    for (let i = 0; i < 100; i++) {
      await insertEncaissement(echeanceId1, '2026-06-15', 1); // 1 centime = 0.01 €
    }

    const somme = await repo.sommeRecettesAnnuellesParBien(bienId1, 2026);

    expect(somme.toCentimes()).toBe(100n);
  });
});
