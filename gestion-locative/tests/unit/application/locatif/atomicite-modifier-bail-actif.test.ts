/**
 * Test d'atomicité — modifierBailActif (D-10-05, site 2)
 *
 * Injecte un échec sur echeanceLoyerRepo.enregistrerBatch APRÈS que
 * supprimerLot a réussi. Sans transaction enveloppante, on obtiendrait un état
 * incohérent (écheances supprimées orphelines, bail modifié). Avec
 * db.transaction().execute, tout est rollback.
 *
 * Également vérifie que le mode 'previsualiser' n'ouvre aucune transaction.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { EcheanceLoyerRepositorySqlite } from '../../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EncaissementRepositorySqlite } from '../../../../src/infrastructure/repositories/encaissement-repository-sqlite.js';
import { ClockFixe } from '../../../../src/domain/_shared/clock.js';
import { Money } from '../../../../src/domain/_shared/money.js';
import { IRL } from '../../../../src/domain/_shared/irl.js';
import type { BailId, LocataireId, EcheanceLoyerId } from '../../../../src/domain/_shared/identifiants.js';
import { EcheanceLoyer } from '../../../../src/domain/encaissements/echeance-loyer.js';
import { unBienValide, unLotValide } from '../../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../../_builders/locatif.js';
import type { EcheanceLoyerRepository } from '../../../../src/domain/encaissements/echeance-loyer-repository.js';
import { modifierBailActif } from '../../../../src/application/locatif/modifier-bail-actif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../../migrations');

const dbs: Kysely<DB>[] = [];
afterEach(async () => {
  for (const db of dbs) await db.destroy().catch(() => {});
  dbs.length = 0;
});

async function setupDb() {
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  dbs.push(db);
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const bienRepo = new BienRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);
  const encaissementRepo = new EncaissementRepositorySqlite(db);

  const lot = unLotValide({ designation: 'Principal' });
  const bien = unBienValide({ lots: [lot] });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide();
  await locataireRepo.enregistrer(locataire);

  // Bail actif depuis 2026-01-01 avec loyer initial 700€
  const bail = unBailIndexableValide({
    bienId: bien.id,
    locataireId: locataire.id as LocataireId,
    lotIds: [lot.id],
    dateDebut: Temporal.PlainDate.from('2026-01-01'),
    loyerHc: Money.fromCentimes(70_000n),
    irlReference: IRL.creer({ trimestre: '2026-T1', valeur: '145.47' }),
  });
  await bailRepo.enregistrer(bail);

  // Seeder 2 écheances futures en_attente (à régénérer lors de la modification)
  const echeance1 = EcheanceLoyer.creer({
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId: bail.id,
    periodeDebut: Temporal.PlainDate.from('2026-07-01'),
    periodeFin: Temporal.PlainDate.from('2026-07-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-07-01'),
    loyerHc: Money.fromCentimes(70_000n),
    montantCharges: Money.fromCentimes(5_000n),
    modeCharges: 'forfait',
    total: Money.fromCentimes(75_000n),
    statut: 'en_attente',
    annuleLe: null,
  });
  const echeance2 = EcheanceLoyer.creer({
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId: bail.id,
    periodeDebut: Temporal.PlainDate.from('2026-08-01'),
    periodeFin: Temporal.PlainDate.from('2026-08-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-08-01'),
    loyerHc: Money.fromCentimes(70_000n),
    montantCharges: Money.fromCentimes(5_000n),
    modeCharges: 'forfait',
    total: Money.fromCentimes(75_000n),
    statut: 'en_attente',
    annuleLe: null,
  });
  await echeanceLoyerRepo.enregistrerBatch([echeance1, echeance2]);

  return {
    db,
    bailRepo,
    echeanceLoyerRepo,
    encaissementRepo,
    bailId: bail.id as BailId,
    loyerInitial: Money.fromCentimes(70_000n),
  };
}

describe('atomicité modifierBailActif — rollback sur échec DB (D-10-05, site 2)', () => {
  it('rollback complet quand enregistrerBatch throw après supprimerLot', async () => {
    const ctx = await setupDb();

    // Vérifier état initial
    const bailAvant = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailAvant!.loyerHc.toCentimes()).toBe(70_000n);
    const echeancesAvant = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    expect(echeancesAvant.length).toBe(2);

    // Adaptateur qui échoue sur enregistrerBatch (après supprimerLot réussi)
    const erreurInjectee = new Error('CRASH enregistrerBatch');
    const echeanceLoyerRepoEchec: EcheanceLoyerRepository = {
      listerParBail: ctx.echeanceLoyerRepo.listerParBail.bind(ctx.echeanceLoyerRepo),
      supprimerLot: ctx.echeanceLoyerRepo.supprimerLot.bind(ctx.echeanceLoyerRepo),
      enregistrerBatch: async (_echeances, _trxArg?: unknown): Promise<void> => {
        throw erreurInjectee;
      },
      enregistrer: ctx.echeanceLoyerRepo.enregistrer.bind(ctx.echeanceLoyerRepo),
      trouverParId: ctx.echeanceLoyerRepo.trouverParId.bind(ctx.echeanceLoyerRepo),
      mettreAJourStatut: ctx.echeanceLoyerRepo.mettreAJourStatut.bind(ctx.echeanceLoyerRepo),
      listerNonPayees: ctx.echeanceLoyerRepo.listerNonPayees.bind(ctx.echeanceLoyerRepo),
      listerTous: ctx.echeanceLoyerRepo.listerTous.bind(ctx.echeanceLoyerRepo),
    };

    // Le use case doit propager l'erreur
    await expect(
      modifierBailActif(
        {
          bailId: ctx.bailId,
          patch: { loyerHc: Money.fromCentimes(75_000n) },
          confirmation: 'oui',
        },
        ctx.bailRepo,
        echeanceLoyerRepoEchec,
        ctx.encaissementRepo,
        ClockFixe.du('2026-06-15'),
        ctx.db,
      ),
    ).rejects.toThrow('CRASH enregistrerBatch');

    // Rollback attendu : bail inchangé
    const bailApres = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailApres!.loyerHc.toCentimes()).toBe(70_000n);

    // Rollback attendu : écheances non supprimées (aucune orpheline)
    const echeancesApres = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    expect(echeancesApres.length).toBe(2);
  });

  it('mode previsualiser ne déclenche aucune écriture', async () => {
    const ctx = await setupDb();

    let enregistrerCalled = false;
    let supprimerLotCalled = false;
    let enregistrerBatchCalled = false;

    const echeanceLoyerRepoSpy: EcheanceLoyerRepository = {
      listerParBail: ctx.echeanceLoyerRepo.listerParBail.bind(ctx.echeanceLoyerRepo),
      supprimerLot: async (ids, trxArg?: unknown) => {
        supprimerLotCalled = true;
        return ctx.echeanceLoyerRepo.supprimerLot(ids, trxArg);
      },
      enregistrerBatch: async (echeances, trxArg?: unknown) => {
        enregistrerBatchCalled = true;
        return ctx.echeanceLoyerRepo.enregistrerBatch(echeances, trxArg);
      },
      enregistrer: ctx.echeanceLoyerRepo.enregistrer.bind(ctx.echeanceLoyerRepo),
      trouverParId: ctx.echeanceLoyerRepo.trouverParId.bind(ctx.echeanceLoyerRepo),
      mettreAJourStatut: ctx.echeanceLoyerRepo.mettreAJourStatut.bind(ctx.echeanceLoyerRepo),
      listerNonPayees: ctx.echeanceLoyerRepo.listerNonPayees.bind(ctx.echeanceLoyerRepo),
      listerTous: ctx.echeanceLoyerRepo.listerTous.bind(ctx.echeanceLoyerRepo),
    };

    const bailRepoSpy = {
      enregistrer: async (...args: Parameters<typeof ctx.bailRepo.enregistrer>) => {
        enregistrerCalled = true;
        return ctx.bailRepo.enregistrer(...args);
      },
      trouverParId: ctx.bailRepo.trouverParId.bind(ctx.bailRepo),
      listerTous: ctx.bailRepo.listerTous.bind(ctx.bailRepo),
      listerParLocataire: ctx.bailRepo.listerParLocataire.bind(ctx.bailRepo),
      supprimer: ctx.bailRepo.supprimer.bind(ctx.bailRepo),
    };

    const result = await modifierBailActif(
      {
        bailId: ctx.bailId,
        patch: { loyerHc: Money.fromCentimes(75_000n) },
        confirmation: 'previsualiser',
      },
      bailRepoSpy,
      echeanceLoyerRepoSpy,
      ctx.encaissementRepo,
      ClockFixe.du('2026-06-15'),
      ctx.db,
    );

    expect(result.kind).toBe('preview');
    expect(enregistrerCalled).toBe(false);
    expect(supprimerLotCalled).toBe(false);
    expect(enregistrerBatchCalled).toBe(false);

    // Bail et écheances inchangés
    const bailApres = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailApres!.loyerHc.toCentimes()).toBe(70_000n);
    const echeancesApres = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    expect(echeancesApres.length).toBe(2);
  });

  it('réussit normalement (confirmation=oui, contrôle positif)', async () => {
    const ctx = await setupDb();

    const result = await modifierBailActif(
      {
        bailId: ctx.bailId,
        patch: { loyerHc: Money.fromCentimes(75_000n) },
        confirmation: 'oui',
      },
      ctx.bailRepo,
      ctx.echeanceLoyerRepo,
      ctx.encaissementRepo,
      ClockFixe.du('2026-06-15'),
      ctx.db,
    );

    expect(result.kind).toBe('result');
    if (result.kind === 'result') {
      expect(result.echeancesRegenerees).toBe(2);
    }

    const bailApres = await ctx.bailRepo.trouverParId(ctx.bailId);
    expect(bailApres!.loyerHc.toCentimes()).toBe(75_000n);

    const echeancesApres = await ctx.echeanceLoyerRepo.listerParBail(ctx.bailId);
    // Deux écheances régénérées avec le nouveau loyer
    expect(echeancesApres.length).toBe(2);
    expect(echeancesApres[0]!.loyerHc.toCentimes()).toBe(75_000n);
  });
});
