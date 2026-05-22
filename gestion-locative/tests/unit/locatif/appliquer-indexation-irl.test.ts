import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import fs from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EncaissementRepositorySqlite } from '../../../src/infrastructure/repositories/encaissement-repository-sqlite.js';
import { BailIndexationRepositorySqlite } from '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { StockageFichierLocal } from '../../../src/infrastructure/storage/stockage-fichier-local.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { AvenantIRLBuilderPdfmake } from '../../../src/infrastructure/pdf/avenant-irl-builder-pdfmake.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import type { BailId, LocataireId } from '../../../src/domain/_shared/identifiants.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { GelLoyerClimatActif } from '../../../src/domain/locatif/erreurs.js';
import { BailleurAbsent } from '../../../src/domain/identite/erreurs.js';
import { appliquerIndexationIRL } from '../../../src/application/locatif/appliquer-indexation-irl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

const tmpDirs: string[] = [];
function creerTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-apply-test-'));
  tmpDirs.push(dir);
  return dir;
}

interface Ctx {
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bailRepo: BailRepositorySqlite;
  bienRepo: BienRepositorySqlite;
  locataireRepo: LocataireRepositorySqlite;
  bailleurRepo: BailleurRepositorySqlite;
  echeanceLoyerRepo: EcheanceLoyerRepositorySqlite;
  encaissementRepo: EncaissementRepositorySqlite;
  bailIndexationRepo: BailIndexationRepositorySqlite;
  pdfRenderer: PdfRendererPdfmake;
  avenantIRLBuilder: AvenantIRLBuilderPdfmake;
  stockage: StockageFichierLocal;
  clock: ClockFixe;
  bailId: BailId;
  baseDir: string;
}

