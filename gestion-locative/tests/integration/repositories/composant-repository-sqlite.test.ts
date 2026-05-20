/**
 * Tests d'intégration — ComposantRepositorySqlite + ValorisationFiscaleRepositorySqlite.
 *
 * In-memory SQLite + toutes les migrations appliquées.
 * Analog : justificatif-repository-sqlite.test.ts + bien-repository-sqlite.test.ts
 * Couvre : D-FIS-G1.1, G1.4, G1.5, G1.6
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import {
  ComposantRepositorySqlite,
  ValorisationFiscaleRepositorySqlite,
} from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import {
  unBienValide,
} from '../../_builders/patrimoine.js';
import {
  unComposantGrosOeuvre,
  unComposantMobilier,
  uneValorisationFiscale,
} from '../../_builders/fiscalite.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import { Temporal as TemporalNs } from '@js-temporal/polyfill';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('ComposantRepositorySqlite + ValorisationFiscaleRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bienRepo: BienRepositorySqlite;
  let composantRepo: ComposantRepositorySqlite;
  let valorisationRepo: ValorisationFiscaleRepositorySqlite;
  let bienId: BienId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    bienRepo = new BienRepositorySqlite(db);
    composantRepo = new ComposantRepositorySqlite(db);
    valorisationRepo = new ValorisationFiscaleRepositorySqlite(db);

    // Préparer un Bien persisté (FK bien_id requise)
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('Test 1 : enregistrerBatch 6 composants → listerActifsParBien retourne les 6', async () => {
    const today = Temporal.PlainDate.from('2026-03-15');
    const dateAcq = today;

    const composants = [
      Composant.creer({ bienId, type: 'terrain', montantHt: Money.fromEuros(20_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'gros_oeuvre', montantHt: Money.fromEuros(130_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'toiture_facade', montantHt: Money.fromEuros(25_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'installations_techniques', montantHt: Money.fromEuros(12_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'agencements_interieurs', montantHt: Money.fromEuros(8_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'mobilier', montantHt: Money.fromEuros(5_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
    ];

    await composantRepo.enregistrerBatch(composants);

    const actifs = await composantRepo.listerActifsParBien(bienId, today);
    expect(actifs).toHaveLength(6);

    const types = actifs.map((c) => c.type).sort();
    expect(types).toEqual([
      'agencements_interieurs',
      'gros_oeuvre',
      'installations_techniques',
      'mobilier',
      'terrain',
      'toiture_facade',
    ]);
  });

  it('Test 2 : sortir gros_oeuvre + re-enregistrer → listerActifsParBien après dateSortie retourne 5', async () => {
    const dateAcq = Temporal.PlainDate.from('2026-03-15');
    const dateSortie = Temporal.PlainDate.from('2026-06-01');
    const today = Temporal.PlainDate.from('2026-07-01'); // après la sortie

    const grossOeuvre = Composant.creer({ bienId, type: 'gros_oeuvre', montantHt: Money.fromEuros(130_000), dateAcquisition: dateAcq, origineKind: 'initial' });
    const autresComposants = [
      Composant.creer({ bienId, type: 'terrain', montantHt: Money.fromEuros(20_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'toiture_facade', montantHt: Money.fromEuros(25_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'installations_techniques', montantHt: Money.fromEuros(12_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'agencements_interieurs', montantHt: Money.fromEuros(8_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
      Composant.creer({ bienId, type: 'mobilier', montantHt: Money.fromEuros(5_000), dateAcquisition: dateAcq, origineKind: 'initial' }),
    ];

    await composantRepo.enregistrerBatch([grossOeuvre, ...autresComposants]);

    // Sortir gros_oeuvre (copy-on-write)
    const grossOeuvreSorti = grossOeuvre.sortir('vente', dateSortie);
    await composantRepo.enregistrer(grossOeuvreSorti);

    // Vérifier : 5 actifs (gros_oeuvre sorti à 2026-06-01, today = 2026-07-01)
    const actifs = await composantRepo.listerActifsParBien(bienId, today);
    expect(actifs).toHaveLength(5);

    const types = actifs.map((c) => c.type);
    expect(types).not.toContain('gros_oeuvre');
  });

  it('Test 3 : ValorisationFiscaleRepositorySqlite.trouverParBien retourne la VF persistée', async () => {
    const vf = uneValorisationFiscale({ bienId });
    await valorisationRepo.enregistrer(vf);

    const found = await valorisationRepo.trouverParBien(bienId);

    expect(found).not.toBeNull();
    expect(found!.id).toBe(vf.id);
    expect(found!.bienId).toBe(bienId);
    expect(found!.prixAcquisition.egale(Money.fromEuros(216_000))).toBe(true);
    expect(found!.fraisNotaire.egale(Money.fromEuros(16_000))).toBe(true);
    expect(found!.fraisAgence.egale(Money.fromEuros(8_000))).toBe(true);
    expect(found!.quotePartTerrainRatio).toBeCloseTo(0.10, 5);
  });

  it('Test 4 : trouverParBien retourne null si pas de VF pour ce bien', async () => {
    const autreId = crypto.randomUUID() as BienId;
    const result = await valorisationRepo.trouverParBien(autreId);
    expect(result).toBeNull();
  });
});
