import { describe, it, expect } from 'vitest';
import { formaterEtatItem } from '../../../src/helpers/format-etat-item.js';

describe('formaterEtatItem', () => {
  // T39
  it("'bon' → 'Bon'", () => expect(formaterEtatItem('bon')).toBe('Bon'));
  it("'moyen' → 'Moyen'", () => expect(formaterEtatItem('moyen')).toBe('Moyen'));
  it("'degrade' → 'Dégradé'", () => expect(formaterEtatItem('degrade')).toBe('Dégradé'));
  it("null → '—'", () => expect(formaterEtatItem(null)).toBe('—'));
});
