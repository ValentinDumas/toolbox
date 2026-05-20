import { describe, it, expect } from 'vitest';
import { suggererQualification } from '../../../src/application/fiscalite/suggerer-qualification.js';

/**
 * Tests TDD — use case pur suggererQualification (D-FIS-G2.7).
 *
 * Suggestion déterministe par TypeJustificatif — jamais auto-appliquée.
 * L'UI affiche le radio pré-coché mais l'utilisateur valide toujours.
 */
describe('suggererQualification', () => {
  it('"facture" → "charge_courante_periodique"', () => {
    expect(suggererQualification('facture')).toBe('charge_courante_periodique');
  });

  it('"ticket_caisse" → "entretien_reparation"', () => {
    expect(suggererQualification('ticket_caisse')).toBe('entretien_reparation');
  });

  it('"bail_signe" → "non_deductible" (default)', () => {
    expect(suggererQualification('bail_signe')).toBe('non_deductible');
  });

  it('"releve_bancaire" → "non_deductible" (default)', () => {
    expect(suggererQualification('releve_bancaire')).toBe('non_deductible');
  });

  it('"autre" → "non_deductible" (default)', () => {
    expect(suggererQualification('autre')).toBe('non_deductible');
  });
});
