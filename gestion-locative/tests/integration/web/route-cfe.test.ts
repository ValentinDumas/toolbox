/**
 * Tests d'intégration HTTP — Routes CFE sur fiche Bien (Phase 6 / FIS-06).
 *
 * Couvre :
 *   - GET /biens/:id/cfe/nouvelle 200 + aide pédagogique CGI art. 1478.
 *   - POST /biens/:id/cfe création réussie 302 + flash.
 *   - POST /biens/:id/cfe invariant violé → redirect form avec message.
 *   - GET /biens/:id avec déclarations CFE → section affichée + carte + badge.
 *   - POST /biens/:id/cfe/:cfeId/modifier (upsert) → redirect + flash.
 *
 * Pattern miroir : route-liasse.test.ts (creerApp + app.inject).
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
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

async function setupBien(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-cfe-phase6-route-32chars!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-06-15');
  const app = await creerApp(db, { clock });

  const bienRepo = new BienRepositorySqlite(db);
  const bien = unBienValide();
  await bienRepo.enregistrer(bien);
  const cfeRepo = new DeclarationCfeRepositorySqlite(db);

  return { app, db, sqlite, bienId: bien.id, cfeRepo };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('Routes biens/cfe (Phase 6 / FIS-06)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  it('GET /biens/:id/cfe/nouvelle — 200 + aide pédagogique CGI art. 1478', async () => {
    ctx = await setupBien();

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/biens/${ctx.bienId}/cfe/nouvelle`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('CGI art. 1478');
    expect(res.body).toContain('Cotisation Foncière des Entreprises');
    expect(res.body).toContain('Service des Impôts des Entreprises');
  });

  it('POST /biens/:id/cfe — création réussie 302 + flash session', async () => {
    ctx = await setupBien();

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/biens/${ctx.bienId}/cfe`,
      payload: {
        millesime: '2026',
        statut: 'non_deposee',
        dateDepotDeclaration: '',
        montantAvisEuros: '',
        dateEcheancePaiement: '2026-12-15',
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/biens/${ctx.bienId}`);

    const liste = await ctx.cfeRepo.listerParBien(ctx.bienId);
    expect(liste).toHaveLength(1);
    expect(liste[0]!.statut).toBe('non_deposee');
  });

  it("POST /biens/:id/cfe — invariant D-CFE6.3 (statut deposee sans date) → redirect form", async () => {
    ctx = await setupBien();

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/biens/${ctx.bienId}/cfe`,
      payload: {
        millesime: '2026',
        statut: 'deposee',
        dateDepotDeclaration: '',
        montantAvisEuros: '',
        dateEcheancePaiement: '2026-12-15',
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/biens/${ctx.bienId}/cfe/nouvelle`);
    const liste = await ctx.cfeRepo.listerParBien(ctx.bienId);
    expect(liste).toHaveLength(0);
  });

  it('GET /biens/:id — section CFE rendue avec carte + badge', async () => {
    ctx = await setupBien();

    await ctx.cfeRepo.enregistrer(uneDeclarationCfe({ bienId: ctx.bienId, millesime: 2026 }));

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/biens/${ctx.bienId}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('aria-label="Déclarations CFE');
    expect(res.body).toContain('CFE 2026');
    expect(res.body).toContain('aria-label="Statut CFE');
  });

  it('POST /biens/:id/cfe/:cfeId/modifier — upsert OK 302', async () => {
    ctx = await setupBien();
    const decl = uneDeclarationCfe({ bienId: ctx.bienId, millesime: 2026 });
    await ctx.cfeRepo.enregistrer(decl);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/biens/${ctx.bienId}/cfe/${decl.id}/modifier`,
      payload: {
        statut: 'deposee',
        dateDepotDeclaration: '2026-12-10',
        montantAvisEuros: '',
        dateEcheancePaiement: '2026-12-15',
      },
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(`/biens/${ctx.bienId}`);

    const lu = await ctx.cfeRepo.trouverParId(decl.id);
    expect(lu).not.toBeNull();
    expect(lu!.statut).toBe('deposee');
    expect(lu!.dateDepotDeclaration?.toString()).toBe('2026-12-10');
  });
});
