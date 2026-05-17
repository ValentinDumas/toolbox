import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Diagnostic } from '../../../src/domain/patrimoine/diagnostic.js';
import type { TypeDiagnostic } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('Diagnostic — factory creer()', () => {
  // T1 : DPE avec classe → dateExpiration = dateEmission + 10 ans
  it('T1 : Diagnostic DPE calcule dateExpiration à 10 ans', () => {
    const d = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from('2025-01-15'),
      classeDpe: 'D',
    });
    expect(d.dateExpiration).not.toBeNull();
    expect(Temporal.PlainDate.compare(d.dateExpiration!, Temporal.PlainDate.from('2035-01-15'))).toBe(0);
    expect(d.type).toBe('dpe');
    expect(d.classeDpe).toBe('D');
  });

  // T2 : Gaz → dateExpiration = 6 ans, classeDpe = null
  it('T2 : Diagnostic gaz calcule dateExpiration à 6 ans, classeDpe null', () => {
    const d = Diagnostic.creer({
      type: 'gaz',
      dateEmission: Temporal.PlainDate.from('2025-01-15'),
    });
    expect(d.dateExpiration).not.toBeNull();
    expect(Temporal.PlainDate.compare(d.dateExpiration!, Temporal.PlainDate.from('2031-01-15'))).toBe(0);
    expect(d.classeDpe).toBeNull();
  });

  // T3 : Électricité → dateExpiration = 6 ans
  it('T3 : Diagnostic élec calcule dateExpiration à 6 ans', () => {
    const d = Diagnostic.creer({
      type: 'elec',
      dateEmission: Temporal.PlainDate.from('2025-01-15'),
    });
    expect(d.dateExpiration).not.toBeNull();
    expect(Temporal.PlainDate.compare(d.dateExpiration!, Temporal.PlainDate.from('2031-01-15'))).toBe(0);
  });

  // T4 : ERP → dateExpiration = null (illimité)
  it('T4 : Diagnostic ERP a dateExpiration null (illimitée)', () => {
    const d = Diagnostic.creer({
      type: 'erp',
      dateEmission: Temporal.PlainDate.from('2025-01-15'),
    });
    expect(d.dateExpiration).toBeNull();
  });

  // T5 : DPE sans classeDpe → InvariantViolated
  it('T5 : Diagnostic DPE sans classeDpe throw InvariantViolated', () => {
    expect(() =>
      Diagnostic.creer({
        type: 'dpe',
        dateEmission: Temporal.PlainDate.from('2025-01-15'),
      }),
    ).toThrow(/classe DPE est obligatoire/i);
  });

  // T6 : Gaz avec classeDpe → InvariantViolated
  it("T6 : Diagnostic gaz avec classeDpe throw InvariantViolated", () => {
    expect(() =>
      Diagnostic.creer({
        type: 'gaz',
        dateEmission: Temporal.PlainDate.from('2025-01-15'),
        classeDpe: 'D',
      }),
    ).toThrow(/pertinente que pour le diagnostic DPE/i);
  });

  // T7 : Type invalide → InvariantViolated
  it('T7 : Diagnostic type invalide throw InvariantViolated', () => {
    expect(() =>
      Diagnostic.creer({
        type: 'xyz' as TypeDiagnostic,
        dateEmission: Temporal.PlainDate.from('2025-01-15'),
      }),
    ).toThrow(InvariantViolated);
  });

  // T8 : estExpire(today) → true quand expiré
  it('T8 : estExpire retourne true quand dateExpiration < today', () => {
    const d = Diagnostic.creer({
      type: 'gaz',
      dateEmission: Temporal.PlainDate.from('2019-12-31'),
    });
    // dateExpiration = 2025-12-31, today = 2026-01-15 → expiré
    expect(d.estExpire(Temporal.PlainDate.from('2026-01-15'))).toBe(true);
  });

  // T9 : estExpire(today) → false quand non expiré
  it('T9 : estExpire retourne false quand dateExpiration > today', () => {
    const d = Diagnostic.creer({
      type: 'gaz',
      dateEmission: Temporal.PlainDate.from('2024-12-31'),
    });
    // dateExpiration = 2030-12-31, today = 2026-01-15 → non expiré
    expect(d.estExpire(Temporal.PlainDate.from('2026-01-15'))).toBe(false);
  });

  // T10 : estExpire(today) → false quand ERP (dateExpiration = null)
  it('T10 : estExpire retourne false pour ERP (dateExpiration null)', () => {
    const d = Diagnostic.creer({
      type: 'erp',
      dateEmission: Temporal.PlainDate.from('2025-01-15'),
    });
    expect(d.estExpire(Temporal.PlainDate.from('2099-01-15'))).toBe(false);
  });
});
