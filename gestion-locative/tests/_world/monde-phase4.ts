import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { World } from '@cucumber/cucumber';
import Database from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';

import { ClockFixe } from '../../src/domain/_shared/clock.js';
import type {
  BienId,
  JustificatifId,
  LocataireId,
} from '../../src/domain/_shared/identifiants.js';
import { appliquerToutesMigrations } from '../../src/infrastructure/db/database.js';
import type { DB } from '../../src/infrastructure/db/kysely-types.js';
import { creerApp } from '../../src/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

interface CookieJar {
  [name: string]: string;
}

export interface MondePhase4 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  clockIso: string;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
  bienId: BienId | null;
  locataireId: LocataireId | null;
  justificatifId: JustificatifId | null;
  tmpStorageDir: string | null;
}

export function extraireCookies(
  headers: Record<string, string | string[] | undefined>,
  jar: CookieJar,
): void {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    jar[name] = value;
  }
}

export function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export async function initialiserMondePhase4(
  monde: MondePhase4,
  clockIso: string,
): Promise<void> {
  process.env['SESSION_SECRET'] =
    'test-secret-for-cucumber-tests-32chars!!';
  monde.tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-phase4-'));
  process.env['GESTION_LOCATIVE_DATA_DIR'] = monde.tmpStorageDir;

  monde.clockIso = clockIso;
  monde.sqlite = new Database(':memory:');
  monde.db = new Kysely<DB>({
    dialect: new SqliteDialect({ database: monde.sqlite }),
  });
  await appliquerToutesMigrations(monde.db, monde.sqlite, MIGRATIONS_DIR);
  const clock = ClockFixe.du(clockIso);
  monde.app = await creerApp(monde.db, { clock });

  monde.dernierStatut = 0;
  monde.derniereUrl = '';
  monde.dernierCorps = '';
  monde.cookies = {};
  monde.bienId = null;
  monde.locataireId = null;
  monde.justificatifId = null;
}

export async function fermerMondePhase4(monde: MondePhase4): Promise<void> {
  if (monde.app) await monde.app.close();
  if (monde.db) await monde.db.destroy();
  if (monde.tmpStorageDir) {
    fs.rmSync(monde.tmpStorageDir, { recursive: true, force: true });
    monde.tmpStorageDir = null;
  }
}
