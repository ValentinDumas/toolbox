/**
 * Tests d'intégration — Use case exporterPdfRecap (D-FIS-G5.3).
 *
 * RED phase : tests écrits avant l'implémentation.
 *
 * Vérifie :
 *   - Buffer non vide
 *   - Magic bytes %PDF- (début du buffer)
 *   - buffer.length > 1000 (PDF a du contenu)
 *   - nomFichier correct
 *
 * Setup : in-memory SQLite + bailleur + 1 bien + 1 DeclarationAnnuelle + PdfRenderer réel (pdfmake).
 *
 * Source : D-FIS-G5.3 (export PDF récap bailleur — pdfmake déjà en dépendance Phases 2+3)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { exporterPdfRecap } from '../../../src/application/fiscalite/exporter-pdf-recap.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import type { BailleurId, BienId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const EXERCICE = 2026;

describe('exporterPdfRecap — intégration in-memory (D-FIS-G5.3)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId: BienId;
  let declId: DeclarationAnnuelleId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    // Bailleur singleton
    const bailleurRow = await db.selectFrom('bailleur').selectAll().executeTakeFirst();
    bailleurId = (bailleurRow?.id ?? crypto.randomUUID()) as BailleurId;

    // Bien minimal
    bienId = crypto.randomUUID() as BienId;
    await db.insertInto('bien').values({
      id: bienId, rue: '10 rue test', code_postal: '75001', ville: 'Paris',
      surface: 60, type: 'appartement', annee_construction: 2000,
      classe_dpe: null, supprime_le: null,
    }).execute();

    // Déclaration annuelle
    declId = crypto.randomUUID() as DeclarationAnnuelleId;
    const chargesJson = JSON.stringify({
      entretien_reparation: 500_000,
      amelioration: 0,
      charge_courante_periodique: 200_000,
      non_deductible: 0,
      non_qualifie: 0,
    });
    await db.insertInto('declarations_annuelles').values({
      id: declId,
      bailleur_id: bailleurId,
      exercice: EXERCICE,
      regime_applique: 'reel',
      recettes_totales_centimes: 10_000_000, // 100k
      charges_qualifiees_json: chargesJson,
      dotation_amortissement_centimes: 1_000_000, // 10k
      ard_genere_centimes: 0,
      ard_consomme_centimes: 0,
      revenus_foyer_snapshot_centimes: 8_000_000, // 80k
      statut_lmnp_lmp: 'lmnp_confirme',
      composants_snapshot_json: '[{"type":"gros_oeuvre","montantHt":200000}]',
      cloture_le: '2026-12-31',
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('buffer non vide + magic bytes %PDF- + taille > 1000 octets + nomFichier correct', async () => {
    const pdfRenderer = new PdfRendererPdfmake();
    const declRepo = new DeclarationAnnuelleRepositorySqlite(db);
    const bailleurRepo = new BailleurRepositorySqlite(db);
    const bienRepo = new BienRepositorySqlite(db);
    const tableauAmortRepo = new TableauAmortissementRepositorySqlite(db);

    const { buffer, nomFichier } = await exporterPdfRecap(
      { declarationId: declId },
      { declRepo, bailleurRepo, bienRepo, tableauAmortRepo },
      pdfRenderer,
    );

    // Magic bytes PDF
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
    // Taille minimale (vrai PDF avec contenu)
    expect(buffer.length).toBeGreaterThan(1000);
    // Nom fichier
    expect(nomFichier).toBe(`recap-fiscal-${EXERCICE}.pdf`);
  });
});
