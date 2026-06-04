/**
 * Tests d'intégration HTTP — Exports PDF + CSV brouillon liasse
 * (Phase 6 / FIS-05 / Plan 06-05 / D-L6.4).
 *
 * Vérifie :
 *   - GET .pdf retourne Content-Type application/pdf + magic bytes %PDF-.
 *   - GET .csv retourne Content-Type text/csv + BOM + en-tête colonnes.
 *   - Content-Disposition encodé RFC 6266 (filename* UTF-8).
 *   - 404 sur id inexistant.
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
import { Money } from '../../../src/domain/_shared/money.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { unBailleurValide } from '../../_builders/identite.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  declarationId: DeclarationAnnuelleId;
}

async function setup(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-liasse-exports-32-chars!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-12-31');
  const app = await creerApp(db, { clock });

  const bailleurRepo = new BailleurRepositorySqlite(db);
  const bailleur = unBailleurValide({ nomComplet: 'Test Bailleur Export' });
  await bailleurRepo.enregistrer(bailleur);

  const declRepo = new DeclarationAnnuelleRepositorySqlite(db);
  const decl = DeclarationAnnuelle.creer({
    bailleurId: bailleur.id as BailleurId,
    exercice: 2026,
    regimeApplique: 'reel',
    recettesTotales: Money.fromEuros(12_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(1_500),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.fromEuros(3_500),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[{"type":"gros_oeuvre","montantHt":20000000}]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
  await declRepo.enregistrer(decl);

  return { app, db, sqlite, declarationId: decl.id };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('Exports brouillon liasse (Phase 6 / Plan 06-05)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  it('GET .pdf — 200 + Content-Type application/pdf + magic bytes %PDF-', async () => {
    ctx = await setup();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse.pdf`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toMatch(/filename\*=UTF-8''/);
    expect(res.rawPayload.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('GET .csv — 200 + Content-Type text/csv + BOM + en-tête colonnes', async () => {
    ctx = await setup();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse.csv`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(/filename\*=UTF-8''/);
    expect(res.body.charCodeAt(0)).toBe(0xfeff);
    expect(res.body).toContain('Annexe;Case;Libellé officiel;Valeur (€);Sources');
  });

  it('GET .pdf — 404 sur id inexistant', async () => {
    ctx = await setup();
    const inconnuId = crypto.randomUUID();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${inconnuId}/liasse.pdf`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('Déclaration introuvable');
  });

  it('GET .csv rectificative — 404 sur id inexistant', async () => {
    ctx = await setup();
    const inconnuId = crypto.randomUUID();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations-corrigees/${inconnuId}/liasse.csv`,
    });

    expect(res.statusCode).toBe(404);
  });
});
