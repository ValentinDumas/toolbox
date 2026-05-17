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
import { inventaireCompletPresent } from '../../../src/domain/_shared/inventaire-item.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide } from '../../_builders/locatif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BailRepositorySqlite — mobilier JSON inline (Phase 3 — LOC-06)', () => {
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

  // T45 — roundtrip mobilier
  it('roundtrip Bail avec mobilier: inventaireCompletPresent() — bail.mobilier identique après save+load', async () => {
    const lot = unLotValide({ designation: 'Appart' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const mobilier = inventaireCompletPresent();
    const bail = unBailValide({
      bienId: bien.id,
      locataireId: locataire.id,
      lotIds: [lot.id],
      mobilier,
    });
    await bailRepo.enregistrer(bail);

    const loaded = await bailRepo.trouverParId(bail.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.mobilier.length).toBe(12);
    for (let i = 0; i < 12; i++) {
      expect(loaded!.mobilier[i]!.typeItem).toBe(mobilier[i]!.typeItem);
      expect(loaded!.mobilier[i]!.present).toBe(true);
      expect(loaded!.mobilier[i]!.etat).toBe('bon');
    }
  });
});
