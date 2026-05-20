/**
 * Tests d'intégration — BailleurRepositorySqlite round-trip champs fiscaux Phase 5.
 *
 * Couverture (D-LOCK-2, D-FIS-G3.1, D-FIS-G5.4) :
 *   - Test 1 : creer bailleur avec regimeFiscal=null → enregistrer → trouver → propriétés null
 *   - Test 2 : modifier(regimeFiscal='reel', revenusActifs) → enregistrer → trouver → round-trip
 *   - Test 3 : modifier(fiscalitePremierAcces=PlainDateTime) → enregistrer → trouver → date round-trippée
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerMigrationsBrutes } from '../../../src/infrastructure/db/database.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailleurValide } from '../../_builders/identite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('BailleurRepositorySqlite — champs fiscaux Phase 5 (round-trip)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurRepo: BailleurRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });

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

  it('Test 1 : creer bailleur avec champs fiscaux null → round-trip null', async () => {
    const bailleur = unBailleurValide();
    // Les 3 champs fiscaux sont null par défaut
    expect(bailleur.regimeFiscal).toBeNull();
    expect(bailleur.revenusActifsAnnuelsCourant).toBeNull();
    expect(bailleur.fiscalitePremierAcces).toBeNull();

    await bailleurRepo.enregistrer(bailleur);
    const retrouve = await bailleurRepo.trouver();

    expect(retrouve).not.toBeNull();
    expect(retrouve!.regimeFiscal).toBeNull();
    expect(retrouve!.revenusActifsAnnuelsCourant).toBeNull();
    expect(retrouve!.fiscalitePremierAcces).toBeNull();
  });

  it('Test 2 : modifier(regimeFiscal="reel", revenusActifs=48 000 €) → centimes round-trippés', async () => {
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);

    const modifie = bailleur.modifier({
      regimeFiscal: 'reel',
      revenusActifsAnnuelsCourant: Money.fromEuros(48_000),
    });
    await bailleurRepo.enregistrer(modifie);

    const retrouve = await bailleurRepo.trouver();
    expect(retrouve).not.toBeNull();
    expect(retrouve!.regimeFiscal).toBe('reel');
    expect(retrouve!.revenusActifsAnnuelsCourant).not.toBeNull();
    expect(retrouve!.revenusActifsAnnuelsCourant!.toCentimes()).toBe(4_800_000n);
    expect(retrouve!.fiscalitePremierAcces).toBeNull();
  });

  it('Test 3 : modifier(fiscalitePremierAcces=PlainDateTime) → date round-trippée ISO 8601', async () => {
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);

    const dt = Temporal.PlainDateTime.from('2026-05-20T14:30:00');
    const modifie = bailleur.modifier({ fiscalitePremierAcces: dt });
    await bailleurRepo.enregistrer(modifie);

    const retrouve = await bailleurRepo.trouver();
    expect(retrouve).not.toBeNull();
    expect(retrouve!.fiscalitePremierAcces).not.toBeNull();
    // Round-trip ISO 8601 : Temporal.PlainDateTime.from(toString()) === original
    expect(retrouve!.fiscalitePremierAcces!.toString()).toBe('2026-05-20T14:30:00');
    expect(retrouve!.regimeFiscal).toBeNull();
    expect(retrouve!.revenusActifsAnnuelsCourant).toBeNull();
  });
});
