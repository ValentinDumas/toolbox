import { describe, it, expect } from 'vitest';
import { formatPourcentage } from '../../../src/helpers/format-pourcentage.js';

describe('formatPourcentage()', () => {
  it('formatPourcentage(0) → "0 %" (espace insécable avant %)', () => {
    const result = formatPourcentage(0);
    expect(result).toBe('0 %');
  });

  it('formatPourcentage(0.5) → "50 %"', () => {
    expect(formatPourcentage(0.5)).toBe('50 %');
  });

  it('formatPourcentage(1) → "100 %"', () => {
    expect(formatPourcentage(1)).toBe('100 %');
  });

  it('formatPourcentage(0.305, 1) → "30,5 %" (1 décimale, virgule française)', () => {
    expect(formatPourcentage(0.305, 1)).toBe('30,5 %');
  });

  it('formatPourcentage(0.30001) → "30 %" (arrondi 0 décimale)', () => {
    expect(formatPourcentage(0.30001)).toBe('30 %');
  });

  it('formatPourcentage(1.5) → "150 %" (accepte > 100 %)', () => {
    expect(formatPourcentage(1.5)).toBe('150 %');
  });

  it('formatPourcentage(-0.1) → "-10 %" (valeur négative permissive)', () => {
    expect(formatPourcentage(-0.1)).toBe('-10 %');
  });
});
