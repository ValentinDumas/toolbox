import BetterSqlite3 from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { DB } from './kysely-types.js';

export interface ConnexionDb {
  db: Kysely<DB>;
  sqlite: BetterSqlite3.Database;
}

export function ouvrirDb(cheminFichier: string): ConnexionDb {
  const dossier = path.dirname(cheminFichier);
  fs.mkdirSync(dossier, { recursive: true });

  const sqlite = new BetterSqlite3(cheminFichier);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  return { db, sqlite };
}

export function cheminBaseParDefaut(): string {
  const platform = process.platform;

  let dossier: string;
  if (platform === 'darwin') {
    dossier = path.join(os.homedir(), 'Library', 'Application Support', 'gestion-locative');
  } else if (platform === 'win32') {
    dossier = path.join(process.env.APPDATA ?? os.homedir(), 'gestion-locative');
  } else {
    // Linux + autres
    dossier = path.join(os.homedir(), '.local', 'share', 'gestion-locative');
  }

  fs.mkdirSync(dossier, { recursive: true });
  return path.join(dossier, 'db.sqlite');
}

// Applique la migration SQL brute via better-sqlite3 exec (idempotent).
// Accepte l'instance better-sqlite3 directement pour éviter l'accès aux internals Kysely.
export async function appliquerMigrationsBrutes(
  db: Kysely<DB>,
  sqlite: BetterSqlite3.Database,
  cheminSql: string,
): Promise<void> {
  // Idempotence : si la table meta indique que 0001 est appliquée, skip
  try {
    const result = await db
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', 'migrations_appliquees')
      .executeTakeFirst();

    if (result?.valeur === '0001') {
      return;
    }
  } catch {
    // Table meta inexistante — première exécution
  }

  const sqlContent = fs.readFileSync(cheminSql, 'utf-8');
  // better-sqlite3.exec() exécute plusieurs statements en une seule passe (synchrone)
  sqlite.exec(sqlContent);

  // Marquer la migration comme appliquée
  await db
    .insertInto('meta')
    .values({ cle: 'migrations_appliquees', valeur: '0001' })
    .onConflict((oc) => oc.column('cle').doUpdateSet({ valeur: '0001' }))
    .execute();
}

export async function interfaceCli(args: string[]): Promise<void> {
  if (args.includes('migrate')) {
    const chemin = cheminBaseParDefaut();
    console.log(`Migration vers : ${chemin}`);
    const { db, sqlite } = ouvrirDb(chemin);
    const migrationsPath = new URL('../../../migrations/0001_init.sql', import.meta.url);
    await appliquerMigrationsBrutes(db, sqlite, migrationsPath.pathname);
    await db.destroy();
    console.log('Migration terminée.');
    process.exit(0);
  }
}

// Point d'entrée CLI : tsx src/infrastructure/db/database.ts migrate
if (import.meta.url === `file://${process.argv[1]}`) {
  await interfaceCli(process.argv.slice(2));
}
