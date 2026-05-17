import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BailIndexationRepositorySqlite } from '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import type { BailId, LocataireId } from '../../../src/domain/_shared/identifiants.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { GelLoyerClimatActif } from '../../../src/domain/locatif/erreurs.js';
import { renoncerIndexationIRL } from '../../../src/application/locatif/renoncer-indexation-irl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Ctx {
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bailRepo: BailRepositorySqlite;
  bienRepo: BienRepositorySqlite;
  bailIndexationRepo: BailIndexationRepositorySqlite;
  bailId: BailId;
}

async function setupCtx(dpe: ClasseDpe = 'D'): Promise<Ctx> {
  const sqlite = new Database(':memory:');
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const bienRepo = new BienRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const bailIndexationRepo = new BailIndexationRepositorySqlite(db);

  const lot = unLotValide({ designation: 'Principal' });
  const bien = unBienValide({ lots: [lot], classeDpe: dpe });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide();
  await locataireRepo.enregistrer(locataire);

  const bail = unBailIndexableValide({
    bienId: bien.id,
    locataireId: locataire.id as LocataireId,
    lotIds: [lot.id],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromCentimes(80_000n),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bail);

  return { db, sqlite, bailRepo, bienRepo, bailIndexationRepo, bailId: bail.id };
}

describe('renoncerIndexationIRL (Phase 3-04, D-95)', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await setupCtx('D');
  });

  afterEach(async () => {
    await ctx.db.destroy();
  });

  it('T16: pivote irlReference sans changer loyerHc, crée BailIndexation marker', async () => {
    await renoncerIndexationIRL(
      {
        bailId: ctx.bailId,
        irlTrimestre: '2025-T4',
        irlValeur: '145.47',
        dateEffet: Temporal.PlainDate.from('2026-05-01'),
      },
      { bailRepo: ctx.bailRepo, bienRepo: ctx.bienRepo, bailIndexationRepo: ctx.bailIndexationRepo },
      ctx.db,
    );

    const bailModifie = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailModifie!.loyerHc.toCentimes()).toBe(80_000n); // inchangé
    expect(bailModifie!.irlReference.valeur).toBe('145.47'); // pivoté

    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(1);
    expect(indexations[0]!.indexationAppliquee).toBe(false);
    expect(indexations[0]!.raisonNonApplication).toBe('refus_bailleur');
    expect(indexations[0]!.loyerAvant.egale(indexations[0]!.loyerApres)).toBe(true);
  });

  it('T17: DPE G → throw GelLoyerClimatActif sans rien écrire', async () => {
    await ctx.db.destroy();
    ctx = await setupCtx('G');
    await expect(
      renoncerIndexationIRL(
        { bailId: ctx.bailId, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: ctx.bailRepo, bienRepo: ctx.bienRepo, bailIndexationRepo: ctx.bailIndexationRepo },
        ctx.db,
      ),
    ).rejects.toThrow(GelLoyerClimatActif);
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(0);
  });
});
