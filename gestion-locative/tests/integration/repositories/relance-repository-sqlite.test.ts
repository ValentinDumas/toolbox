import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { EcheanceLoyerId, BailId } from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { EcheanceLoyerRepositorySqlite } from '../../../src/infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';

// Tests RED — RelanceRepositorySqlite
// NOTE: Ces modules n'existent pas encore — tests RED intentionnellement
import { RelanceRepositorySqlite } from '../../../src/infrastructure/repositories/relance-repository-sqlite.js';
import { Relance } from '../../../src/domain/encaissements/relance.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('RelanceRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let relanceRepo: RelanceRepositorySqlite;
  let echeanceLoyerRepo: EcheanceLoyerRepositorySqlite;
  let echeanceId: EcheanceLoyerId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    relanceRepo = new RelanceRepositorySqlite(db);
    echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);
    const bailRepo = new BailRepositorySqlite(db);
    const bienRepo = new BienRepositorySqlite(db);
    const locataireRepo = new LocataireRepositorySqlite(db);

    // Setup dépendances
    const lot = unLotValide({ designation: 'Appt test relance' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);
    const bail = unBailValide({ bienId: bien.id, locataireId: locataire.id, lotIds: [lot.id] });
    await bailRepo.enregistrer(bail);

    // Créer une échéance en base
    const loyerHc = Money.fromEuros(700);
    const echeance = EcheanceLoyer.creer({
      bailId: bail.id as BailId,
      periodeDebut: Temporal.PlainDate.from('2026-05-01'),
      periodeFin: Temporal.PlainDate.from('2026-05-31'),
      jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
      loyerHc,
      montantCharges: Money.zero(),
      modeCharges: 'forfait',
      total: loyerHc,
      statut: 'en_attente',
      annuleLe: null,
    });
    await echeanceLoyerRepo.enregistrerBatch([echeance]);
    echeanceId = echeance.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('T21 : roundtrip Relance — enregistrer + listerParEcheance', async () => {
    const relance = Relance.creer({
      echeanceId,
      niveau: 1,
      canal: 'email',
      envoyeeLe: Temporal.PlainDate.from('2026-05-15'),
      contenuSnapshot: JSON.stringify({ variables: {}, contenuRendu: 'Test', mailtoUri: null, version: 'v1' }),
    });

    await relanceRepo.enregistrer(relance);

    const relances = await relanceRepo.listerParEcheance(echeanceId);
    expect(relances).toHaveLength(1);
    expect(relances[0]!.niveau).toBe(1);
    expect(relances[0]!.canal).toBe('email');
    expect(relances[0]!.envoyeeLe.toString()).toBe('2026-05-15');
    expect(relances[0]!.annuleLe).toBeNull();
  });

  it('listerParEcheance filtre annule_le IS NULL par défaut', async () => {
    const relanceActive = Relance.creer({
      echeanceId,
      niveau: 1,
      canal: 'email',
      envoyeeLe: Temporal.PlainDate.from('2026-05-15'),
      contenuSnapshot: '{"version":"v1"}',
    });
    const relanceAnnulee = Relance.creer({
      echeanceId,
      niveau: 1,
      canal: 'email',
      envoyeeLe: Temporal.PlainDate.from('2026-05-10'),
      contenuSnapshot: '{"version":"v1"}',
      annuleLe: Temporal.PlainDate.from('2026-05-12'),
    });

    await relanceRepo.enregistrer(relanceActive);
    await relanceRepo.enregistrer(relanceAnnulee);

    // Par défaut → filtre annule_le IS NULL
    const actives = await relanceRepo.listerParEcheance(echeanceId);
    expect(actives).toHaveLength(1);
    expect(actives[0]!.id).toBe(relanceActive.id);

    // Avec inclureAnnulees → toutes
    const toutes = await relanceRepo.listerParEcheance(echeanceId, { inclureAnnulees: true });
    expect(toutes).toHaveLength(2);
  });
});
