import { describe, it, expect } from 'vitest';
import { Lot } from '../../../src/domain/patrimoine/lot.js';

describe('Lot invariants', () => {
  it('Lot.creer rejette designation vide', () => {
    expect(() =>
      Lot.creer({ designation: '   ', surface: 30, type: 'appartement', etage: null }),
    ).toThrow(/désignation/i);
  });

  it("Lot.creer accepte type 'parking' avec surface null", () => {
    expect(() =>
      Lot.creer({ designation: 'Place P1', surface: null, type: 'parking', etage: -1 }),
    ).not.toThrow();
  });

  it("Lot.creer rejette type 'appartement' avec surface null", () => {
    expect(() =>
      Lot.creer({ designation: 'Appt', surface: null, type: 'appartement', etage: null }),
    ).toThrow(/surface/i);
  });

  it("Lot.creer rejette type 'appartement' avec surface ≤ 0", () => {
    expect(() =>
      Lot.creer({ designation: 'Appt', surface: 0, type: 'appartement', etage: null }),
    ).toThrow(/surface/i);
  });

  it('Lot.creer rejette type hors enum', () => {
    expect(() =>
      // @ts-expect-error - test volontaire : type invalide
      Lot.creer({ designation: 'Appt', surface: 30, type: 'hangar', etage: null }),
    ).toThrow(/type/i);
  });
});
