import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unLocataireValide } from '../../_builders/locatif.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_PATH = path.resolve(__dirname, '../../../migrations/0001_init.sql');

describe('LocataireRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: LocataireRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerMigrationsBrutes(db, sqlite, MIGRATIONS_PATH);
    repo = new LocataireRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('enregistrer + trouverParId roundtrip', async () => {
    const loc = unLocataireValide();
    await repo.enregistrer(loc);

    const retrouve = await repo.trouverParId(loc.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.id).toBe(loc.id);
    expect(retrouve!.nom).toBe('Dupont');
    expect(retrouve!.prenom).toBe('Marie');
    expect(retrouve!.email).toBe('marie@example.fr');
    expect(retrouve!.dateNaissance.toString()).toBe('1985-06-15');
    expect(retrouve!.lieuNaissance.commune).toBe('Paris');
    expect(retrouve!.lieuNaissance.pays).toBe('France');
    expect(retrouve!.nationalite).toBe('française');
    expect(retrouve!.telephone).toBe('0123456789');
    expect(retrouve!.adresseActuelle.rue).toBe('1 rue Test');
    expect(retrouve!.adresseActuelle.codePostal).toBe('75001');
    expect(retrouve!.adresseActuelle.ville).toBe('Paris');
  });

  it('enregistrer met à jour un Locataire existant', async () => {
    const loc = unLocataireValide();
    await repo.enregistrer(loc);

    const modifie = loc.modifier({ email: 'nouveau@example.fr' });
    await repo.enregistrer(modifie);

    const tous = await repo.listerTous();
    expect(tous).toHaveLength(1);
    expect(tous[0]!.email).toBe('nouveau@example.fr');
  });

  it('listerTous exclut un Locataire soft-deleted', async () => {
    const loc1 = unLocataireValide({ nom: 'Dupont' });
    const loc2 = unLocataireValide({ nom: 'Martin', email: 'martin@example.fr' });
    await repo.enregistrer(loc1);
    await repo.enregistrer(loc2);

    await repo.supprimer(loc1.id);

    const tous = await repo.listerTous();
    expect(tous).toHaveLength(1);
    expect(tous[0]!.nom).toBe('Martin');
  });

  it('supprimer (soft-delete) → trouverParId retourne null', async () => {
    const loc = unLocataireValide();
    await repo.enregistrer(loc);

    await repo.supprimer(loc.id);

    const retrouve = await repo.trouverParId(loc.id);
    expect(retrouve).toBeNull();
  });
});
