/**
 * Tests unitaires — Use case sortirComposant (D-FIS-G5.2, LF 2025 art. 84).
 *
 * RED phase : tests écrits avant l'implémentation.
 *
 * Sources : D-FIS-G5.2 (sortie composant — motif + dateSortie), LF 2025 art. 84
 * (réintégration amortissements gros œuvre dans la plus-value future — SIM-02 V1.1).
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { ComposantId, BienId } from '../../../src/domain/_shared/identifiants.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import type { ComposantRepository } from '../../../src/domain/fiscalite/composant-repository.js';
import { sortirComposant, ComposantIntrouvable } from '../../../src/application/fiscalite/sortir-composant.js';

const BIEN_ID = crypto.randomUUID() as BienId;
const COMPOSANT_ID = crypto.randomUUID() as ComposantId;
const DATE_ACQ = Temporal.PlainDate.from('2026-01-01');
const DATE_SORTIE = Temporal.PlainDate.from('2026-06-30');

function composantValide(): Composant {
  return Composant.creer({
    id: COMPOSANT_ID,
    bienId: BIEN_ID,
    type: 'gros_oeuvre',
    montantHt: Money.fromEuros(200_000),
    dateAcquisition: DATE_ACQ,
    origineKind: 'initial',
  });
}

function makeComposantRepo(composant: Composant | null): ComposantRepository {
  return {
    trouverParId: vi.fn().mockResolvedValue(composant),
    enregistrer: vi.fn().mockResolvedValue(undefined),
    enregistrerBatch: vi.fn().mockResolvedValue(undefined),
    listerActifsParBien: vi.fn().mockResolvedValue([]),
    listerParBien: vi.fn().mockResolvedValue([]),
    listerActifsPourBailleur: vi.fn().mockResolvedValue([]),
  };
}

describe('sortirComposant — use case (D-FIS-G5.2)', () => {
  it('Test 1 : composant introuvable → throw ComposantIntrouvable', async () => {
    const repo = makeComposantRepo(null);

    await expect(
      sortirComposant(
        { composantId: COMPOSANT_ID, motif: 'vente', dateSortie: DATE_SORTIE },
        { composantRepo: repo },
      ),
    ).rejects.toThrow(ComposantIntrouvable);
  });

  it('Test 2 : composant déjà sorti → propagation erreur InvariantViolated', async () => {
    // Composant déjà sorti (sortir() appelle Composant.creer → invariant check)
    const composantDejaSetup = composantValide();
    const composantDejaSort = composantDejaSetup.sortir('mise_au_rebut', DATE_SORTIE);
    const repo = makeComposantRepo(composantDejaSort);

    // Le use case propage l'erreur depuis composant.sortir()
    await expect(
      sortirComposant(
        { composantId: COMPOSANT_ID, motif: 'vente', dateSortie: DATE_SORTIE },
        { composantRepo: repo },
      ),
    ).rejects.toThrow(/déjà sorti/i);
  });

  it('Test 3 : sortie OK → composantRepo.enregistrer appelé avec dateSortie set', async () => {
    const composant = composantValide();
    const repo = makeComposantRepo(composant);

    await sortirComposant(
      { composantId: COMPOSANT_ID, motif: 'vente', dateSortie: DATE_SORTIE },
      { composantRepo: repo },
    );

    expect(repo.enregistrer).toHaveBeenCalledTimes(1);
    const composantEnregistre = (repo.enregistrer as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as Composant;
    expect(composantEnregistre.dateSortie?.toString()).toBe('2026-06-30');
    expect(composantEnregistre.motifSortie).toBe('vente');
    expect(composantEnregistre.id).toBe(COMPOSANT_ID);
  });
});
