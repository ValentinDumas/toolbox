import { Before, After, type World } from '@cucumber/cucumber';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../src/infrastructure/db/database.js';
import { creerApp } from '../../src/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

interface CookieJar {
  [name: string]: string;
}

export interface MondePhase2 extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
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

Before(async function (this: MondePhase2) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });

  // Apply migrations sequentially in alphabetical order
  const fichiersMigration = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const fichier of fichiersMigration) {
    const cheminFichier = path.join(MIGRATIONS_DIR, fichier);
    await appliquerMigrationsBrutes(this.db, this.sqlite, cheminFichier);
  }

  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
});

After(async function (this: MondePhase2) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});
