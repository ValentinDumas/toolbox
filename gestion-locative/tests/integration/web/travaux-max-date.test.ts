/**
 * G-DATE-01 — vérification de l'attribut HTML5 max=today sur les inputs date
 * des formulaires travaux (création et clôture).
 *
 * Les 2 inputs date doivent contenir max=<date courante> pour feedback navigateur immédiat.
 * locals.today est injecté globalement par le preHandler main.ts:159-178.
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';

import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unTicketTravauxValide } from '../../_builders/travaux.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('G-DATE-01 — attribut HTML5 max=today sur les inputs date travaux', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let tmpDir: string;
  let bienId: string;
  let ticketId: string;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-travaux-max-date-32c!!';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-travaux-max-date-'));
    process.env['GESTION_LOCATIVE_DATA_DIR'] = tmpDir;

    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    const clock = ClockFixe.du('2026-05-19');
    app = await creerApp(db, { clock });

    // Seed : Bien + Ticket ouvert
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;

    const ticketRepo = new TicketTravauxRepositorySqlite(db);
    const ticket = TicketTravaux.creer(
      unTicketTravauxValide({
        bienId: bien.id as BienId,
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
      }),
      Temporal.PlainDate.from('2026-05-19'),
    );
    await ticketRepo.enregistrer(ticket);
    ticketId = ticket.id;
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('GET /travaux/nouveau?bienId=... contient input dateOuverture avec max="2026-05-19"', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/travaux/nouveau?bienId=${bienId}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('max="2026-05-19"');
    // Vérifier que l'input dateOuverture spécifiquement a l'attribut max
    expect(res.body).toMatch(/id="dateOuverture"[^>]*max="2026-05-19"|max="2026-05-19"[^>]*id="dateOuverture"/);
  });

  it('GET /travaux/:id contient input dateCloture avec max="2026-05-19" si ticket ouvert', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/travaux/${ticketId}`,
    });
    expect(res.statusCode).toBe(200);
    // Vérifier que le form de clôture a l'attribut max sur dateCloture
    expect(res.body).toContain('max="2026-05-19"');
    expect(res.body).toMatch(/id="dateCloture"[^>]*max="2026-05-19"|max="2026-05-19"[^>]*id="dateCloture"/);
  });
});
