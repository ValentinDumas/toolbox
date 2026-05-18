import { describe, it, expect } from 'vitest';
import { slugify } from '../../../src/domain/_shared/slug.js';

describe('slugify (DP-27)', () => {
  it('lowercase + drop accents', () => {
    expect(slugify('Été à Paris')).toBe('ete-a-paris');
  });
  it('remplace non-alphanum par -', () => {
    expect(slugify('A.B C_D-E')).toBe('a-b-c-d-e');
  });
  it('trim les - en début/fin', () => {
    expect(slugify('--foo--')).toBe('foo');
  });
  it('coupe à 80 chars', () => {
    const input = 'a'.repeat(120);
    expect(slugify(input)).toHaveLength(80);
  });
  it('fallback "document" si vide après normalisation', () => {
    expect(slugify('---')).toBe('document');
    expect(slugify('   ')).toBe('document');
    expect(slugify('!@#$')).toBe('document');
  });
});
