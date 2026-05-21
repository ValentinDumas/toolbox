/**
 * Tests TDD — use case creerDeclarationCorrigee.
 *
 * Couverture :
 *   Test 1 : declarationOriginaleId inexistant → throw DeclarationOriginaleAbsente
 *   Test 2 : corrections partielles → declCorrigee a les nouveaux montants + declOriginale INTACTE
 *   Test 3 : N corrections successives → N insertions append-only
 */

import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { creerDeclarationCorrigee, DeclarationOriginaleAbsente } from '../../../src/application/fiscalite/creer-declaration-corrigee.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { DeclarationCorrigee } from '../../../src/domain/fiscalite/declaration-corrigee.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const DECL_ID = crypto.randomUUID() as DeclarationAnnuelleId;

function makeDeclarationOriginale(): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    // Recettes sous le seuil LMP (23 000€) → revenusFoyerSnapshot peut être null
    recettesTotales: Money.fromEuros(20_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(2_000),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.zero(),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: null,
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

function makeDb() {
  const trxMock = {};
  return {
    transaction: () => ({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<void>) => {
        await fn(trxMock);
      }),
    }),
  };
}

describe('creerDeclarationCorrigee', () => {
  it('Test 1 : declarationOriginaleId inexistant → throw DeclarationOriginaleAbsente', async () => {
    const repos = {
      declRepo: { trouverParId: vi.fn().mockResolvedValue(null) },
      declCorrRepo: { enregistrer: vi.fn() },
    };

    await expect(
      creerDeclarationCorrigee(
        {
          declarationOriginaleId: DECL_ID,
          motif: 'Correction test',
          corrections: {},
        },
        repos as never,
        makeDb() as never,
      ),
    ).rejects.toThrow(DeclarationOriginaleAbsente);

    expect(repos.declCorrRepo.enregistrer).not.toHaveBeenCalled();
  });

  it('Test 2 : corrections partielles → declCorrigee a nouveaux montants + declOriginale intacte', async () => {
    const declOriginale = makeDeclarationOriginale();
    const inseredCorrections: unknown[] = [];

    const repos = {
      declRepo: { trouverParId: vi.fn().mockResolvedValue(declOriginale) },
      declCorrRepo: {
        enregistrer: vi.fn().mockImplementation(async (c: unknown) => {
          inseredCorrections.push(c);
        }),
      },
    };

    await creerDeclarationCorrigee(
      {
        declarationOriginaleId: DECL_ID,
        motif: 'Correction des recettes',
        corrections: { recettesTotalesEuros: 32_000 },
      },
      repos as never,
      makeDb() as never,
    );

    expect(inseredCorrections).toHaveLength(1);
    const corr = inseredCorrections[0] as { recettesTotales: Money; declarationOriginaleId: string };
    // Recettes corrigées (32 000 € = 3 200 000 centimes)
    expect(corr.recettesTotales.toSqliteInteger()).toBe(3_200_000);
    // declarationOriginaleId pointe vers l'originale
    expect(corr.declarationOriginaleId).toBe(DECL_ID);
    // declOriginale.enregistrer N'est PAS appelé (originale intouchée — T-05-06-09)
    expect((repos.declRepo as { enregistrer?: unknown }).enregistrer).toBeUndefined();
  });

  it('Test 2b : toutes corrections optionnelles fournies → valeurs corrigées prises (lignes 100-118)', async () => {
    const declOriginale = makeDeclarationOriginale();
    const inserted: unknown[] = [];
    const repos = {
      declRepo: { trouverParId: vi.fn().mockResolvedValue(declOriginale) },
      declCorrRepo: { enregistrer: vi.fn().mockImplementation(async (c: unknown) => inserted.push(c)) },
    };

    await creerDeclarationCorrigee(
      {
        declarationOriginaleId: DECL_ID,
        motif: 'Correction complète',
        corrections: {
          recettesTotalesEuros: 25_000,        // line 92 branch (provided)
          dotationAmortissementEuros: 1_000,    // line 99-100 branch (provided)
          ardGenereEuros: 500,                  // line 103-105 branch (provided)
          ardConsommeEuros: 200,                // line 108-110 branch (provided)
          revenusFoyerSnapshotEuros: 50_000,    // line 113-116 branch (provided, not null)
          regimeApplique: 'reel' as const,      // line 123 branch (provided)
          statutLmnpLmp: 'lmnp_confirme' as const, // line 124 branch (provided)
        },
      },
      repos as never,
      makeDb() as never,
    );

    const corr = inserted[0] as {
      recettesTotales: Money;
      dotationAmortissement: Money;
      ardGenere: Money;
      ardConsomme: Money;
      revenusFoyerSnapshot: Money | null;
      regimeApplique: string;
      statutLmnpLmp: string;
    };
    expect(corr.recettesTotales.toSqliteInteger()).toBe(2_500_000);
    expect(corr.dotationAmortissement.toSqliteInteger()).toBe(100_000);
    expect(corr.ardGenere.toSqliteInteger()).toBe(50_000);
    expect(corr.ardConsomme.toSqliteInteger()).toBe(20_000);
    expect(corr.revenusFoyerSnapshot?.toSqliteInteger()).toBe(5_000_000);
    expect(corr.regimeApplique).toBe('reel');
    expect(corr.statutLmnpLmp).toBe('lmnp_confirme');
  });

  it('Test 2c : revenusFoyerSnapshotEuros=null explicite → null dans correction (ligne 115-116)', async () => {
    const declOriginale = makeDeclarationOriginale();
    const inserted: unknown[] = [];
    const repos = {
      declRepo: { trouverParId: vi.fn().mockResolvedValue(declOriginale) },
      declCorrRepo: { enregistrer: vi.fn().mockImplementation(async (c: unknown) => inserted.push(c)) },
    };

    await creerDeclarationCorrigee(
      {
        declarationOriginaleId: DECL_ID,
        motif: 'Effacer revenus foyer',
        corrections: { revenusFoyerSnapshotEuros: null },
      },
      repos as never,
      makeDb() as never,
    );

    const corr = inserted[0] as { revenusFoyerSnapshot: Money | null };
    // null explicite → corrigée = null (pas l'original)
    expect(corr.revenusFoyerSnapshot).toBeNull();
  });

  it('Test 3 : N corrections successives → N insertions append-only', async () => {
    const declOriginale = makeDeclarationOriginale();
    const inseredCount = { n: 0 };

    const repos = {
      declRepo: { trouverParId: vi.fn().mockResolvedValue(declOriginale) },
      declCorrRepo: {
        enregistrer: vi.fn().mockImplementation(async () => {
          inseredCount.n++;
        }),
      },
    };

    const motifs = ['Correction 1', 'Correction 2', 'Correction 3'];
    for (const motif of motifs) {
      await creerDeclarationCorrigee(
        { declarationOriginaleId: DECL_ID, motif, corrections: {} },
        repos as never,
        makeDb() as never,
      );
    }

    expect(inseredCount.n).toBe(3);
    // trouverParId appelé 3 fois (une par correction)
    expect(repos.declRepo.trouverParId).toHaveBeenCalledTimes(3);
  });
});

