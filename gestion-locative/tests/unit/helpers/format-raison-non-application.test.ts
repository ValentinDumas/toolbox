import { describe, it, expect } from 'vitest';
import { formaterRaisonNonApplication } from '../../../src/helpers/format-raison-non-application.js';

describe('formaterRaisonNonApplication (DP-18)', () => {
  it('T18: null → "Appliquée"', () => {
    expect(formaterRaisonNonApplication(null)).toBe('Appliquée');
  });

  it('T18: "gel_dpe" → "Gel DPE"', () => {
    expect(formaterRaisonNonApplication('gel_dpe')).toBe('Gel DPE');
  });

  it('T18: "refus_bailleur" → "Choix du bailleur"', () => {
    expect(formaterRaisonNonApplication('refus_bailleur')).toBe('Choix du bailleur');
  });
});
