/**
 * G-UX-01 — Toggle radio rattachement : script vanilla présent dans upload.ejs.
 *
 * Vérifie que GET /coffre/upload retourne le HTML avec :
 *  - le style .field-disabled
 *  - la fonction applyState
 *  - l'écouteur d'événement sur input[name="rattachement"]
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('G-UX-01 — toggle radio rattachement', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let tmpDir: string;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-rattachement-toggle-32chars!!';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-rattachement-'));
    process.env['GESTION_LOCATIVE_DATA_DIR'] = tmpDir;

    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    const clock = ClockFixe.du('2026-05-19');
    app = await creerApp(db, { clock });
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /coffre/upload contient le script applyState et le style .field-disabled', async () => {
    const res = await app.inject({ method: 'GET', url: '/coffre/upload' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('field-disabled');
    expect(res.body).toContain('applyState');
    expect(res.body).toContain('input[name="rattachement"]');
  });
});
