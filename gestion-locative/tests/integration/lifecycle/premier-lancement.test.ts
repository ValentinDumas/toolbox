import { describe, it, expect, beforeEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import {
  estPremierLancement,
  marquerWizardComplete,
} from '../../../src/infrastructure/lifecycle/premier-lancement.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = path.resolve(__dirname, '../../../migrations/0001_init.sql');

describe('premier-lancement lifecycle', () => {
  let db: Kysely<DB>;

  beforeEach(async () => {
    const sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerMigrationsBrutes(db, sqlite, MIGRATIONS_PATH);
  });

  it('estPremierLancement retourne true quand table meta vide', async () => {
    const result = await estPremierLancement(db);
    expect(result).toBe(true);
  });

  it('estPremierLancement retourne false après marquerWizardComplete', async () => {
    await marquerWizardComplete(db);
    const result = await estPremierLancement(db);
    expect(result).toBe(false);
  });

  it('marquerWizardComplete est idempotent (INSERT OR REPLACE)', async () => {
    await marquerWizardComplete(db);
    await marquerWizardComplete(db);
    const result = await estPremierLancement(db);
    expect(result).toBe(false);
    const rows = await db
      .selectFrom('meta')
      .selectAll()
      .where('cle', '=', 'wizard_complete')
      .execute();
    expect(rows.length).toBe(1);
    expect(rows[0]?.valeur).toBe('1');
  });
});
