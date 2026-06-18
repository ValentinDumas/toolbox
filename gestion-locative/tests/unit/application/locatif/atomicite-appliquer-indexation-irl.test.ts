/**
 * Test d'atomicité — appliquerIndexationIRL (D-10-05, site 1)
 *
 * Injecte un échec sur la dernière écriture DB (bailIndexationRepo.enregistrer)
 * APRÈS que bailRepo.enregistrer et echeanceLoyerRepo.supprimerLot +
 * enregistrerBatch ont réussi. Sans transaction enveloppante, on obtiendrait
 * un état incohérent (bail modifié, écheances orphelines supprimées, aucune
 * bail_indexation créée). Avec db.transaction().execute, tout est rollback.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import fs from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BailleurRepositorySqlite } from '../../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { EcheanceLoyerRepositorySqlite } from '../../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EncaissementRepositorySqlite } from '../../../../src/infrastructure/repositories/encaissement-repository-sqlite.js';
import { BailIndexationRepositorySqlite } from '../../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { ClockFixe } from '../../../../src/domain/_shared/clock.js';
import { Bailleur } from '../../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../../src/domain/_shared/adresse.js';
import { Money } from '../../../../src/domain/_shared/money.js';
import { IRL } from '../../../../src/domain/_shared/irl.js';
import type { BailId, LocataireId, EcheanceLoyerId } from '../../../../src/domain/_shared/identifiants.js';
import { EcheanceLoyer } from '../../../../src/domain/encaissements/echeance-loyer.js';
import { unBienValide, unLotValide } from '../../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../../_builders/locatif.js';
import type { BailIndexationRepository } from '../../../../src/domain/locatif/bail-indexation-repository.js';
import type { BailIndexation } from '../../../../src/domain/locatif/bail-indexation.js';
import { appliquerIndexationIRL } from '../../../../src/application/locatif/appliquer-indexation-irl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');

const tmpDirs: string[] = [];
function creerTmpDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-atomicite-irl-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
  tmpDirs.length = 0;
});

async function setupDb() {
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

  const lot = unLotValide({ designation: 'Principal' });
  const bien = unBienValide({ lots: [lot], classeDpe: 'D' });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide();
  await locataireRepo.enregistrer(locataire);

  await bailleurRepo.enregistrer(
    Bailleur.creer({
      nomComplet: 'Jean Bailleur',
      adresse: Adresse.creer({ rue: '1 rue Bailleur', codePostal: '75001', ville: 'Paris' }),
    }),
  );

  // Bail actif depuis 2025-05-01 avec loyer initial 800€
  const bail = unBailIndexableValide({
    bienId: bien.id,
    locataireId: locataire.id as LocataireId,
    lotIds: [lot.id],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromCentimes(80_000n),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bail);

  // Seeder 2 écheances futures en_attente (à régénérer lors de l'indexation)
  const echeance1 = EcheanceLoyer.creer({
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId: bail.id,
    periodeDebut: Temporal.PlainDate.from('2026-06-01'),
    periodeFin: Temporal.PlainDate.from('2026-06-30'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-06-01'),
    loyerHc: Money.fromCentimes(80_000n),
    montantCharges: Money.fromCentimes(5_000n),
    modeCharges: 'forfait',
    total: Money.fromCentimes(85_000n),
    statut: 'en_attente',
    annuleLe: null,
  });
  const echeance2 = EcheanceLoyer.creer({
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId: bail.id,
    periodeDebut: Temporal.PlainDate.from('2026-07-01'),
    periodeFin: Temporal.PlainDate.from('2026-07-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-07-01'),
    loyerHc: Money.fromCentimes(80_000n),
    montantCharges: Money.fromCentimes(5_000n),
    modeCharges: 'forfait',
    total: Money.fromCentimes(85_000n),
    statut: 'en_attente',
    annuleLe: null,
  });
  await echeanceLoyerRepo.enregistrerBatch([echeance1, echeance2]);

  return {
    db,
    bailRepo,
    bienRepo,
    locataireRepo,
    bailleurRepo,
    echeanceLoyerRepo,
    encaissementRepo,
    bailIndexationRepo,
    bailId: bail.id as BailId,
    baseDir: creerTmpDir(),
  };
}

describe('atomicité appliquerIndexationIRL — rollback sur échec DB (D-10-05, site 1)', () => {
  it('rollback complet quand bailIndexationRepo.enregistrer throw après les writes bail/echeances', async () => {
    const ctx = await setupDb();

    // Vérifier état initial
    const bailAvant = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailAvant!.loyerHc.toCentimes()).toBe(80_000n);
    const echeancesAvant = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    expect(echeancesAvant.length).toBe(2);

    // Adaptateur qui échoue sur enregistrer (injection d'échec sur la dernière écriture DB)
    const erreurInjectee = new Error('CRASH bailIndexationRepo.enregistrer');
    const bailIndexationRepoEchec: BailIndexationRepository = {
      enregistrer: async (_bi: BailIndexation, _trxArg?: unknown): Promise<void> => {
        throw erreurInjectee;
      },
      listerParBail: ctx.bailIndexationRepo.listerParBail.bind(ctx.bailIndexationRepo),
      trouverParId: ctx.bailIndexationRepo.trouverParId.bind(ctx.bailIndexationRepo),
      dernierePourBail: ctx.bailIndexationRepo.dernierePourBail.bind(ctx.bailIndexationRepo),
    };

    // Le use case doit propager l'erreur
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
          bailIndexationRepo: bailIndexationRepoEchec,
        },
        {
          pdfRenderer: { genererBuffer: async () => Buffer.from('fake-pdf') } as never,
          avenantIRLBuilder: { construire: () => ({}) } as never,
          stockage: { ecrireAvenant: async (_a: number, n: string) => `avenants/2026/${n}` },
          clock: ClockFixe.du('2026-05-15'),
        },
        ctx.db,
      ),
    ).rejects.toThrow('CRASH bailIndexationRepo.enregistrer');

    // Rollback attendu : bail inchangé
    const bailApres = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailApres!.loyerHc.toCentimes()).toBe(80_000n);
    expect(bailApres!.irlReference.valeur).toBe('142.06');

    // Rollback attendu : écheances non supprimées (aucune orpheline)
    const echeancesApres = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    expect(echeancesApres.length).toBe(2);

    // Rollback attendu : aucune ligne bail_indexations
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(0);

    await ctx.db.destroy();
  });

  it('réussit normalement sans échec injecté (contrôle positif)', async () => {
    const ctx = await setupDb();

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
      {
        pdfRenderer: { genererBuffer: async () => Buffer.from('fake') } as never,
        avenantIRLBuilder: { construire: () => ({}) } as never,
        stockage: { ecrireAvenant: async (_a: number, n: string) => `avenants/2026/${n}` },
        clock: ClockFixe.du('2026-05-15'),
      },
      ctx.db,
    );

    // Bail mis à jour avec nouveau loyer
    expect(res.nouveauLoyerHc.toCentimes()).toBe(81_920n);

    const bailApres = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailApres!.loyerHc.toCentimes()).toBe(81_920n);

    // bail_indexation créée
    const indexations = await ctx.bailIndexationRepo.listerParBail(ctx.bailId);
    expect(indexations.length).toBe(1);

    await ctx.db.destroy();
  });
});
