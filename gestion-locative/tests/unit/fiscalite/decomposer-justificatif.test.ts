import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { decomposerJustificatif } from '../../../src/application/fiscalite/decomposer-justificatif.js';
import { ComposantsSommeIncoherente } from '../../../src/domain/fiscalite/erreurs.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId, JustificatifId } from '../../../src/domain/_shared/identifiants.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';

/**
 * Tests TDD — use case decomposerJustificatif (D-FIS-G2.6).
 *
 * Vérifie :
 *   - Σ enfants = parent → N enfants persistés + parent qualifié non_deductible en transaction
 *   - Σ enfants ≠ parent → throw ComposantsSommeIncoherente, aucune écriture
 */

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BIEN_A = crypto.randomUUID() as BienId;
const BIEN_B = crypto.randomUUID() as BienId;

function makeClock() {
  return { aujourdhui: () => TODAY };
}

describe('decomposerJustificatif', () => {
  it('parent introuvable → throw Error sans écriture (lignes 43-45)', async () => {
    const justificatifRepo = {
      trouverParId: vi.fn().mockResolvedValue(null),
      enregistrer: vi.fn(),
    };
    const db = { transaction: () => ({ execute: vi.fn() }) };

    await expect(
      decomposerJustificatif(
        { parentId: 'jus-inexistant' as JustificatifId, enfants: [] },
        { justificatifRepo: justificatifRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow('Justificatif introuvable');

    expect(justificatifRepo.enregistrer).not.toHaveBeenCalled();
  });

  it('Σ correct → N+1 persistés en transaction (parent non_deductible + N enfants)', async () => {
    const parent = unJustificatifNonQualifie({
      bienId: BIEN_A,
      montantTtc: Money.fromEuros(1000),
    });

    const updatedItems: unknown[] = [];
    const trxCalls: string[] = [];

    const justificatifRepo = {
      trouverParId: vi.fn().mockResolvedValue(parent),
      enregistrer: vi.fn().mockImplementation(async (j: unknown) => { updatedItems.push(j); }),
    };

    const db = {
      transaction: () => ({
        execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<void>) => {
          trxCalls.push('trx');
          await fn({});
        }),
      }),
    };

    const result = await decomposerJustificatif(
      {
        parentId: parent.id as JustificatifId,
        enfants: [
          { bienId: BIEN_A, montantTtc: Money.fromEuros(600), titre: 'Part bien A' },
          { bienId: BIEN_B, montantTtc: Money.fromEuros(400), titre: 'Part bien B' },
        ],
      },
      { justificatifRepo: justificatifRepo as never },
      makeClock(),
      db as never,
    );

    // Retourne les IDs des enfants
    expect(result).toHaveLength(2);
    // Transaction utilisée
    expect(trxCalls).toContain('trx');
    // Parent + 2 enfants persisted
    expect(justificatifRepo.enregistrer).toHaveBeenCalledTimes(3);
  });

  it('Σ incorrect → throw ComposantsSommeIncoherente, aucune écriture', async () => {
    const parent = unJustificatifNonQualifie({
      bienId: BIEN_A,
      montantTtc: Money.fromEuros(1000),
    });

    const justificatifRepo = {
      trouverParId: vi.fn().mockResolvedValue(parent),
      enregistrer: vi.fn(),
    };
    const trxExecute = vi.fn();
    const db = {
      transaction: () => ({ execute: trxExecute }),
    };

    await expect(
      decomposerJustificatif(
        {
          parentId: parent.id as JustificatifId,
          enfants: [
            { bienId: BIEN_A, montantTtc: Money.fromEuros(600), titre: 'Part A' },
            { bienId: BIEN_B, montantTtc: Money.fromEuros(300), titre: 'Part B' }, // 900 ≠ 1000
          ],
        },
        { justificatifRepo: justificatifRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow(ComposantsSommeIncoherente);

    // Aucune écriture
    expect(justificatifRepo.enregistrer).not.toHaveBeenCalled();
    expect(trxExecute).not.toHaveBeenCalled();
  });
});
