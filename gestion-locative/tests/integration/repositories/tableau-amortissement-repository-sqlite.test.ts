/**
 * Tests d'intégration — TableauAmortissementRepositorySqlite.
 *
 * Vérifie le comportement append-only strict (T-05-04-02) :
 *   - enregistrerBatch insère sans onConflict
 *   - 2e batch sur même (bien_id, composant_id, exercice) → UNIQUE violation
 *   - dernierArdCumule retourne la valeur SYNTHESE_BIEN la plus récente
 *   - listerParBienExercice retourne COMPOSANT + SYNTHESE_BIEN
 *
 * @tags @phase5 @fis-04 integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { AmortissementExercice } from '../../../src/domain/fiscalite/amortissement-exercice.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { ComposantRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { BienId, ComposantId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

describe('TableauAmortissementRepositorySqlite — append-only strict (T-05-04-02)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let repo: TableauAmortissementRepositorySqlite;
  let bienId: BienId;
  let composantId1: ComposantId;
  let composantId2: ComposantId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    repo = new TableauAmortissementRepositorySqlite(db);

    // Créer un bien
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;

    // Créer 2 composants directement (gros_oeuvre + mobilier)
    const composantRepo = new ComposantRepositorySqlite(db);
    const dateAcq = Temporal.PlainDate.from('2026-01-01');

    const grosOeuvre = Composant.creer({
      bienId,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: dateAcq,
      origineKind: 'initial',
    });
    const mobilier = Composant.creer({
      bienId,
      type: 'mobilier',
      montantHt: Money.fromEuros(5_000),
      dateAcquisition: dateAcq,
      origineKind: 'initial',
    });

    await composantRepo.enregistrerBatch([grosOeuvre, mobilier]);
    composantId1 = grosOeuvre.id;
    composantId2 = mobilier.id;
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('enregistrerBatch insère 3 lignes (2 COMPOSANT + 1 SYNTHESE_BIEN)', async () => {
    const lignes = [
      AmortissementExercice.creer({
        bienId,
        composantId: composantId1,
        exercice: 2026,
        typeLigne: 'COMPOSANT',
        dotationTheorique: Money.fromEuros(5_000),
        dotationAppliquee: Money.fromEuros(5_000),
        ardGenere: Money.zero(),
      }),
      AmortissementExercice.creer({
        bienId,
        composantId: composantId2,
        exercice: 2026,
        typeLigne: 'COMPOSANT',
        dotationTheorique: Money.fromEuros(714),
        dotationAppliquee: Money.fromEuros(714),
        ardGenere: Money.zero(),
      }),
      AmortissementExercice.creer({
        bienId,
        composantId: null,
        exercice: 2026,
        typeLigne: 'SYNTHESE_BIEN',
        dotationTheorique: Money.fromEuros(5_714),
        dotationAppliquee: Money.fromEuros(5_714),
        ardGenere: Money.zero(),
        ardCumuleDisponible: Money.zero(),
        ardConsomme: Money.zero(),
      }),
    ];

    await repo.enregistrerBatch(lignes);

    const resultat = await repo.listerParBienExercice(bienId, 2026);
    expect(resultat).toHaveLength(3);
  });

  it('listerParBienExercice retourne COMPOSANT + SYNTHESE_BIEN avec round-trip correct', async () => {
    const lignes = [
      AmortissementExercice.creer({
        bienId,
        composantId: composantId1,
        exercice: 2026,
        typeLigne: 'COMPOSANT',
        dotationTheorique: Money.fromEuros(4_800),
        dotationAppliquee: Money.fromEuros(3_000),
        ardGenere: Money.fromEuros(1_800),
      }),
      AmortissementExercice.creer({
        bienId,
        composantId: null,
        exercice: 2026,
        typeLigne: 'SYNTHESE_BIEN',
        dotationTheorique: Money.fromEuros(4_800),
        dotationAppliquee: Money.fromEuros(3_000),
        ardGenere: Money.fromEuros(1_800),
        ardCumuleDisponible: Money.fromEuros(5_000),
        ardConsomme: Money.fromEuros(2_000),
      }),
    ];

    await repo.enregistrerBatch(lignes);

    const resultat = await repo.listerParBienExercice(bienId, 2026);
    expect(resultat).toHaveLength(2);

    const synthese = resultat.find((l) => l.typeLigne === 'SYNTHESE_BIEN');
    expect(synthese).toBeDefined();
    expect(synthese!.ardCumuleDisponible?.toCentimes()).toBe(500_000n); // 5 000 €
    expect(synthese!.ardConsomme?.toCentimes()).toBe(200_000n);          // 2 000 €
  });

  it('2e enregistrerBatch sur même (bienId, composantId, exercice) → throw UNIQUE violation (append-only strict, T-05-04-02)', async () => {
    const ligne = AmortissementExercice.creer({
      bienId,
      composantId: composantId1,
      exercice: 2026,
      typeLigne: 'COMPOSANT',
      dotationTheorique: Money.fromEuros(5_000),
      dotationAppliquee: Money.fromEuros(5_000),
      ardGenere: Money.zero(),
    });

    await repo.enregistrerBatch([ligne]);

    // La 2e insertion sur le même tuple DOIT échouer (T-05-04-02)
    const ligne2 = AmortissementExercice.creer({
      bienId,
      composantId: composantId1, // même composant
      exercice: 2026, // même exercice
      typeLigne: 'COMPOSANT',
      dotationTheorique: Money.fromEuros(5_000),
      dotationAppliquee: Money.fromEuros(5_000),
      ardGenere: Money.zero(),
    });

    await expect(repo.enregistrerBatch([ligne2])).rejects.toThrow();
  });

  it('dernierArdCumule retourne Money.zero() si aucun exercice précédent (premier exercice)', async () => {
    const ard = await repo.dernierArdCumule(bienId, 2026);
    expect(ard.toCentimes()).toBe(0n);
  });

  it('dernierArdCumule retourne l\'ARD cumulé disponible de la SYNTHESE_BIEN exercice N-1 (CGI art. 39 B)', async () => {
    // Insérer une SYNTHESE_BIEN pour exercice 2025
    const ligne2025 = AmortissementExercice.creer({
      bienId,
      composantId: null,
      exercice: 2025,
      typeLigne: 'SYNTHESE_BIEN',
      dotationTheorique: Money.fromEuros(5_000),
      dotationAppliquee: Money.fromEuros(0),
      ardGenere: Money.fromEuros(5_000),
      ardCumuleDisponible: Money.fromEuros(12_000), // ARD cumulé disponible au 31/12/2025
      ardConsomme: Money.fromEuros(3_000),
    });
    await repo.enregistrerBatch([ligne2025]);

    // dernierArdCumule pour exercice 2026 doit retourner l'ARD de 2025
    const ard = await repo.dernierArdCumule(bienId, 2026);
    expect(ard.toCentimes()).toBe(1_200_000n); // 12 000 €
  });
});
