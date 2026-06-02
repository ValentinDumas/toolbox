/**
 * Tests d'intégration — DeclarationCfeRepositorySqlite (Phase 6 / FIS-06).
 *
 * Vérifie :
 *   - Round-trip statut 'non_deposee' (montant + dépôt null préservés).
 *   - Round-trip statut 'payee' (Money round-trip via toSqliteInteger).
 *   - trouverParBienMillesime ciblé (millésime existant vs absent).
 *   - listerParBien retourne ordre millésime DESC.
 *   - UNIQUE (bien_id, millesime) : 2e enregistrer remplace (upsert), pas un doublon.
 *
 * Pattern miroir : declaration-annuelle-repository-sqlite.test.ts
 * Important : la clé d'idempotence métier est COMPOSITE (bien_id, millesime),
 * PAS l'id (D-CFE6.2).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { DeclarationCfe } from '../../../src/domain/fiscalite/cfe/declaration-cfe.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('DeclarationCfeRepositorySqlite — upsert (bien_id, millesime) — D-CFE6.2', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let cfeRepo: DeclarationCfeRepositorySqlite;
  let bienId: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    cfeRepo = new DeclarationCfeRepositorySqlite(db);

    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('round-trip statut non_deposee — nullables préservés', async () => {
    const decl = DeclarationCfe.creer({
      bienId,
      millesime: 2026,
      statut: 'non_deposee',
      dateDepotDeclaration: null,
      montantAvisCentimes: null,
      dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
    });

    await cfeRepo.enregistrer(decl);
    const lu = await cfeRepo.trouverParId(decl.id);

    expect(lu).not.toBeNull();
    expect(lu!.bienId).toBe(bienId);
    expect(lu!.millesime).toBe(2026);
    expect(lu!.statut).toBe('non_deposee');
    expect(lu!.dateDepotDeclaration).toBeNull();
    expect(lu!.montantAvisCentimes).toBeNull();
    expect(lu!.dateEcheancePaiement.toString()).toBe('2026-12-15');
  });

  it('round-trip statut payee — Money + Temporal préservés', async () => {
    const decl = DeclarationCfe.creer({
      bienId,
      millesime: 2026,
      statut: 'payee',
      dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
      montantAvisCentimes: Money.fromEuros(320),
      dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
    });

    await cfeRepo.enregistrer(decl);
    const lu = await cfeRepo.trouverParId(decl.id);

    expect(lu).not.toBeNull();
    expect(lu!.statut).toBe('payee');
    expect(lu!.dateDepotDeclaration?.toString()).toBe('2026-12-10');
    expect(lu!.montantAvisCentimes?.egale(Money.fromEuros(320))).toBe(true);
    expect(lu!.dateEcheancePaiement.toString()).toBe('2026-12-15');
  });

  it('trouverParBienMillesime — hit sur 2026, miss sur 2027', async () => {
    const decl = DeclarationCfe.creer({
      bienId,
      millesime: 2026,
      statut: 'non_deposee',
      dateDepotDeclaration: null,
      montantAvisCentimes: null,
      dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
    });
    await cfeRepo.enregistrer(decl);

    const lu2026 = await cfeRepo.trouverParBienMillesime(bienId, 2026);
    const lu2027 = await cfeRepo.trouverParBienMillesime(bienId, 2027);

    expect(lu2026?.id).toBe(decl.id);
    expect(lu2027).toBeNull();
  });

  it('listerParBien — ordre millesime DESC', async () => {
    for (const millesime of [2026, 2027, 2028]) {
      await cfeRepo.enregistrer(
        DeclarationCfe.creer({
          bienId,
          millesime,
          statut: 'non_deposee',
          dateDepotDeclaration: null,
          montantAvisCentimes: null,
          dateEcheancePaiement: Temporal.PlainDate.from(`${millesime}-12-15`),
        }),
      );
    }

    const liste = await cfeRepo.listerParBien(bienId);
    expect(liste.map((d) => d.millesime)).toEqual([2028, 2027, 2026]);
  });

  it('UNIQUE (bien_id, millesime) — upsert remplace au lieu de doublonner (D-CFE6.2)', async () => {
    const initiale = DeclarationCfe.creer({
      bienId,
      millesime: 2026,
      statut: 'non_deposee',
      dateDepotDeclaration: null,
      montantAvisCentimes: null,
      dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
    });
    await cfeRepo.enregistrer(initiale);

    const modifiee = initiale.modifier({
      statut: 'payee',
      dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
      montantAvisCentimes: Money.fromEuros(320),
    });
    await cfeRepo.enregistrer(modifiee);

    const liste = await cfeRepo.listerParBien(bienId);
    expect(liste).toHaveLength(1);
    expect(liste[0].statut).toBe('payee');
    expect(liste[0].montantAvisCentimes?.egale(Money.fromEuros(320))).toBe(true);
    expect(liste[0].dateDepotDeclaration?.toString()).toBe('2026-12-10');
  });
});
