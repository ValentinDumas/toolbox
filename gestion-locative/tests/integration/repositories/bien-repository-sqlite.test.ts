import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { Bien } from '../../../src/domain/patrimoine/bien.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { Lot } from '../../../src/domain/patrimoine/lot.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = path.resolve(__dirname, '../../../migrations/0001_init.sql');

describe('BienRepositorySqlite', () => {
  let db: Kysely<DB>;
  let repo: BienRepositorySqlite;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerMigrationsBrutes(db, MIGRATIONS_PATH);
    repo = new BienRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  function creerBienTest(): Bien {
    return Bien.creer({
      adresse: Adresse.creer({
        rue: '12 rue des Lilas',
        codePostal: '75020',
        ville: 'Paris',
      }),
      surface: 45,
      type: 'appartement',
      anneeConstruction: 1985,
      lots: [
        Lot.creer({
          designation: 'Appartement principal',
          surface: 45,
          type: 'appartement',
          etage: null,
        }),
      ],
    });
  }

  it('persiste et retrouve un Bien avec son Lot', async () => {
    const bien = creerBienTest();

    await repo.enregistrer(bien);

    const tous = await repo.listerTous();
    expect(tous).toHaveLength(1);

    const retrouve = await repo.trouverParId(bien.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(bien.id);
    expect(retrouve!.lots).toHaveLength(1);
    expect(retrouve!.adresse.enLigne()).toBe('12 rue des Lilas, 75020 Paris');
  });

  it("listerTous exclut un Bien soft-deleted", async () => {
    const bien = creerBienTest();
    await repo.enregistrer(bien);

    await repo.supprimer(bien.id);

    const tous = await repo.listerTous();
    expect(tous).toHaveLength(0);
  });
});
