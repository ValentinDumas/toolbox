/**
 * Tests unitaires — activer-fiscalite-bien use case (D-FIS-G1.1, G1.3, G1.4).
 *
 * BDD outside-in : tests RED avant implémentation.
 * Stubs pour repos + clock + regleFiscale.
 * Sources : D-FIS-G1.1, G1.3, G1.4 + BOFIP-BIC-AMT-10-20 §110
 * Analog : tests/unit/encaissements/creer-encaissement.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type {
  BienId,
  BailleurId,
} from '../../../src/domain/_shared/identifiants.js';
import type { ComposantRepository, ValorisationFiscaleRepository } from '../../../src/domain/fiscalite/composant-repository.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import {
  activerFiscaliteBien,
  BienDejaActifFiscalement,
  type ActiverFiscaliteBienCommande,
} from '../../../src/application/fiscalite/activer-fiscalite-bien.js';
import { ComposantsSommeIncoherente } from '../../../src/domain/fiscalite/erreurs.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

function creerStubs() {
  const bienId = crypto.randomUUID() as BienId;
  const bien = unBienValide({ id: bienId });

  const bienRepo: BienRepository = {
    trouverParId: vi.fn().mockResolvedValue(bien),
    enregistrer: vi.fn().mockResolvedValue(undefined),
    listerTous: vi.fn().mockResolvedValue([]),
    supprimer: vi.fn().mockResolvedValue(undefined),
  } as unknown as BienRepository;

  const valorisationRepo: ValorisationFiscaleRepository = {
    enregistrer: vi.fn().mockResolvedValue(undefined),
    trouverParBien: vi.fn().mockResolvedValue(null),
    trouverParId: vi.fn().mockResolvedValue(null),
  };

  const composantRepo: ComposantRepository = {
    enregistrer: vi.fn().mockResolvedValue(undefined),
    enregistrerBatch: vi.fn().mockResolvedValue(undefined),
    trouverParId: vi.fn().mockResolvedValue(null),
    listerActifsParBien: vi.fn().mockResolvedValue([]),
    listerParBien: vi.fn().mockResolvedValue([]),
    listerActifsPourBailleur: vi.fn().mockResolvedValue([]),
  };

  // Mock transaction Kysely
  const db = {
    transaction: () => ({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<unknown>) => fn({})),
    }),
  } as unknown as import('kysely').Kysely<import('../../../src/infrastructure/db/kysely-types.js').DB>;

  const clock = ClockFixe.du('2026-03-15');

  return { bienId, bien, bienRepo, valorisationRepo, composantRepo, db, clock };
}

function cmdValide(bienId: BienId): ActiverFiscaliteBienCommande {
  // prixAcquisition = 200k
  // terrain = 10% × 200k = 20k
  // 5 amortissables Σ = 180k → total = 20k + 180k = 200k OK
  return {
    bienId,
    prixAcquisition: Money.fromEuros(200_000),
    dateAcquisition: Temporal.PlainDate.from('2026-03-15'),
    fraisNotaire: Money.fromEuros(16_000),
    fraisAgence: Money.fromEuros(8_000),
    quotePartTerrainRatio: 0.10,
    composantsAmortissables: [
      { type: 'gros_oeuvre', montantHt: Money.fromEuros(130_000) },
      { type: 'toiture_facade', montantHt: Money.fromEuros(25_000) },
      { type: 'installations_techniques', montantHt: Money.fromEuros(12_000) },
      { type: 'agencements_interieurs', montantHt: Money.fromEuros(8_000) },
      { type: 'mobilier', montantHt: Money.fromEuros(5_000) },
      // Σ = 180_000 + terrain(20_000) = 200_000 = prixAcquisition OK
    ],
  };
}

describe('activerFiscaliteBien — cas G1.3 (D-FIS-G1.3, D-FIS-G1.4)', () => {
  it('Test 1 : cas G1.3 exact — prix 200k + frais 24k + 5 amortissables → 6 composants persistés avec frais répartis', async () => {
    const { bienId, bienRepo, valorisationRepo, composantRepo, db, clock } = creerStubs();

    const result = await activerFiscaliteBien(
      cmdValide(bienId),
      { bienRepo, valorisationRepo, composantRepo },
      clock,
      REGLES_2026,
      db,
    );

    expect(result.valorisationId).toBeTruthy();
    expect(result.composantIds).toHaveLength(6); // 1 terrain + 5 amortissables
    expect(composantRepo.enregistrerBatch).toHaveBeenCalledTimes(1);
    expect(valorisationRepo.enregistrer).toHaveBeenCalledTimes(1);
  });

  it('Test 2 : Σ composants ≠ prix → throw ComposantsSommeIncoherente (D-FIS-G1.1)', async () => {
    const { bienId, bienRepo, valorisationRepo, composantRepo, db, clock } = creerStubs();

    const cmdIncoherente: ActiverFiscaliteBienCommande = {
      ...cmdValide(bienId),
      // Σ amortissables = 160k + terrain 10% = 20k → total = 180k ≠ 200k
      composantsAmortissables: [
        { type: 'gros_oeuvre', montantHt: Money.fromEuros(100_000) },
        { type: 'toiture_facade', montantHt: Money.fromEuros(30_000) },
        { type: 'installations_techniques', montantHt: Money.fromEuros(10_000) },
        { type: 'agencements_interieurs', montantHt: Money.fromEuros(10_000) },
        { type: 'mobilier', montantHt: Money.fromEuros(10_000) },
      ],
    };

    await expect(
      activerFiscaliteBien(cmdIncoherente, { bienRepo, valorisationRepo, composantRepo }, clock, REGLES_2026, db),
    ).rejects.toBeInstanceOf(ComposantsSommeIncoherente);
  });

  it('Test 3 : 2e appel sur même bien → throw BienDejaActifFiscalement (T-05-03-01)', async () => {
    const { bienId, bienRepo, valorisationRepo, composantRepo, db, clock } = creerStubs();
    const { uneValorisationFiscale } = await import('../../_builders/fiscalite.js');

    // Simuler que la valorisation existe déjà
    valorisationRepo.trouverParBien = vi.fn().mockResolvedValue(uneValorisationFiscale({ bienId }));

    await expect(
      activerFiscaliteBien(cmdValide(bienId), { bienRepo, valorisationRepo, composantRepo }, clock, REGLES_2026, db),
    ).rejects.toBeInstanceOf(BienDejaActifFiscalement);
  });

  it('Test 4 : quotePartTerrainRatio = 0.10 + prix 220k → terrain = 22k ; 5 amortissables Σ = 198k ; total 220k OK', async () => {
    const { bienId, bienRepo, valorisationRepo, composantRepo, db, clock } = creerStubs();

    // prixAcquisition = 220k, quotePartTerrain = 10% → terrain = 22k
    // 5 amortissables Σ = 198k → total = 22k + 198k = 220k OK
    const cmd: ActiverFiscaliteBienCommande = {
      bienId,
      prixAcquisition: Money.fromEuros(220_000),
      dateAcquisition: Temporal.PlainDate.from('2026-03-15'),
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.fromEuros(8_000),
      quotePartTerrainRatio: 0.10,
      composantsAmortissables: [
        { type: 'gros_oeuvre', montantHt: Money.fromEuros(140_000) },
        { type: 'toiture_facade', montantHt: Money.fromEuros(28_000) },
        { type: 'installations_techniques', montantHt: Money.fromEuros(15_000) },
        { type: 'agencements_interieurs', montantHt: Money.fromEuros(10_000) },
        { type: 'mobilier', montantHt: Money.fromEuros(5_000) },
        // Σ = 198_000 + terrain(22_000) = 220_000 = prixAcquisition OK
      ],
    };

    const result = await activerFiscaliteBien(cmd, { bienRepo, valorisationRepo, composantRepo }, clock, REGLES_2026, db);

    expect(result.composantIds).toHaveLength(6);
    expect(composantRepo.enregistrerBatch).toHaveBeenCalledTimes(1);
  });
});