async function setupCtx(dpe: ClasseDpe = 'D', bailleurPresent = true): Promise<Ctx> {
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const bienRepo = new BienRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const bailleurRepo = new BailleurRepositorySqlite(db);
  const echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);
  const encaissementRepo = new EncaissementRepositorySqlite(db);
  const bailIndexationRepo = new BailIndexationRepositorySqlite(db);
  const pdfRenderer = new PdfRendererPdfmake();
  const avenantIRLBuilder = new AvenantIRLBuilderPdfmake();
  const baseDir = creerTmpDir();
  const stockage = new StockageFichierLocal(baseDir);
  const clock = ClockFixe.du('2026-05-15');

  const lot = unLotValide({ designation: 'Principal' });
  const bien = unBienValide({ lots: [lot], classeDpe: dpe });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide();
  await locataireRepo.enregistrer(locataire);

  if (bailleurPresent) {
    await bailleurRepo.enregistrer(
      Bailleur.creer({
        nomComplet: 'Jean Bailleur',
        adresse: Adresse.creer({ rue: '1 rue Bailleur', codePostal: '75001', ville: 'Paris' }),
      }),
    );
  }

  const bail = unBailIndexableValide({
    bienId: bien.id,
    locataireId: locataire.id as LocataireId,
    lotIds: [lot.id],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromCentimes(80_000n),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bail);

  return {
    db, sqlite, bailRepo, bienRepo, locataireRepo, bailleurRepo,
    echeanceLoyerRepo, encaissementRepo, bailIndexationRepo,
    pdfRenderer, avenantIRLBuilder, stockage, clock, bailId: bail.id, baseDir,
  };
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

describe('appliquerIndexationIRL (Phase 3-04, D-94)', () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await setupCtx('D');
  });

  afterEach(async () => {
    await ctx.db.destroy();
  });

  it('T11: applique pivot bail + crée BailIndexation + génère PDF avenant', async () => {
    const res = await appliquerIndexationIRL(
      {
        bailId: ctx.bailId,
        irlTrimestre: '2025-T4',
        irlValeur: '145.47',
        dateEffet: Temporal.PlainDate.from('2026-05-01'),
      },
      {
        bailRepo: ctx.bailRepo,
        bienRepo: ctx.bienRepo,
        locataireRepo: ctx.locataireRepo,
        bailleurRepo: ctx.bailleurRepo,
        echeanceLoyerRepo: ctx.echeanceLoyerRepo,
        encaissementRepo: ctx.encaissementRepo,
        bailIndexationRepo: ctx.bailIndexationRepo,
      },
      { pdfRenderer: ctx.pdfRenderer, avenantIRLBuilder: ctx.avenantIRLBuilder, stockage: ctx.stockage, clock: ctx.clock },
      ctx.db,
    );

    expect(res.nouveauLoyerHc.toCentimes()).toBe(81_920n);
    expect(res.cheminFichierRelatifAvenant).toMatch(/avenants\/2026\/avenant-.*\.pdf$/);

    const bailModifie = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailModifie!.loyerHc.toCentimes()).toBe(81_920n);
    expect(bailModifie!.irlReference.valeur).toBe('145.47');

    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(1);
    expect(indexations[0]!.indexationAppliquee).toBe(true);
    expect(indexations[0]!.raisonNonApplication).toBeNull();

    // Fichier avenant existe sur disque
    const cheminAbs = path.join(ctx.baseDir, res.cheminFichierRelatifAvenant);
    expect(fs.existsSync(cheminAbs)).toBe(true);
  });

  it('T12: throw GelLoyerClimatActif si DPE F sans rien écrire', async () => {
    await ctx.db.destroy();
    ctx = await setupCtx('F');
    await expect(
      appliquerIndexationIRL(
        { bailId: ctx.bailId, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        {
          bailRepo: ctx.bailRepo,
          bienRepo: ctx.bienRepo,
          locataireRepo: ctx.locataireRepo,
          bailleurRepo: ctx.bailleurRepo,
          echeanceLoyerRepo: ctx.echeanceLoyerRepo,
          encaissementRepo: ctx.encaissementRepo,
          bailIndexationRepo: ctx.bailIndexationRepo,
        },
        { pdfRenderer: ctx.pdfRenderer, avenantIRLBuilder: ctx.avenantIRLBuilder, stockage: ctx.stockage, clock: ctx.clock },
        ctx.db,
      ),
    ).rejects.toThrow(GelLoyerClimatActif);
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(0);
  });

  it('T13: throw BailleurAbsent si bailleur singleton manquant', async () => {
    await ctx.db.destroy();
    ctx = await setupCtx('D', false);
    await expect(
      appliquerIndexationIRL(
        { bailId: ctx.bailId, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        {
          bailRepo: ctx.bailRepo,
          bienRepo: ctx.bienRepo,
          locataireRepo: ctx.locataireRepo,
          bailleurRepo: ctx.bailleurRepo,
          echeanceLoyerRepo: ctx.echeanceLoyerRepo,
          encaissementRepo: ctx.encaissementRepo,
          bailIndexationRepo: ctx.bailIndexationRepo,
        },
        { pdfRenderer: ctx.pdfRenderer, avenantIRLBuilder: ctx.avenantIRLBuilder, stockage: ctx.stockage, clock: ctx.clock },
        ctx.db,
      ),
    ).rejects.toThrow(BailleurAbsent);
  });

  it('T14: échec PDF re-throw mais bail + BailIndexation déjà committés', async () => {
    const pdfStub = {
      async genererBuffer(): Promise<Buffer> {
        throw new Error('PDF render boom');
      },
    };
    await expect(
      appliquerIndexationIRL(
        {
          bailId: ctx.bailId,
          irlTrimestre: '2025-T4',
          irlValeur: '145.47',
          dateEffet: Temporal.PlainDate.from('2026-05-01'),
        },
        {
          bailRepo: ctx.bailRepo,
          bienRepo: ctx.bienRepo,
          locataireRepo: ctx.locataireRepo,
          bailleurRepo: ctx.bailleurRepo,
          echeanceLoyerRepo: ctx.echeanceLoyerRepo,
          encaissementRepo: ctx.encaissementRepo,
          bailIndexationRepo: ctx.bailIndexationRepo,
        },
        { pdfRenderer: pdfStub, avenantIRLBuilder: ctx.avenantIRLBuilder, stockage: ctx.stockage, clock: ctx.clock },
        ctx.db,
      ),
    ).rejects.toThrow('PDF render boom');

    const bailModifie = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailModifie!.loyerHc.toCentimes()).toBe(81_920n);
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(1);
  });

  it('T15: échec écriture fichier (EEXIST) — bail + BailIndexation déjà committés', async () => {
    const stockageStub = {
      async ecrireAvenant(): Promise<string> {
        const err = new Error('EEXIST');
        (err as NodeJS.ErrnoException).code = 'EEXIST';
        throw err;
      },
    };
    await expect(
      appliquerIndexationIRL(
        {
          bailId: ctx.bailId,
          irlTrimestre: '2025-T4',
          irlValeur: '145.47',
          dateEffet: Temporal.PlainDate.from('2026-05-01'),
        },
        {
          bailRepo: ctx.bailRepo,
          bienRepo: ctx.bienRepo,
          locataireRepo: ctx.locataireRepo,
          bailleurRepo: ctx.bailleurRepo,
          echeanceLoyerRepo: ctx.echeanceLoyerRepo,
          encaissementRepo: ctx.encaissementRepo,
          bailIndexationRepo: ctx.bailIndexationRepo,
        },
        { pdfRenderer: ctx.pdfRenderer, avenantIRLBuilder: ctx.avenantIRLBuilder, stockage: stockageStub, clock: ctx.clock },
        ctx.db,
      ),
    ).rejects.toThrow();

    const bailModifie = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailModifie!.loyerHc.toCentimes()).toBe(81_920n);
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(1);
  });
});
