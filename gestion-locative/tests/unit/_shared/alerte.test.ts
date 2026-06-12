/**
 * Tests unitaires — joursAvantEcheance partagé (Phase 7 / DAS-02 / D-AL-01).
 *
 * Couvre :
 *   - joursAvantEcheance : positif / zéro / négatif + monotonie (fast-check).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Temporal } from '@js-temporal/polyfill';

import { joursAvantEcheance } from '../../../src/domain/_shared/alerte.js';

describe('joursAvantEcheance', () => {
  it('15 jours avant 2026-12-15 → 15', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-12-15'),
        Temporal.PlainDate.from('2026-11-30'),
      ),
    ).toBe(15);
  });

  it('jour J → 0', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-12-15'),
        Temporal.PlainDate.from('2026-12-15'),
      ),
    ).toBe(0);
  });

  it('échéance dépassée de 29 jours → -29', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-11-01'),
        Temporal.PlainDate.from('2026-11-30'),
      ),
    ).toBe(-29);
  });

  it('propriété fast-check : avancer maintenant d\'un jour décrémente le résultat de 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        (offset) => {
          const echeance = Temporal.PlainDate.from('2026-12-15');
          const maintenant = echeance.subtract({ days: offset });
          const maintenantPlusUn = maintenant.add({ days: 1 });
          const j1 = joursAvantEcheance(echeance, maintenant);
          const j2 = joursAvantEcheance(echeance, maintenantPlusUn);
          return j1 - j2 === 1;
        },
      ),
      { numRuns: 50 },
    );
  });
});