// ─── Couverture domaine : DeclarationCorrigee.creer + toProps ──────────────────

describe('DeclarationCorrigee — invariants domaine + toProps (lignes 78-114)', () => {
  const ORIG_ID = crypto.randomUUID() as DeclarationAnnuelleId;

  it('motif vide → throw InvariantViolated (ligne 78-79)', () => {
    expect(() =>
      DeclarationCorrigee.creer({
        declarationOriginaleId: ORIG_ID,
        motif: '   ', // blank
        regimeApplique: 'micro_bic',
        recettesTotales: Money.fromEuros(10_000),
        chargesQualifieesParCategorie: {
          entretien_reparation: Money.zero(),
          amelioration: Money.zero(),
          charge_courante_periodique: Money.zero(),
          non_deductible: Money.zero(),
          non_qualifie: Money.zero(),
        },
        dotationAmortissement: Money.zero(),
        ardGenere: Money.zero(),
        ardConsomme: Money.zero(),
        revenusFoyerSnapshot: null,
        statutLmnpLmp: 'lmnp_confirme',
        creeLe: Temporal.PlainDateTime.from('2026-12-31T10:00:00'),
      }),
    ).toThrow(InvariantViolated);
  });

  it('toProps() retourne toutes les propriétés pour persistance (lignes 99-113)', () => {
    const creeLe = Temporal.PlainDateTime.from('2026-12-31T10:00:00');
    const corr = DeclarationCorrigee.creer({
      declarationOriginaleId: ORIG_ID,
      motif: 'Correction recettes',
      regimeApplique: 'micro_bic',
      recettesTotales: Money.fromEuros(15_000),
      chargesQualifieesParCategorie: {
        entretien_reparation: Money.fromEuros(1_000),
        amelioration: Money.zero(),
        charge_courante_periodique: Money.zero(),
        non_deductible: Money.zero(),
        non_qualifie: Money.zero(),
      },
      dotationAmortissement: Money.zero(),
      ardGenere: Money.zero(),
      ardConsomme: Money.zero(),
      revenusFoyerSnapshot: Money.fromEuros(30_000),
      statutLmnpLmp: 'lmnp_confirme',
      creeLe,
    });

    const props = corr.toProps();
    expect(props.id).toBe(corr.id);
    expect(props.declarationOriginaleId).toBe(ORIG_ID);
    expect(props.motif).toBe('Correction recettes');
    expect(props.regimeApplique).toBe('micro_bic');
    expect(props.recettesTotales.egale(Money.fromEuros(15_000))).toBe(true);
    expect(props.revenusFoyerSnapshot?.egale(Money.fromEuros(30_000))).toBe(true);
    expect(props.creeLe).toBe(creeLe);
  });
});

