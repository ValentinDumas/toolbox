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

/**
 * Active les PRAGMAs SQLite requis par l'application.
 *
 * `foreign_keys = ON` doit être appelé PAR CONNEXION — c'est un setting
 * per-connection en SQLite (cf. https://www.sqlite.org/foreignkeys.html#fk_enable).
 * Une migration ne peut PAS le persister pour les connexions futures.
 *
 * Conséquence : tout code qui ouvre une connexion SQLite (`new BetterSqlite3(...)`)
 * sans passer par `ouvrirDb` DOIT appeler `activerPragmas` explicitement, sous
 * peine de désactiver silencieusement la cascade D-113 et tous les CHECK FK.
 */
export function activerPragmas(sqlite: BetterSqlite3.Database): void {
  sqlite.pragma('foreign_keys = ON');
}

export function ouvrirDb(cheminFichier: string): ConnexionDb {
  const dossier = path.dirname(cheminFichier);
  fs.mkdirSync(dossier, { recursive: true });

  const sqlite = new BetterSqlite3(cheminFichier);
  activerPragmas(sqlite);
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

// Applique la migration SQL brute via better-sqlite3 exec (idempotent par nom de fichier).
// Accepte l'instance better-sqlite3 directement pour éviter l'accès aux internals Kysely.
export async function appliquerMigrationsBrutes(
  db: Kysely<DB>,
  sqlite: BetterSqlite3.Database,
  cheminSql: string,
): Promise<void> {
  const nomFichier = path.basename(cheminSql);

  // Idempotence : vérifie si cette migration a déjà été appliquée
  try {
    const cle = `migration_${nomFichier}`;
    const result = await db
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', cle)
      .executeTakeFirst();

    if (result?.valeur === 'appliquee') {
      return;
    }
  } catch {
    // Table meta inexistante — première exécution (migration 0001 uniquement)
  }

  const sqlContent = fs.readFileSync(cheminSql, 'utf-8');
  // better-sqlite3.exec() exécute plusieurs statements en une seule passe (synchrone)
  sqlite.exec(sqlContent);

  // Marquer la migration comme appliquée (seulement si la table meta existe déjà après exec)
  try {
    const cle = `migration_${nomFichier}`;
    await db
      .insertInto('meta')
      .values({ cle, valeur: 'appliquee' })
      .onConflict((oc) => oc.column('cle').doUpdateSet({ valeur: 'appliquee' }))
      .execute();

    // Rétro-compat : marquer aussi la clé legacy pour la migration 0001
    if (nomFichier === '0001_init.sql') {
      await db
        .insertInto('meta')
        .values({ cle: 'migrations_appliquees', valeur: '0001' })
        .onConflict((oc) => oc.column('cle').doUpdateSet({ valeur: '0001' }))
        .execute();
    }
  } catch {
    // Table meta pas encore disponible (ne devrait pas arriver après exec)
  }
}

// Applique toutes les migrations du répertoire dans l'ordre alphabétique.
// Utilisé par main.ts pour le démarrage de l'application.
export async function appliquerToutesMigrations(
  db: Kysely<DB>,
  sqlite: BetterSqlite3.Database,
  dossierMigrations: string,
): Promise<void> {
  const fichiers = fs
    .readdirSync(dossierMigrations)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const fichier of fichiers) {
    const cheminFichier = path.join(dossierMigrations, fichier);
    await appliquerMigrationsBrutes(db, sqlite, cheminFichier);
  }
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
