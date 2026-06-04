/**
 * Tests d'intégration HTTP — Banner CFE J-30 (Phase 6 / FIS-06 / Plan 06-07).
 *
 * Couvre :
 *   - GET /biens/:id : banner visible si CFE non_deposee dans la fenêtre J-30 (Clock fixe).
 *   - GET /biens/:id : pas de banner si CFE payee (filtre statut, pitfall §5).
 *   - GET /fiscalite : banner agrégé sur la page racine si au moins une alerte.
 *
 * Pattern : route-cfe.test.ts (creerApp + ClockFixe).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { uneDeclarationCfe } from '../../_builders/fiscalite.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bienId: BienId;
  cfeRepo: DeclarationCfeRepositorySqlite;
}

async function setup(opts: { aujourdhui: string }): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-cfe-banner-phase6-32chars!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
  const clock = ClockFixe.du(opts.aujourdhui);
  const app = await creerApp(db, { clock });
  const bienRepo = new BienRepositorySqlite(db);
  const bien = unBienValide();
  await bienRepo.enregistrer(bien);
  const bailleurRepo = new BailleurRepositorySqlite(db);
  await bailleurRepo.enregistrer(unBailleurValide());
  const cfeRepo = new DeclarationCfeRepositorySqlite(db);
  return { app, db, sqlite, bienId: bien.id, cfeRepo };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('Banner CFE J-30 (Phase 6 / Plan 06-07)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  it('GET /biens/:id → banner visible si CFE non_deposee + J-15', async () => {
    ctx = await setup({ aujourdhui: '2026-11-30' });
    await ctx.cfeRepo.enregistrer(
      uneDeclarationCfe({
        bienId: ctx.bienId,
        millesime: 2026,
        statut: 'non_deposee',
        dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
      }),
    );

    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('aria-label="Alerte CFE 2026"');
    expect(res.body).toContain('Régler la CFE sur impots.gouv.fr');
    expect(res.body).toContain('rel="noopener noreferrer"');
  });

  it('GET /biens/:id → PAS de banner si CFE payee (pitfall §5)', async () => {
    ctx = await setup({ aujourdhui: '2026-11-30' });
    await ctx.cfeRepo.enregistrer(
      uneDeclarationCfe({
        bienId: ctx.bienId,
        millesime: 2026,
        statut: 'payee',
        dateDepotDeclaration: Temporal.PlainDate.from('2026-12-10'),
        montantAvisCentimes: (await import('../../../src/domain/_shared/money.js')).Money.fromEuros(320),
        dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
      }),
    );

    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });

    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('aria-label="Alerte CFE 2026"');
  });

  it('GET /fiscalite → banner agrégé si au moins une CFE en alerte', async () => {
    ctx = await setup({ aujourdhui: '2026-11-30' });
    await ctx.cfeRepo.enregistrer(
      uneDeclarationCfe({
        bienId: ctx.bienId,
        millesime: 2026,
        statut: 'non_deposee',
        dateEcheancePaiement: Temporal.PlainDate.from('2026-12-15'),
      }),
    );

    const res = await ctx.app.inject({ method: 'GET', url: `/fiscalite` });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('aria-label="Échéances CFE"');
    expect(res.body).toContain('aria-label="Alerte CFE 2026"');
  });
});
