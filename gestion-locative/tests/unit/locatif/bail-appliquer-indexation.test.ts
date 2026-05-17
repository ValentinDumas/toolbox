import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { unBailIndexableValide } from '../../_builders/locatif.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { Money } from '../../../src/domain/_shared/money.js';

describe('Bail.appliquerIndexation + pivoterIrlReference (Phase 3-04)', () => {
  it('T9: appliquerIndexation pivote irlReference et recalcule loyerHc', () => {
    const bail = unBailIndexableValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    const irlNouveau = IRL.creer({ trimestre: '2025-T4', valeur: '145.47' });
    const dateEffet = Temporal.PlainDate.from('2026-05-01');

    const modifie = bail.appliquerIndexation(irlNouveau, dateEffet);

    // banker rounding sur 80000 × (14547 / 14206) ≈ 81919.89 → 81920 centimes
    expect(modifie.loyerHc.toCentimes()).toBe(81_920n);
    expect(modifie.irlReference.egale(irlNouveau)).toBe(true);
    // Autres props préservées
    expect(modifie.id).toBe(bail.id);
    expect(modifie.dateDebut.equals(bail.dateDebut)).toBe(true);
    expect(modifie.dureeMois).toBe(bail.dureeMois);
    expect(modifie.modeCharges).toBe(bail.modeCharges);
  });

  it('T10: pivoterIrlReference change irlReference sans toucher au loyerHc', () => {
    const bail = unBailIndexableValide({
      loyerHc: Money.fromCentimes(80_000n),
      irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
    });
    const irlNouveau = IRL.creer({ trimestre: '2025-T4', valeur: '145.47' });

    const modifie = bail.pivoterIrlReference(irlNouveau);

    expect(modifie.loyerHc.toCentimes()).toBe(80_000n);
    expect(modifie.irlReference.egale(irlNouveau)).toBe(true);
  });
});
