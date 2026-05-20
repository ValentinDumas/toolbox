/**
 * Tests d'intégration — RecettesRepositorySqlite.sommeRecettesAnnuelles (FIS-02/03).
 *
 * Setup : in-memory SQLite + appliquerToutesMigrations.
 * Vérifie :
 *   - Somme isolée par année (encaissements 2025 ≠ encaissements 2026)
 *   - Compensateurs négatifs inclus dans la somme (D-60)
 *   - Encaissements annulés exclus (annule_le NOT NULL)
 *
 * Source : D-LOCK-2 (single-bailleur V1) + RecettesRepository port (D-FIS-G2.11)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import type { BailleurId, BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('RecettesRepositorySqlite.sommeRecettesAnnuelles', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: RecettesRepositorySqlite;
  let bailleurId: BailleurId;
  let bailId: BailId;
  let echeanceId2025: EcheanceLoyerId;
  let echeanceId2026: EcheanceLoyerId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new RecettesRepositorySqlite(db);

    // Setup : bailleur singleton
    const bailleurRow = await db.selectFrom('bailleur').selectAll().executeTakeFirst();
    bailleurId = (bailleurRow?.id ?? crypto.randomUUID()) as BailleurId;

    // Setup : bien + bail
    const lot = unLotValide({ designation: 'T2 recettes' });
    const bien = unBienValide({ lots: [lot] });
    await db.insertInto('bien').values({
      id: bien.id, rue: '1 rue test', code_postal: '75001', ville: 'Paris',
      surface: 40, type: 'appartement', annee_construction: 2000,
      classe_dpe: null, supprime_le: null,
    }).execute();
    await db.insertInto('lot').values({
      id: lot.id, bien_id: bien.id, designation: 'T2 recettes',
      surface: 40, type: 'appartement', etage: 1, supprime_le: null,
    }).execute();
    const locataire = unLocataireValide();
    await db.insertInto('locataire').values({
      id: locataire.id, nom: locataire.nom, prenom: locataire.prenom,
      date_naissance: '1990-01-01', commune_naissance: 'Paris', pays_naissance: 'France',
      nationalite: 'Française', email: locataire.email, telephone: null,
      rue: '1 rue loc', code_postal: '75001', ville: 'Paris', supprime_le: null,
    }).execute();
    const bail = unBailValide({ bienId: bien.id, locataireId: locataire.id, lotIds: [lot.id] });
    await db.insertInto('bail').values({
      id: bail.id, locataire_id: bail.locataireId, bien_id: bail.bienId,
      type: 'meuble', date_debut: '2025-01-01', duree_mois: 12,
      loyer_hc: 70000, mode_charges: 'forfait', montant_charges: 8000,
      depot_garantie: 140000, irl_trimestre: '2024-T4', irl_valeur: '142.06',
      cautionnement: null, actif_depuis: '2025-01-01', jour_echeance: 5,
      mobilier: null, supprime_le: null,
    }).execute();
    bailId = bail.id;

    // Créer 2 échéances (2025 et 2026)
    echeanceId2025 = crypto.randomUUID() as EcheanceLoyerId;
    echeanceId2026 = crypto.randomUUID() as EcheanceLoyerId;

    await db.insertInto('echeance_loyer').values({
      id: echeanceId2025, bail_id: bailId,
      periode_debut: '2025-06-01', periode_fin: '2025-06-30',
      jour_echeance_attendue: '2025-06-05',
      loyer_hc: 70000, montant_charges: 8000, mode_charges: 'forfait',
      total: 78000, statut: 'payee', annule_le: null,
    }).execute();

    await db.insertInto('echeance_loyer').values({
      id: echeanceId2026, bail_id: bailId,
      periode_debut: '2026-01-01', periode_fin: '2026-01-31',
      jour_echeance_attendue: '2026-01-05',
      loyer_hc: 70000, montant_charges: 8000, mode_charges: 'forfait',
      total: 78000, statut: 'payee', annule_le: null,
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  function insertEncaissement(echeanceId: EcheanceLoyerId, date: string, montantCentimes: number, annuleLe: string | null = null) {
    return db.insertInto('encaissement').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId,
      montant_centimes: montantCentimes,
      date,
      mode: 'virement',
      annule_le: annuleLe,
      raison_annulation: null,
    }).execute();
  }

  it('somme isolée par année : 2025 ≠ 2026', async () => {
    await insertEncaissement(echeanceId2025, '2025-06-05', 78_000); // 780 €
    await insertEncaissement(echeanceId2026, '2026-01-05', 78_000); // 780 €

    const somme2025 = await repo.sommeRecettesAnnuelles(bailleurId, 2025);
    const somme2026 = await repo.sommeRecettesAnnuelles(bailleurId, 2026);

    expect(somme2025.centimes).toBe(78_000n);
    expect(somme2026.centimes).toBe(78_000n);
  });

  it('compensateurs négatifs inclus dans la somme (D-60)', async () => {
    // 780 € paiement + (-100 €) compensateur = 680 €
    await insertEncaissement(echeanceId2026, '2026-01-05', 78_000);
    await insertEncaissement(echeanceId2026, '2026-01-10', -10_000); // compensateur -100 €

    const somme = await repo.sommeRecettesAnnuelles(bailleurId, 2026);
    expect(somme.centimes).toBe(68_000n); // 780 - 100 = 680 €
  });

  it('encaissements annulés exclus de la somme', async () => {
    await insertEncaissement(echeanceId2026, '2026-01-05', 78_000);
    await insertEncaissement(echeanceId2026, '2026-01-06', 10_000, '2026-01-07'); // annulé

    const somme = await repo.sommeRecettesAnnuelles(bailleurId, 2026);
    expect(somme.centimes).toBe(78_000n); // seulement le premier
  });

  it('retourne Money.zero() si aucun encaissement pour l\'année', async () => {
    const somme = await repo.sommeRecettesAnnuelles(bailleurId, 2025);
    expect(somme.centimes).toBe(0n);
  });
});
