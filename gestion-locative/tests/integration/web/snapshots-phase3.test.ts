/**
 * Snapshot tests — Phase 3 views (plan 03-05).
 *
 * Détecte les régressions visuelles silencieuses sur les 5 vues clés Phase 3.
 * Les UUIDs et dates volatiles sont normalisés avant snapshot pour assurer la
 * reproductibilité (sinon chaque run produirait un nouveau hash de bien/bail).
 *
 * Mise à jour : `pnpm vitest run tests/integration/web/snapshots-phase3.test.ts -u`.
 *
 * Pattern : Vitest + app.inject() + scrubbing + toMatchSnapshot().
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBienValide, unLotValide, unDiagnosticDpeValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import type {
  BienId,
  LotId,
  LocataireId,
  BailId,
} from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Normalise un HTML pour le snapshot :
 *  - remplace tous les UUIDs par "UUID"
 *  - normalise les whitespace en fin de ligne
 */
function scrub(html: string): string {
  return html.replace(UUID_RE, 'UUID').replace(/\r\n/g, '\n');
}

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bienDpeDId: BienId;
  bienDpeFId: BienId;
  bailDpeDId: BailId;
  bailDpeFId: BailId;
}

async function setup(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-snapshots-phase3-32chars!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-05-15');
  const app = await creerApp(db, { clock });

  const bienRepo = new BienRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);

  // Bien DPE D
  const lotD = unLotValide({ designation: 'Principal' });
  const bienD = unBienValide({
    lots: [lotD],
    classeDpe: 'D',
    diagnostics: [unDiagnosticDpeValide({ classeDpe: 'D' })],
  });
  await bienRepo.enregistrer(bienD);

  const locataireD = unLocataireValide({ email: 'd@example.fr' });
  await locataireRepo.enregistrer(locataireD);

  const bailD = unBailIndexableValide({
    locataireId: locataireD.id as LocataireId,
    bienId: bienD.id as BienId,
    lotIds: [lotD.id as LotId],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromEuros(800),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bailD);

  // Bien DPE F
  const lotF = unLotValide({ designation: 'Principal' });
  const bienF = unBienValide({
    lots: [lotF],
    classeDpe: 'F',
    diagnostics: [unDiagnosticDpeValide({ classeDpe: 'F' })],
  });
  await bienRepo.enregistrer(bienF);

  const locataireF = unLocataireValide({ email: 'f@example.fr' });
  await locataireRepo.enregistrer(locataireF);

  const bailF = unBailIndexableValide({
    locataireId: locataireF.id as LocataireId,
    bienId: bienF.id as BienId,
    lotIds: [lotF.id as LotId],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromEuros(800),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bailF);

  return {
    app,
    db,
    sqlite,
    bienDpeDId: bienD.id as BienId,
    bienDpeFId: bienF.id as BienId,
    bailDpeDId: bailD.id as BailId,
    bailDpeFId: bailF.id as BailId,
  };
}

describe('snapshots Phase 3 — détection régression visuelle (plan 03-05)', () => {
  let ctx: Contexte;

  beforeAll(async () => {
    ctx = await setup();
  });

  afterAll(async () => {
    if (ctx) {
      await ctx.app.close();
      await ctx.db.destroy();
    }
  });

  it('snapshot formulaire diagnostic (vierge)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/biens/${ctx.bienDpeDId}/diagnostics/nouveau`,
    });
    expect(res.statusCode).toBe(200);
    expect(scrub(res.body)).toMatchSnapshot();
  });

  it('snapshot formulaire EDL entrée (vierge)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/baux/${ctx.bailDpeDId}/edl/entree/nouveau`,
    });
    expect(res.statusCode).toBe(200);
    expect(scrub(res.body)).toMatchSnapshot();
  });

  it('snapshot formulaire EDL sortie (vierge)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/baux/${ctx.bailDpeDId}/edl/sortie/nouveau`,
    });
    expect(res.statusCode).toBe(200);
    expect(scrub(res.body)).toMatchSnapshot();
  });

  it('snapshot wizard saisie IRL (étape 2 / bail DPE D)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/baux/${ctx.bailDpeDId}/indexer`,
    });
    expect(res.statusCode).toBe(200);
    expect(scrub(res.body)).toMatchSnapshot();
  });

  it('snapshot gel-loyer (bail DPE F)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/baux/${ctx.bailDpeFId}/indexer`,
    });
    expect(res.statusCode).toBe(200);
    expect(scrub(res.body)).toMatchSnapshot();
  });
});
