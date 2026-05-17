import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { listerBailsIndexables } from '../../../src/application/locatif/lister-bails-indexables.js';
import { unBailValide } from '../../_builders/locatif.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';

function mockBailRepo(bails: Bail[]): BailRepository {
  return {
    enregistrer: async () => {},
    trouverParId: async (id) => bails.find((b) => b.id === id) ?? null,
    listerTous: async () => bails,
    listerParLocataire: async () => [],
    supprimer: async () => {},
  };
}

describe('listerBailsIndexables use case', () => {
  // T27 — A actif anniversaire atteint, B actif pas encore 1 an, C non actif
  it('T27 retourne uniquement les bails actifs avec anniversaire atteint', async () => {
    const A = unBailValide({
      dateDebut: Temporal.PlainDate.from('2025-01-01'),
    }).activer(Temporal.PlainDate.from('2025-01-01'), 1);
    const B = unBailValide({
      dateDebut: Temporal.PlainDate.from('2026-01-01'),
    }).activer(Temporal.PlainDate.from('2026-01-01'), 1);
    const C = unBailValide({
      dateDebut: Temporal.PlainDate.from('2025-01-01'),
    });
    const clock = ClockFixe.du('2026-06-01');

    const result = await listerBailsIndexables(
      { bailRepo: mockBailRepo([A, B, C]) },
      clock,
    );
    expect(result).toEqual([A.id]);
  });
});
