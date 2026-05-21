/**
 * Tests d'intégration — DeclarationAnnuelleRepositorySqlite + DeclarationCorrigeeRepositorySqlite.
 *
 * Vérifie :
 *   - Insertion + round-trip DeclarationAnnuelle
 *   - trouverParBailleurExercice (figée check D-FIS-G2.5)
 *   - UNIQUE violation sur (bailleur_id, exercice) — double clôture interdite (T-05-06-01)
 *   - listerParBailleur ordonnée par exercice DESC
 *   - N corrections successives append-only (D-FIS-G4.4)
 *   - listerParDeclarationOriginale ordonnée par creeLe DESC
 *
 * @tags @phase5 @fis-06 integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { DeclarationCorrigeeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-corrigee-repository-sqlite.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { DeclarationCorrigee } from '../../../src/domain/fiscalite/declaration-corrigee.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { unBailleurValide } from '../../_builders/identite.js';
import type { BailleurId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

function chargesVides() {
  return {
    non_qualifie: Money.zero(),
    entretien_reparation: Money.fromEuros(1_000),
    amelioration: Money.zero(),
    charge_courante_periodique: Money.zero(),
    non_deductible: Money.zero(),
  } as const;
}

describe('DeclarationAnnuelleRepositorySqlite — append-only strict (D-FIS-G4.2)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let declRepo: DeclarationAnnuelleRepositorySqlite;
  let corrRepo: DeclarationCorrigeeRepositorySqlite;
  let bailleurId: BailleurId;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    declRepo = new DeclarationAnnuelleRepositorySqlite(db);
    corrRepo = new DeclarationCorrigeeRepositorySqlite(db);

    // Créer le bailleur singleton requis par la FK
    const bailleurRepo = new BailleurRepositorySqlite(db);
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);
    bailleurId = bailleur.id;
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  // ─── DeclarationAnnuelle ────────────────────────────────────────────────────

  it('enregistrer + trouverParId — round-trip complet', async () => {
    // recettes < 23k → revenusFoyerSnapshot non requis
    const decl = DeclarationAnnuelle.creer({
      bailleurId,
      exercice: 2026,
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(20_000),
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      composantsSnapshot: '[]',
      clotureLe: Temporal.PlainDate.from('2026-12-31'),
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });

    await declRepo.enregistrer(decl);

    const lu = await declRepo.trouverParId(decl.id);
    expect(lu).not.toBeNull();
    expect(lu!.exercice).toBe(2026);
    expect(lu!.regimeApplique).toBe('micro_bic');
    expect(lu!.recettesTotales.toCentimes()).toBe(2_000_000n); // 20 000 €
    expect(lu!.statutLmnpLmp).toBe('lmnp_confirme');
    expect(lu!.composantsSnapshot).toBe('[]');
    expect(lu!.clotureLe.toString()).toBe('2026-12-31');
  });

  it('trouverParBailleurExercice retourne la déclaration pour (bailleur, exercice)', async () => {
    const decl = DeclarationAnnuelle.creer({
      bailleurId,
      exercice: 2026,
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(20_000),
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      composantsSnapshot: '[]',
      clotureLe: Temporal.PlainDate.from('2026-12-31'),
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });

    await declRepo.enregistrer(decl);

    const lu = await declRepo.trouverParBailleurExercice(bailleurId, 2026);
    expect(lu).not.toBeNull();
    expect(lu!.id).toBe(decl.id);

    // Exercice différent → null
    const absent = await declRepo.trouverParBailleurExercice(bailleurId, 2025);
    expect(absent).toBeNull();
  });

  it('2e enregistrer sur même (bailleur_id, exercice) → throw UNIQUE violation (T-05-06-01)', async () => {
    const decl1 = DeclarationAnnuelle.creer({
      bailleurId,
      exercice: 2026,
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(20_000), // < 23k → revenusFoyerSnapshot null ok
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      composantsSnapshot: '[]',
      clotureLe: Temporal.PlainDate.from('2026-12-31'),
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });

    const decl2 = DeclarationAnnuelle.creer({
      bailleurId,
      exercice: 2026, // MÊME exercice
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(18_000),
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      composantsSnapshot: '[]',
      clotureLe: Temporal.PlainDate.from('2026-12-31'),
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });

    await declRepo.enregistrer(decl1);
    // 2e insertion sur même (bailleur_id, exercice) → UNIQUE violation
    await expect(declRepo.enregistrer(decl2)).rejects.toThrow();
  });

  it('listerParBailleur retourne les déclarations triées exercice DESC', async () => {
    for (const exercice of [2025, 2027, 2026]) {
      const decl = DeclarationAnnuelle.creer({
        bailleurId,
        exercice,
        regimeApplique: 'micro_bic',
        recettesTotales: Money.fromEuros(20_000),
        chargesQualifieesParCategorie: chargesVides(),
        dotationAmortissement: Money.zero(),
        ardGenere: Money.zero(),
        ardConsomme: Money.zero(),
        revenusFoyerSnapshot: null,
        statutLmnpLmp: 'lmnp_confirme',
        composantsSnapshot: '[]',
        clotureLe: Temporal.PlainDate.from(`${exercice}-12-31`),
        seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
      });
      await declRepo.enregistrer(decl);
    }

    const liste = await declRepo.listerParBailleur(bailleurId);
    expect(liste).toHaveLength(3);
    expect(liste[0]!.exercice).toBe(2027);
    expect(liste[1]!.exercice).toBe(2026);
    expect(liste[2]!.exercice).toBe(2025);
  });

  // ─── DeclarationCorrigee ────────────────────────────────────────────────────

  it('N corrections successives — toutes append, aucune ne modifie l\'originale (D-FIS-G4.4)', async () => {
    // Originale : recettes 20k → revenusFoyerSnapshot non requis (< 23k seuil LMP)
    const declOriginale = DeclarationAnnuelle.creer({
      bailleurId,
      exercice: 2026,
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(20_000),
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      composantsSnapshot: '[]',
      clotureLe: Temporal.PlainDate.from('2026-12-31'),
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });
    await declRepo.enregistrer(declOriginale);

    // Correction 1 : recettes corrigées 21k (encore < 23k → revenusFoyerSnapshot null ok)
    const corr1 = DeclarationCorrigee.creer({
      declarationOriginaleId: declOriginale.id,
      motif: 'Oubli recettes mois de mars',
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(21_000),
      chargesQualifieesParCategorie: chargesVides(),
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      creeLe: Temporal.PlainDateTime.from('2027-01-10T10:00:00'),
    });
    await corrRepo.enregistrer(corr1);

    // Correction 2
    const corr2 = DeclarationCorrigee.creer({
      declarationOriginaleId: declOriginale.id,
      motif: 'Correction charges — facture retrouvée',
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(21_000),
      chargesQualifieesParCategorie: {
        ...chargesVides(),
        entretien_reparation: Money.fromEuros(2_000),
      },
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: null,
      statutLmnpLmp: 'lmnp_confirme',
      creeLe: Temporal.PlainDateTime.from('2027-02-05T14:30:00'),
    });
    await corrRepo.enregistrer(corr2);

    // Vérifier N corrections
    const corrections = await corrRepo.listerParDeclarationOriginale(declOriginale.id);
    expect(corrections).toHaveLength(2);
    // Ordonnées par creeLe DESC
    expect(corrections[0]!.creeLe.toString()).toContain('2027-02-05');
    expect(corrections[1]!.creeLe.toString()).toContain('2027-01-10');

    // Vérifier que l'originale est INTACTE
    const originaleLue = await declRepo.trouverParId(declOriginale.id);
    expect(originaleLue!.recettesTotales.toCentimes()).toBe(2_000_000n); // 20 000 € inchangé
  });
});
