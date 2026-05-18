import type { World } from '@cucumber/cucumber';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../src/infrastructure/db/database.js';
import { creerApp } from '../../src/main.js';
import { ClockFixe } from '../../src/domain/_shared/clock.js';
import type { BienId, BailId, EtatDesLieuxId } from '../../src/domain/_shared/identifiants.js';
import type { DiagnosticId } from '../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

interface CookieJar {
  [name: string]: string;
}

export interface MondePhase3 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  clockIso: string;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
  bienId: BienId | null;
  diagnosticIds: DiagnosticId[];
  /** Phase 3 — plan 02 : EDL + mobilier */
  bailId: BailId | null;
  edlId: EtatDesLieuxId | null;
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

/**
 * Initialise le monde Phase 3 avec une ClockFixe (pour les tests déterministes).
 * À appeler dans le Before hook @phase3.
 */
export async function initialiserMondePhase3(monde: MondePhase3, clockIso: string): Promise<void> {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  monde.clockIso = clockIso;
  monde.sqlite = new Database(':memory:');
  activerPragmas(monde.sqlite);
  monde.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: monde.sqlite }) });
  await appliquerToutesMigrations(monde.db, monde.sqlite, MIGRATIONS_DIR);
  const clock = ClockFixe.du(clockIso);
  monde.app = await creerApp(monde.db, { clock });
  monde.dernierStatut = 0;
  monde.derniereUrl = '';
  monde.dernierCorps = '';
  monde.cookies = {};
  monde.bienId = null;
  monde.diagnosticIds = [];
  monde.bailId = null;
  monde.edlId = null;
}

/**
 * Ferme l'application et détruit la DB du monde Phase 3.
 */
export async function fermerMondePhase3(monde: MondePhase3): Promise<void> {
  if (monde.app) await monde.app.close();
  if (monde.db) await monde.db.destroy();
}
