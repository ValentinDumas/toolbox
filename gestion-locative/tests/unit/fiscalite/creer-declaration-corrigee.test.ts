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
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
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
