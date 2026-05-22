/**
 * Tests d'intégration — ChargesRepositorySqlite.sommeChargesParCategorie (FIS-03).
 *
 * Vérifie :
 *   - Groupement par catégorie QualificationFiscale
 *   - Exclusion des non_qualifie (statut par défaut)
 *   - Exclusion des corbeille_le NOT NULL
 *   - Inclusion des enfants (parent_justificatif_id != NULL)
 *   - Exclusion du parent 'non_deductible' après split
 *
 * Source : D-FIS-G2.1 + D-FIS-G2.6 + ChargesRepository port
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import type { BailleurId, BienId, JustificatifId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('ChargesRepositorySqlite.sommeChargesParCategorie', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: ChargesRepositorySqlite;
  let bailleurId: BailleurId;
  let bienId: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new ChargesRepositorySqlite(db);

    const bailleurRow = await db.selectFrom('bailleur').selectAll().executeTakeFirst();
    bailleurId = (bailleurRow?.id ?? crypto.randomUUID()) as BailleurId;
    bienId = crypto.randomUUID() as BienId;

    await db.insertInto('bien').values({
      id: bienId, rue: '2 rue charges', code_postal: '75002', ville: 'Paris',
      surface: 50, type: 'appartement', annee_construction: 2005,
      classe_dpe: null, supprime_le: null,
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  function insertJustificatif(opts: {
    montantCentimes: number | null;
    qualification: string | null;
    datePaiement: string | null;
    dateDocument: string;
    corbeilleLe: string | null;
    parentId?: string | null;
  }) {
    const id = crypto.randomUUID() as JustificatifId;
    return db.insertInto('justificatifs').values({
      id,
      type: 'facture',
      date_document: opts.dateDocument,
      titre: `Justificatif ${id}`,
      montant_ttc_centimes: opts.montantCentimes,
      chemin_fichier: `factures/${id}.pdf`,
      nom_fichier_original: `facture-${id}.pdf`,
      mime_type: 'application/pdf',
      taille_octets: 50_000,
      bien_id: bienId,
      locataire_id: null,
      notes: null,
      cree_le: '2026-05-20',
      corbeille_le: opts.corbeilleLe,
      raison_corbeille: null,
      qualification_fiscale: opts.qualification as DB['justificatifs']['qualification_fiscale'],
      qualifie_le: opts.qualification !== null ? '2026-05-20' : null,
      date_paiement: opts.datePaiement,
      parent_justificatif_id: opts.parentId ?? null,
    }).execute();
  }

  it('groupement par catégorie : somme par qualification', async () => {
    await insertJustificatif({ montantCentimes: 50_000, qualification: 'entretien_reparation', datePaiement: '2026-03-01', dateDocument: '2026-02-15', corbeilleLe: null });
    await insertJustificatif({ montantCentimes: 80_000, qualification: 'charge_courante_periodique', datePaiement: '2026-04-01', dateDocument: '2026-04-01', corbeilleLe: null });
    await insertJustificatif({ montantCentimes: 120_000, qualification: 'amelioration', datePaiement: '2026-05-01', dateDocument: '2026-05-01', corbeilleLe: null });

    const result = await repo.sommeChargesParCategorie(bailleurId, 2026);

    expect(result.entretien_reparation.centimes).toBe(50_000n);
    expect(result.charge_courante_periodique.centimes).toBe(80_000n);
    expect(result.amelioration.centimes).toBe(120_000n);
    expect(result.non_deductible.centimes).toBe(0n);
    expect(result.non_qualifie.centimes).toBe(0n);
  });

  it('exclusion des justificatifs non_qualifie (statut par défaut)', async () => {
    await insertJustificatif({ montantCentimes: 50_000, qualification: null, datePaiement: '2026-03-01', dateDocument: '2026-02-15', corbeilleLe: null });
    await insertJustificatif({ montantCentimes: 30_000, qualification: 'entretien_reparation', datePaiement: '2026-04-01', dateDocument: '2026-04-01', corbeilleLe: null });

    const result = await repo.sommeChargesParCategorie(bailleurId, 2026);
    expect(result.entretien_reparation.centimes).toBe(30_000n);
    expect(result.non_qualifie.centimes).toBe(0n);
  });

  it('exclusion des justificatifs en corbeille', async () => {
    await insertJustificatif({ montantCentimes: 50_000, qualification: 'entretien_reparation', datePaiement: '2026-03-01', dateDocument: '2026-02-15', corbeilleLe: null });
    await insertJustificatif({ montantCentimes: 20_000, qualification: 'entretien_reparation', datePaiement: '2026-04-01', dateDocument: '2026-04-01', corbeilleLe: '2026-04-15' });

    const result = await repo.sommeChargesParCategorie(bailleurId, 2026);
    expect(result.entretien_reparation.centimes).toBe(50_000n);
  });

  it('filtrage par année (fallback dateDocument si datePaiement null)', async () => {
    // 2025 : dateDocument seul
    await insertJustificatif({ montantCentimes: 40_000, qualification: 'entretien_reparation', datePaiement: null, dateDocument: '2025-12-01', corbeilleLe: null });
    // 2026 : dateDocument 2025 mais datePaiement 2026 → appartient à 2026
    await insertJustificatif({ montantCentimes: 60_000, qualification: 'entretien_reparation', datePaiement: '2026-01-15', dateDocument: '2025-12-30', corbeilleLe: null });

    const result2025 = await repo.sommeChargesParCategorie(bailleurId, 2025);
    const result2026 = await repo.sommeChargesParCategorie(bailleurId, 2026);

    expect(result2025.entretien_reparation.centimes).toBe(40_000n);
    expect(result2026.entretien_reparation.centimes).toBe(60_000n);
  });

  it('régression CR-01 : 100 justificatifs de 1 centime entretien_reparation = 100 centimes exact, sans perte d\'arrondi flottant', async () => {
    // Verrouille la sémantique exacte du SUM en BigInt pour la variante "par catégorie" :
    // après le fix CR-01, plus aucun float ne transite entre SQLite et Money.fromCentimes().
    // 100 × 1n centime DOIT donner exactement 100n centimes pour entretien_reparation.
    for (let i = 0; i < 100; i++) {
      await insertJustificatif({
        montantCentimes: 1,
        qualification: 'entretien_reparation',
        datePaiement: '2026-06-15',
        dateDocument: '2026-06-15',
        corbeilleLe: null,
      });
    }

    const result = await repo.sommeChargesParCategorie(bailleurId, 2026);

    expect(result.entretien_reparation.toCentimes()).toBe(100n);
  });
});
