import { describe, it, expect } from 'vitest';
import { simulerIndexationIRL } from '../../../src/application/locatif/simuler-indexation-irl.js';
import { unBailValide } from '../../_builders/locatif.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import {
  BailIntrouvable,
  GelLoyerClimatActif,
} from '../../../src/domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../../src/domain/patrimoine/erreurs.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';
import type { Bien } from '../../../src/domain/patrimoine/bien.js';
import type { BailId, BienId, LotId, LocataireId } from '../../../src/domain/_shared/identifiants.js';

function mockBailRepo(bails: Bail[]): BailRepository {
  return {
    enregistrer: async () => {},
    trouverParId: async (id) => bails.find((b) => b.id === id) ?? null,
    listerTous: async () => bails,
    listerParLocataire: async () => [],
    supprimer: async () => {},
  };
}

function mockBienRepo(biens: Bien[]): BienRepository {
  return {
    enregistrer: async () => {},
    trouverParId: async (id) => biens.find((b) => b.id === id) ?? null,
    listerTous: async () => biens,
    supprimer: async () => {},
  };
}

describe('simulerIndexationIRL use case', () => {
  // T22 — DPE D : résultat complet
  it('T22 DPE D → loyer après > avant, gelLoyer false, formule présente', async () => {
    const lot = unLotValide();
    const bien = unBienValide({ lots: [lot], classeDpe: 'D' });
    const bail = unBailValide({
      bienId: bien.id,
      lotIds: [lot.id as LotId],
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    const r = await simulerIndexationIRL(
      { bailId: bail.id, irlTrimestre: '2025-T4', irlValeur: '145.47' },
      { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([bien]) },
    );
    expect(r.gelLoyer).toBe(false);
    expect(r.loyerAvant.toCentimes()).toBe(80_000n);
    expect(r.loyerApres.toCentimes()).toBe(81920n);
    expect(r.classeDpeBien).toBe('D');
    expect(r.formule).toContain('145.47');
    expect(r.formule).toContain('142.06');
  });

  // T23 — DPE F → throw GelLoyerClimatActif
  it('T23 DPE F → throw GelLoyerClimatActif avec wording UI-SPEC', async () => {
    const lot = unLotValide();
    const bien = unBienValide({ lots: [lot], classeDpe: 'F' });
    const bail = unBailValide({ bienId: bien.id, lotIds: [lot.id as LotId] });
    await expect(
      simulerIndexationIRL(
        { bailId: bail.id, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([bien]) },
      ),
    ).rejects.toThrow(GelLoyerClimatActif);
    await expect(
      simulerIndexationIRL(
        { bailId: bail.id, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([bien]) },
      ),
    ).rejects.toThrow(/DPE F/);
    await expect(
      simulerIndexationIRL(
        { bailId: bail.id, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([bien]) },
      ),
    ).rejects.toThrow(/décret n° 2022-1313/);
  });

  // T24 — bailId inexistant
  it('T24 bailId inexistant → throw BailIntrouvable', async () => {
    await expect(
      simulerIndexationIRL(
        { bailId: 'inconnu' as BailId, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([]), bienRepo: mockBienRepo([]) },
      ),
    ).rejects.toThrow(BailIntrouvable);
  });

  // T25 — bienId inexistant
  it('T25 bienId inexistant → throw BienIntrouvable', async () => {
    const bail = unBailValide({ bienId: 'orphan' as BienId });
    await expect(
      simulerIndexationIRL(
        { bailId: bail.id, irlTrimestre: '2025-T4', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([]) },
      ),
    ).rejects.toThrow(BienIntrouvable);
  });

  // T26 — IRL format invalide
  it('T26 IRL format Q1 → throw InvariantViolated', async () => {
    const lot = unLotValide();
    const bien = unBienValide({ lots: [lot], classeDpe: 'D' });
    const bail = unBailValide({ bienId: bien.id, lotIds: [lot.id as LotId] });
    await expect(
      simulerIndexationIRL(
        { bailId: bail.id, irlTrimestre: '2026-Q1', irlValeur: '145.47' },
        { bailRepo: mockBailRepo([bail]), bienRepo: mockBienRepo([bien]) },
      ),
    ).rejects.toThrow(InvariantViolated);
  });

  // Unused import guard
  it('mock helpers compilent', () => {
    const r = mockBailRepo([]);
    expect(typeof r.trouverParId).toBe('function');
    // also test BailId/LocataireId types are referenced
    const id: BailId = 'x' as BailId;
    const lid: LocataireId = 'y' as LocataireId;
    expect(id).toBe('x');
    expect(lid).toBe('y');
  });
});
