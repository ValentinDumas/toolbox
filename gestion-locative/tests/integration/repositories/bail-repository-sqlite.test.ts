import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailValide, unIrlValide, uneCautionnementPhysique } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';
import type { BailId, BienId, LotId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BailRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailRepo: BailRepositorySqlite;
  let bienRepo: BienRepositorySqlite;
  let locataireRepo: LocataireRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    bailRepo = new BailRepositorySqlite(db);
    bienRepo = new BienRepositorySqlite(db);
    locataireRepo = new LocataireRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  async function creerBienEtLocataire(): Promise<{ bienId: BienId; lotId: LotId; locataireId: LocataireId }> {
    const lot = unLotValide({ designation: 'Appartement principal' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    return { bienId: bien.id, lotId: lot.id, locataireId: locataire.id };
  }

  it('enregistrer + trouverParId roundtrip (loyer, dépôt, lot_ids, IRL)', async () => {
    const { bienId, lotId, locataireId } = await creerBienEtLocataire();

    const bail = unBailValide({
      bienId,
      locataireId,
      lotIds: [lotId],
      loyerHc: Money.fromEuros(800),
      depotGarantie: Money.fromEuros(800),
      irlReference: unIrlValide(),
    });

    await bailRepo.enregistrer(bail);

    const retrouve = await bailRepo.trouverParId(bail.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(bail.id);
    expect(retrouve!.loyerHc.toCentimes()).toBe(80_000n);
    expect(retrouve!.depotGarantie.toCentimes()).toBe(80_000n);
    expect(retrouve!.lotIds).toHaveLength(1);
    expect(retrouve!.lotIds[0]).toBe(lotId);
    expect(retrouve!.irlReference.trimestre).toBe('2026-T1');
    expect(retrouve!.irlReference.valeur).toBe('145.47');
    expect(retrouve!.cautionnement).toBeNull();
  });

  it('enregistrer un Bail avec cautionnement physique — roundtrip cautionnement', async () => {
    const { bienId, lotId, locataireId } = await creerBienEtLocataire();
    const cautionnement = uneCautionnementPhysique();

    const bail = unBailValide({
      bienId,
      locataireId,
      lotIds: [lotId],
      cautionnement,
    });

    await bailRepo.enregistrer(bail);

    const retrouve = await bailRepo.trouverParId(bail.id);
    expect(retrouve!.cautionnement).not.toBeNull();
    expect(retrouve!.cautionnement!.type).toBe('physique');
    expect(retrouve!.cautionnement!.garant).not.toBeNull();
    expect(retrouve!.cautionnement!.garant!.nom).toBe('Martin');
  });

  it('enregistrer un Bail avec 2 lots persiste les 2 rows dans bail_lots', async () => {
    const lot1 = unLotValide({ designation: 'Appt A' });
    const lot2 = unLotValide({ designation: 'Parking P1', type: 'parking', surface: null });
    const bien = unBienValide({ lots: [lot1, lot2] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const bail = unBailValide({
      bienId: bien.id,
      locataireId: locataire.id,
      lotIds: [lot1.id, lot2.id],
    });

    await bailRepo.enregistrer(bail);

    const rowsBailLots = sqlite
      .prepare('SELECT lot_id FROM bail_lots WHERE bail_id = ?')
      .all(bail.id) as Array<{ lot_id: string }>;
    expect(rowsBailLots).toHaveLength(2);

    const retrouve = await bailRepo.trouverParId(bail.id);
    expect(retrouve!.lotIds).toHaveLength(2);
  });

  it('enregistrer met à jour un Bail existant (idempotence)', async () => {
    const { bienId, lotId, locataireId } = await creerBienEtLocataire();

    const bail = unBailValide({ bienId, locataireId, lotIds: [lotId] });
    await bailRepo.enregistrer(bail);

    const bailModifie = bail.modifier({ loyerHc: Money.fromEuros(900), depotGarantie: Money.fromEuros(900) });
    await bailRepo.enregistrer(bailModifie);

    const tous = await bailRepo.listerTous();
    expect(tous).toHaveLength(1);
    expect(tous[0]!.loyerHc.toCentimes()).toBe(90_000n);
  });

  it('listerTous exclut soft-deleted', async () => {
    const { bienId, lotId, locataireId } = await creerBienEtLocataire();

    const bail = unBailValide({ bienId, locataireId, lotIds: [lotId] });
    await bailRepo.enregistrer(bail);

    await bailRepo.supprimer(bail.id);

    const tous = await bailRepo.listerTous();
    expect(tous).toHaveLength(0);
  });

  it('supprimer (soft-delete) → trouverParId retourne null', async () => {
    const { bienId, lotId, locataireId } = await creerBienEtLocataire();

    const bail = unBailValide({ bienId, locataireId, lotIds: [lotId] });
    await bailRepo.enregistrer(bail);

    await bailRepo.supprimer(bail.id);

    const retrouve = await bailRepo.trouverParId(bail.id);
    expect(retrouve).toBeNull();
  });
});
