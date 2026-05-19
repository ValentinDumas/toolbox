/**
 * G-UX-03 — Pas de bouton "Ajouter un document" dupliqué sur /coffre vide.
 *
 * Règle :
 *  - coffre vide (total=0, filtresActifs=false) → 1 seul lien /coffre/upload
 *  - coffre vide avec filtre actif (total=0, filtresActifs=true) → header garde son bouton
 *    (l'empty-state filtré n'a pas de CTA — déjà le cas dans liste.ejs)
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

describe('G-UX-03 — pas de bouton dupliqué sur /coffre', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let tmpDir: string;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-coffre-empty-state-32chars!!';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-coffre-empty-'));
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

  it('GET /coffre — coffre vide initial → 1 seul lien /coffre/upload role=button', async () => {
    const res = await app.inject({ method: 'GET', url: '/coffre' });

    expect(res.statusCode).toBe(200);

    // Compter toutes les occurrences de href="/coffre/upload" role="button"
    // (les deux attributs peuvent être dans n'importe quel ordre)
    const hrefMatches = (res.body.match(/href="\/coffre\/upload"/g) ?? []).length;
    expect(hrefMatches).toBe(1);
  });

  it('GET /coffre?search=inexistant — filtre actif, aucun résultat → bouton header présent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/coffre?search=inexistant',
    });

    expect(res.statusCode).toBe(200);

    // Quand filtresActifs=true et total=0, le bouton du header doit être affiché
    const hrefMatches = (res.body.match(/href="\/coffre\/upload"/g) ?? []).length;
    expect(hrefMatches).toBeGreaterThanOrEqual(1);
  });
});
