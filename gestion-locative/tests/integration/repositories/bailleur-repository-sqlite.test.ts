import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { unBailleurValide, uneAdresseValide } from '../../_builders/identite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BailleurRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurRepo: BailleurRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

    // Apply migrations sequentially: 0001 then 0002
    const fichiersMigration = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const fichier of fichiersMigration) {
      const cheminFichier = path.join(MIGRATIONS_DIR, fichier);
      await appliquerMigrationsBrutes(db, sqlite, cheminFichier);
    }

    bailleurRepo = new BailleurRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('enregistrer + trouver() retourne le bailleur; trouver() sur DB vide retourne null', async () => {
    // DB vide — trouver() retourne null
    const absent = await bailleurRepo.trouver();
    expect(absent).toBeNull();

    // Enregistrer un bailleur
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);

    // Trouver retrouve le bailleur
    const retrouve = await bailleurRepo.trouver();
    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(bailleur.id);
    expect(retrouve!.nomComplet).toBe('Jean Dupont');
  });

  it('un 2e INSERT direct via Kysely (singleton_marker identique) rejette avec UNIQUE constraint', async () => {
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);

    // Tenter un 2e INSERT direct avec le même singleton_marker
    let erreur: Error | null = null;
    try {
      await db
        .insertInto('bailleur')
        .values({
          id: 'autre-id-' + Math.random(),
          singleton_marker: 'unique_bailleur',
          nom_complet: 'Autre Bailleur',
          rue: '1 rue Test',
          code_postal: '75001',
          ville: 'Paris',
        })
        .execute();
    } catch (e) {
      erreur = e as Error;
    }

    expect(erreur).not.toBeNull();
    expect(erreur!.message).toContain('UNIQUE constraint failed');
  });

  it('roundtrip Adresse via repository (rue, code_postal, ville préservés)', async () => {
    const bailleur = unBailleurValide({
      adresse: uneAdresseValide({ rue: '15 avenue Victor Hugo', codePostal: '75016', ville: 'Paris' }),
    });

    await bailleurRepo.enregistrer(bailleur);

    const retrouve = await bailleurRepo.trouver();
    expect(retrouve).not.toBeNull();
    expect(retrouve!.adresse.rue).toBe('15 avenue Victor Hugo');
    expect(retrouve!.adresse.codePostal).toBe('75016');
    expect(retrouve!.adresse.ville).toBe('Paris');
  });
});
