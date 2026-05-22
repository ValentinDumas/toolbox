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
import type { BienId, BailleurId, ComposantId } from '../../../src/domain/_shared/identifiants.js';

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

  // ─── dernierArdCumuleBailleur (Plan 06 — cross-year ARD propagation CGI art. 39 B) ──────
  // Note : en V1 D-LOCK-2, le bailleurId n'est pas utilisé dans la requête (mono-bailleur).
  // On passe le bienId casté en BailleurId pour les tests (D-LOCK-2 simplification).

  const FAKE_BAILLEUR_ID = 'bailleur-test-001' as BailleurId;

  it('dernierArdCumuleBailleur — aucune SYNTHESE_BIEN → Money.zero() (premier exercice)', async () => {
    const ard = await repo.dernierArdCumuleBailleur(FAKE_BAILLEUR_ID, 2025);
    expect(ard.toCentimes()).toBe(0n);
  });

  it('dernierArdCumuleBailleur — 1 bien avec SYNTHESE_BIEN exercice 2025 ard 10 000 €', async () => {
    const ligne = AmortissementExercice.creer({
      bienId,
      composantId: null,
      exercice: 2025,
      typeLigne: 'SYNTHESE_BIEN',
      dotationTheorique: Money.fromEuros(50_000),
      dotationAppliquee: Money.fromEuros(40_000),
      ardGenere: Money.fromEuros(10_000),
      ardCumuleDisponible: Money.fromEuros(10_000),
      ardConsomme: Money.zero(),
    });
    await repo.enregistrerBatch([ligne]);

    const ard = await repo.dernierArdCumuleBailleur(FAKE_BAILLEUR_ID, 2025);
    expect(ard.toCentimes()).toBe(1_000_000n); // 10 000 €
  });

  it('dernierArdCumuleBailleur — mécanique SUM repo : 2 lignes SYNTHESE_BIEN distinctes agrègent à Σ (test mécanique, hors flux V1)', async () => {
    // Note : ce test verrouille la mécanique du SUM côté repo. En production V1 D-LOCK-2 (post-CR-03 fix),
    // cloturer-exercice n'insère QU'UNE seule SYNTHESE_BIEN par exercice (cf. test CR-03 ci-dessous).
    // Ce setup directement injecté en base teste donc la mécanique BigInt du SUM, pas le flux nominal V1.
    const bienRepo2 = new BienRepositorySqlite(db);
    const bien2 = unBienValide();
    await bienRepo2.enregistrer(bien2);
    const bienId2 = bien2.id;

    // SYNTHESE_BIEN bien 1 : 5 000 €
    const ligne1 = AmortissementExercice.creer({
      bienId,
      composantId: null,
      exercice: 2025,
      typeLigne: 'SYNTHESE_BIEN',
      dotationTheorique: Money.fromEuros(5_000),
      dotationAppliquee: Money.fromEuros(5_000),
      ardGenere: Money.zero(),
      ardCumuleDisponible: Money.fromEuros(5_000),
      ardConsomme: Money.zero(),
    });

    // SYNTHESE_BIEN bien 2 : 7 000 €
    const ligne2 = AmortissementExercice.creer({
      bienId: bienId2,
      composantId: null,
      exercice: 2025,
      typeLigne: 'SYNTHESE_BIEN',
      dotationTheorique: Money.fromEuros(7_000),
      dotationAppliquee: Money.fromEuros(7_000),
      ardGenere: Money.zero(),
      ardCumuleDisponible: Money.fromEuros(7_000),
      ardConsomme: Money.zero(),
    });

    await repo.enregistrerBatch([ligne1, ligne2]);

    const ard = await repo.dernierArdCumuleBailleur(FAKE_BAILLEUR_ID, 2025);
    expect(ard.toCentimes()).toBe(1_200_000n); // 5 000 + 7 000 = 12 000 €
  });

  // ─── dernierArdCumuleBailleur — multi-bien (CR-03) + precision BigInt (CR-01 derive) ──────
  // 05-VERIFICATION.md gap 2 (BLOCKER) + WARNING L172 :
  // - CR-03 : en V1 D-LOCK-2 mono-bailleur, l'ARD est bailleur-level → une seule SYNTHESE_BIEN par exercice
  //   suffit. dernierArdCumuleBailleur ne doit pas sur-additionner l'ARD par le nombre de biens.
  // - CR-01 derive : le SUM SQLite est lu via fn.sum<string> + BigInt(string), jamais via float.
  describe('dernierArdCumuleBailleur — multi-bien (CR-03) + precision BigInt (CR-01 derive)', () => {
    it('CR-03 — une seule SYNTHESE_BIEN par exercice → dernierArdCumuleBailleur retourne ardCumuleEnSortie tel quel, pas multiplié par le nombre de biens', async () => {
      // En V1 D-LOCK-2, cloturer-exercice ne doit insérer qu'une seule SYNTHESE_BIEN par exercice
      // portée par biensIds[0]. Le SUM repo sur cette unique ligne doit donc retourner la valeur exacte.
      // Setup : 2 biens en base mais UNE SEULE SYNTHESE_BIEN insérée pour exercice 2025.
      const bienRepo2 = new BienRepositorySqlite(db);
      const bien2 = unBienValide();
      await bienRepo2.enregistrer(bien2);

      const ligne = AmortissementExercice.creer({
        bienId, // porteur sentinelle (biensIds[0])
        composantId: null,
        exercice: 2025,
        typeLigne: 'SYNTHESE_BIEN',
        dotationTheorique: Money.fromEuros(500),
        dotationAppliquee: Money.fromEuros(500),
        ardGenere: Money.zero(),
        ardCumuleDisponible: Money.fromCentimes(50_000n), // 500 €
        ardConsomme: Money.zero(),
      });
      await repo.enregistrerBatch([ligne]);

      const ard = await repo.dernierArdCumuleBailleur(FAKE_BAILLEUR_ID, 2025);
      // Assertion : 50_000n centimes exact, pas 100_000n (qui serait le bug 2× du multi-bien)
      expect(ard.toCentimes()).toBe(50_000n);
    });

    it('CR-01 derive — précision BigInt : 100 lignes SYNTHESE_BIEN de 1 centime sur biens distincts agrègent à 100n exact (fn.sum<string>)', async () => {
      // Verrouille la mécanique du SUM en BigInt pur, indépendamment de la sémantique métier
      // (en V1 post-fix, l'usage normal ne génère qu'UNE SYNTHESE_BIEN par exercice).
      // Empêche un retour en arrière vers fn.sum<number> lors d'un refactor futur.
      const bienRepo = new BienRepositorySqlite(db);
      // 100 biens distincts + 100 lignes SYNTHESE_BIEN à 1 centime chacune sur le MÊME exercice
      const lignes: AmortissementExercice[] = [];
      for (let i = 0; i < 100; i++) {
        const bienExtra = unBienValide();
        await bienRepo.enregistrer(bienExtra);
        lignes.push(
          AmortissementExercice.creer({
            bienId: bienExtra.id,
            composantId: null,
            exercice: 2025,
            typeLigne: 'SYNTHESE_BIEN',
            dotationTheorique: Money.zero(),
            dotationAppliquee: Money.zero(),
            ardGenere: Money.zero(),
            ardCumuleDisponible: Money.fromCentimes(1n),
            ardConsomme: Money.zero(),
          }),
        );
      }
      await repo.enregistrerBatch(lignes);

      const ard = await repo.dernierArdCumuleBailleur(FAKE_BAILLEUR_ID, 2025);
      // Assertion : SUM(100 × 1n) = 100n exact (BigInt direct depuis la chaîne SQLite)
      expect(ard.toCentimes()).toBe(100n);
    });
  });
});
