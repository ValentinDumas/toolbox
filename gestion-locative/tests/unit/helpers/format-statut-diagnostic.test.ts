import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { formaterStatutDiagnostic } from '../../../src/helpers/format-statut-diagnostic.js';

describe('formaterStatutDiagnostic()', () => {
  const today = Temporal.PlainDate.from('2026-05-16');

  // T20a : ERP (dateExp null) → 'Illimitée (ERP)'
  it("T20a : null → 'Illimitée (ERP)'", () => {
    expect(formaterStatutDiagnostic(null, today)).toBe('Illimitée (ERP)');
  });

  // T20b : expiré → 'Expiré le DD/MM/YYYY'
  it("T20b : expiré → 'Expiré le 31/12/2024'", () => {
    const dateExp = Temporal.PlainDate.from('2024-12-31');
    expect(formaterStatutDiagnostic(dateExp, today)).toBe('Expiré le 31/12/2024');
  });

  // T20c : valide → 'Valide jusqu'au DD/MM/YYYY'
  it("T20c : valide → 'Valide jusqu'au 31/12/2030'", () => {
    const dateExp = Temporal.PlainDate.from('2030-12-31');
    expect(formaterStatutDiagnostic(dateExp, today)).toBe("Valide jusqu'au 31/12/2030");
  });
});