// ─── Couverture domaine : DeclarationAnnuelle invariants + toProps ─────────────

describe('DeclarationAnnuelle — invariants domaine + toProps (lignes 95-153)', () => {
  const BAILLEUR_ID_DA = crypto.randomUUID() as BailleurId;

  function chargesVides() {
    return {
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    };
  }

  it('exercice <= 0 → throw InvariantViolated (ligne 95-97)', () => {
    expect(() =>
      DeclarationAnnuelle.creer({
        bailleurId: BAILLEUR_ID_DA,
        exercice: 0,
        regimeApplique: 'micro_bic',
        recettesTotales: Money.fromEuros(10_000),
        chargesQualifieesParCategorie: chargesVides(),
        dotationAmortissement: Money.zero(),
        ardGenere: Money.zero(),
        ardConsomme: Money.zero(),
        revenusFoyerSnapshot: null,
        statutLmnpLmp: 'lmnp_confirme',
        composantsSnapshot: '[]',
        clotureLe: Temporal.PlainDate.from('2026-12-31'),
        seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
      }),
    ).toThrow(InvariantViolated);
  });

  it('recettes > seuil LMP et revenusFoyerSnapshot=null → throw InvariantViolated (lignes 100-107)', () => {
    expect(() =>
      DeclarationAnnuelle.creer({
        bailleurId: BAILLEUR_ID_DA,
        exercice: 2026,
        regimeApplique: 'micro_bic',
        recettesTotales: Money.fromEuros(24_000), // > 23k seuil LMP
        chargesQualifieesParCategorie: chargesVides(),
        dotationAmortissement: Money.zero(),
        ardGenere: Money.zero(),
        ardConsomme: Money.zero(),
        revenusFoyerSnapshot: null, // manquant
        statutLmnpLmp: 'lmnp_confirme',
        composantsSnapshot: '[]',
        clotureLe: Temporal.PlainDate.from('2026-12-31'),
        seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
      }),
    ).toThrow(InvariantViolated);
  });

  it('regime reel avec composantsSnapshot=[] → throw InvariantViolated (lignes 110-117)', () => {
    expect(() =>
      DeclarationAnnuelle.creer({
        bailleurId: BAILLEUR_ID_DA,
        exercice: 2026,
        regimeApplique: 'reel',
        recettesTotales: Money.fromEuros(100_000),
        chargesQualifieesParCategorie: chargesVides(),
        dotationAmortissement: Money.zero(),
        ardGenere: Money.zero(),
        ardConsomme: Money.zero(),
        revenusFoyerSnapshot: Money.fromEuros(60_000),
        statutLmnpLmp: 'lmnp_confirme',
        composantsSnapshot: '[]',
        clotureLe: Temporal.PlainDate.from('2026-12-31'),
        seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
      }),
    ).toThrow(InvariantViolated);
  });

  it('toProps() retourne toutes les propriétés pour persistance (lignes 137-153)', () => {
    const clotureLe = Temporal.PlainDate.from('2026-12-31');
    const decl = DeclarationAnnuelle.creer({
      bailleurId: BAILLEUR_ID_DA,
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
      clotureLe,
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });

    const props = decl.toProps();
    expect(props.id).toBe(decl.id);
    expect(props.bailleurId).toBe(BAILLEUR_ID_DA);
    expect(props.exercice).toBe(2026);
    expect(props.regimeApplique).toBe('micro_bic');
    expect(props.recettesTotales.egale(Money.fromEuros(20_000))).toBe(true);
    expect(props.revenusFoyerSnapshot).toBeNull();
    expect(props.statutLmnpLmp).toBe('lmnp_confirme');
    expect(props.clotureLe).toBe(clotureLe);
  });
});
