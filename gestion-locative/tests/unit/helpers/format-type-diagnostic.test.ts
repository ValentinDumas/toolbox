import { describe, it, expect } from 'vitest';
import { formaterTypeDiagnostic } from '../../../src/helpers/format-type-diagnostic.js';

describe('formaterTypeDiagnostic()', () => {
  // T19 : 4 cas
  it("T19a : 'dpe' → 'DPE'", () => {
    expect(formaterTypeDiagnostic('dpe')).toBe('DPE');
  });

  it("T19b : 'gaz' → 'Gaz'", () => {
    expect(formaterTypeDiagnostic('gaz')).toBe('Gaz');
  });

  it("T19c : 'elec' → 'Électricité'", () => {
    expect(formaterTypeDiagnostic('elec')).toBe('Électricité');
  });

  it("T19d : 'erp' → 'ERP (risques et pollutions)'", () => {
    expect(formaterTypeDiagnostic('erp')).toBe('ERP (risques et pollutions)');
  });
});
