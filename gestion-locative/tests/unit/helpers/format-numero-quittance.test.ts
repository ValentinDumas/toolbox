import { describe, it, expect } from 'vitest';

// NOTE: Ce module n'existe pas encore — tests RED intentionnellement
import { formatNumeroQuittance } from '../../../src/helpers/format-numero-quittance.js';

describe('formatNumeroQuittance', () => {
  it('T1: formate un numéro séquence 1 en "2026-001"', () => {
    expect(formatNumeroQuittance(2026, 1)).toBe('2026-001');
  });

  it('T2: formate un numéro séquence 42 en "2026-042"', () => {
    expect(formatNumeroQuittance(2026, 42)).toBe('2026-042');
  });

  it('T3: séquence 1000 → au moins 3 chiffres, plus si nécessaire "2026-1000"', () => {
    expect(formatNumeroQuittance(2026, 1000)).toBe('2026-1000');
  });
});
