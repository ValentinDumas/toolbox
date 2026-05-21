/**
 * Tests d'intégration — ChargesRepositorySqlite.sommeChargesParBien (D-FIS-G5.1).
 *
 * RED phase : tests écrits avant l'implémentation de la méthode sommeChargesParBien.
 *
 * Setup : in-memory SQLite + appliquerToutesMigrations + 2 biens + 4 justificatifs.
 * La méthode filtre par bien_id + catégories déductibles + non corbeille.
 *
 * Sources :
 *   - D-FIS-G5.1 : ventilation charges par bien via justificatif.bien_id
 *   - D-FIS-G2.2 : catégories qualifiées (entretien_reparation, amelioration, charge_courante_periodique)
 *   - Règle : justificatif.bien_id=null → exclu de la ventilation par bien
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import type { BienId, JustificatifId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('ChargesRepositorySqlite.sommeChargesParBien (D-FIS-G5.1)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: ChargesRepositorySqlite;
  let bienId1: BienId;
  let bienId2: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new ChargesRepositorySqlite(db);

    // 2 biens
    bienId1 = crypto.randomUUID() as BienId;
    bienId2 = crypto.randomUUID() as BienId;
    for (const [bienId, adresse] of [[bienId1, '1 rue test'], [bienId2, '2 rue test']] as const) {
      await db.insertInto('bien').values({
        id: bienId, rue: adresse, code_postal: '75001', ville: 'Paris',
        surface: 40, type: 'appartement', annee_construction: 2000,
        classe_dpe: null, supprime_le: null,
      }).execute();
    }
  });

  afterEach(async () => {
    await db.destroy();
  });

  function insertJustificatif(opts: {
    bienId: BienId | null;
    montant: number;
    qualification: string;
    datePaiement?: string | null;
    dateDocument?: string;
    corbeilleLe?: string | null;
  }) {
    const id = crypto.randomUUID() as JustificatifId;
    return db.insertInto('justificatifs').values({
      id,
      type: 'facture',
      date_document: opts.dateDocument ?? '2026-01-15',
      titre: `Justificatif ${id}`,
      montant_ttc_centimes: opts.montant,
      chemin_fichier: `factures/${id}.pdf`,
      nom_fichier_original: `facture-${id}.pdf`,
      mime_type: 'application/pdf',
      taille_octets: 50_000,
      bien_id: opts.bienId,
      locataire_id: null,
      notes: null,
      cree_le: '2026-05-20',
      corbeille_le: opts.corbeilleLe ?? null,
      raison_corbeille: null,
      qualification_fiscale: opts.qualification as DB['justificatifs']['qualification_fiscale'],
      qualifie_le: '2026-05-20',
      date_paiement: opts.datePaiement ?? '2026-01-20',
      parent_justificatif_id: null,
    }).execute();
  }

  it('Test 1 : sommeChargesParBien(B1, 2026) retourne seulement les charges de B1 non en corbeille', async () => {
    // B1 : 1 charge active + 1 en corbeille
    await insertJustificatif({ bienId: bienId1, montant: 50_000, qualification: 'entretien_reparation' });
    await insertJustificatif({ bienId: bienId1, montant: 20_000, qualification: 'entretien_reparation', corbeilleLe: '2026-02-01' });
    // B2 : 1 charge
    await insertJustificatif({ bienId: bienId2, montant: 80_000, qualification: 'amelioration' });

    const sommeB1 = await repo.sommeChargesParBien(bienId1, 2026);
    const sommeB2 = await repo.sommeChargesParBien(bienId2, 2026);

    expect(sommeB1.centimes).toBe(50_000n); // charge en corbeille exclue
    expect(sommeB2.centimes).toBe(80_000n);
  });

  it('Test 2 : exclusion non_qualifie et non_deductible', async () => {
    await insertJustificatif({ bienId: bienId1, montant: 50_000, qualification: 'entretien_reparation' });
    await insertJustificatif({ bienId: bienId1, montant: 30_000, qualification: 'non_qualifie' });
    await insertJustificatif({ bienId: bienId1, montant: 20_000, qualification: 'non_deductible' });

    const somme = await repo.sommeChargesParBien(bienId1, 2026);

    // Seulement entretien_reparation (déductible)
    expect(somme.centimes).toBe(50_000n);
  });

  it('Test 3 : justificatif bien_id=B2 EXCLU de la ventilation pour B1', async () => {
    // Charge appartenant à B2 (pas à B1)
    await insertJustificatif({ bienId: bienId2, montant: 100_000, qualification: 'charge_courante_periodique' });
    // Charge de B1
    await insertJustificatif({ bienId: bienId1, montant: 40_000, qualification: 'entretien_reparation' });

    const sommeB1 = await repo.sommeChargesParBien(bienId1, 2026);

    // La charge de B2 est exclue de la ventilation pour B1
    expect(sommeB1.centimes).toBe(40_000n);
  });
});
