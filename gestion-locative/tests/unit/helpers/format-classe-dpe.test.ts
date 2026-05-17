import { describe, it, expect } from 'vitest';
import { formaterClasseDpe } from '../../../src/helpers/format-classe-dpe.js';

describe('formaterClasseDpe()', () => {
  // T18
  it("T18a : formaterClasseDpe('F') retourne 'DPE F'", () => {
    expect(formaterClasseDpe('F')).toBe('DPE F');
  });

  it("T18b : formaterClasseDpe(null) retourne 'Non renseignée'", () => {
    expect(formaterClasseDpe(null)).toBe('Non renseignée');
  });

  it("formaterClasseDpe fonctionne pour toutes les classes A-G", () => {
    for (const c of ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const) {
      expect(formaterClasseDpe(c)).toBe('DPE ' + c);
    }
  });
});
