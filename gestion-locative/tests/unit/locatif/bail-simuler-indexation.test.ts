import { describe, it, expect } from 'vitest';
import { unBailValide, unIrlValide } from '../../_builders/locatif.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';

describe('Bail.simulerIndexation', () => {
  const irlRef = IRL.creer({ trimestre: '2024-T4', valeur: '142.06' });
  const irlNouveau = IRL.creer({ trimestre: '2025-T4', valeur: '145.47' });

  // T16 — DPE D : calcul banker → ~81920 centimes
  it('T16 DPE D → nouveau loyer 81920 centimes (banker)', () => {
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlNouveau, 'D');
    expect(r.gelLoyer).toBe(false);
    expect(r.nouveauLoyerHc.toCentimes()).toBe(81920n);
  });

  // T17 — DPE F : gel actif
  it('T17 DPE F → gelLoyer true, loyer inchangé', () => {
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlNouveau, 'F');
    expect(r.gelLoyer).toBe(true);
    expect(r.raison).toBe('gel_dpe');
    expect(r.nouveauLoyerHc.toCentimes()).toBe(80_000n);
  });

  // T18 — DPE G : gel actif idem
  it('T18 DPE G → gelLoyer true', () => {
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlNouveau, 'G');
    expect(r.gelLoyer).toBe(true);
    expect(r.nouveauLoyerHc.toCentimes()).toBe(80_000n);
  });

  // T19 — classeDpe null → traité comme A-E (pas de gel)
  it('T19 classeDpe null → gelLoyer false', () => {
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlNouveau, null);
    expect(r.gelLoyer).toBe(false);
    expect(r.nouveauLoyerHc.toCentimes()).toBe(81920n);
  });

  // T20 — IRL identique avant/après → ratio 1 → loyer inchangé
  it('T20 IRL identique → ratio 1 → loyer inchangé', () => {
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlRef, 'D');
    expect(r.nouveauLoyerHc.toCentimes()).toBe(80_000n);
  });

  // T21 — IRL baisse rare
  it('T21 IRL baisse → loyer diminue', () => {
    const irlBaisse = IRL.creer({ trimestre: '2025-T4', valeur: '140.00' });
    const bail = unBailValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: irlRef,
    });
    const r = bail.simulerIndexation(irlBaisse, 'D');
    expect(r.gelLoyer).toBe(false);
    expect(r.nouveauLoyerHc.toCentimes() < 80_000n).toBe(true);
  });

  // sanity-check builder import
  it('unIrlValide retourne 145.47', () => {
    expect(unIrlValide().valeur).toBe('145.47');
  });
});
