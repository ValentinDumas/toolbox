import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { Diagnostic } from '../../../src/domain/patrimoine/diagnostic.js';
import {
  unBienValide,
  unDiagnosticDpeValide,
  unDiagnosticGazValide,
  unDiagnosticElecValide,
} from '../../_builders/patrimoine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BienRepositorySqlite — diagnostics', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: BienRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new BienRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  // T21 : roundtrip complet avec 3 diagnostics
  it('T21 : persiste et retrouve un Bien avec 3 diagnostics (DPE, gaz, élec)', async () => {
    const bien = unBienValide();
    const dpe = unDiagnosticDpeValide({ classeDpe: 'D' });
    const gaz = unDiagnosticGazValide();
    const elec = unDiagnosticElecValide();

    const bienAvecDiags = bien
      .ajouterDiagnostic(dpe)
      .ajouterDiagnostic(gaz)
      .ajouterDiagnostic(elec);

    await repo.enregistrer(bienAvecDiags);

    const retrouve = await repo.trouverParId(bien.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.diagnostics).toHaveLength(3);
    expect(retrouve!.classeDpe).toBe('D');
    // Triés par date_emission desc → tous ont la même date ici, ordre stable
    const types = retrouve!.diagnostics.map((d) => d.type);
    expect(types).toContain('dpe');
    expect(types).toContain('gaz');
    expect(types).toContain('elec');
  });

  // T22 : 2 DPE successifs → Bien.classeDpe = dernier
  it('T22 : 2 DPE successifs → classeDpe = dernier DPE ajouté', async () => {
    const bien = unBienValide();
    const dpe1 = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from('2024-01-01'),
      classeDpe: 'D',
    });
    const dpe2 = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from('2025-06-01'),
      classeDpe: 'C',
    });

    const bienAvec1 = bien.ajouterDiagnostic(dpe1);
    await repo.enregistrer(bienAvec1);

    const bienAvec2 = bienAvec1.ajouterDiagnostic(dpe2);
    await repo.enregistrer(bienAvec2);

    const retrouve = await repo.trouverParId(bien.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.classeDpe).toBe('C');
    expect(retrouve!.diagnostics).toHaveLength(2);
  });

  // T23 : modifier adresse sans toucher diagnostics → diagnostics préservés
  it('T23 : modifier adresse préserve les diagnostics (transaction purge+réinsert atomique)', async () => {
    const bien = unBienValide();
    const dpe = unDiagnosticDpeValide({ classeDpe: 'B' });
    const bienAvecDpe = bien.ajouterDiagnostic(dpe);

    await repo.enregistrer(bienAvecDpe);

    // Modifier adresse sans toucher diagnostics
    const bienModifie = bienAvecDpe.modifier({ type: 'maison' });
    await repo.enregistrer(bienModifie);

    const retrouve = await repo.trouverParId(bien.id);
    expect(retrouve).not.toBeNull();
    expect(retrouve!.diagnostics).toHaveLength(1);
    expect(retrouve!.classeDpe).toBe('B');
    expect(retrouve!.type).toBe('maison');
  });
});
