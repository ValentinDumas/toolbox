import { describe, it, expect } from 'vitest';
import { formatVerdictLmp } from '../../../src/helpers/format-verdict-lmp.js';

describe('formatVerdictLmp()', () => {
  it('formatVerdictLmp("lmnp_confirme") → "LMNP confirmé"', () => {
    expect(formatVerdictLmp('lmnp_confirme')).toBe('LMNP confirmé');
  });

  it('formatVerdictLmp("lmp_probable") → "LMP probable"', () => {
    expect(formatVerdictLmp('lmp_probable')).toBe('LMP probable');
  });

  it('formatVerdictLmp("indetermine_revenus_foyer_manquants") → "Indéterminé (revenus foyer manquants)"', () => {
    expect(formatVerdictLmp('indetermine_revenus_foyer_manquants')).toBe(
      'Indéterminé (revenus foyer manquants)',
    );
  });
});
