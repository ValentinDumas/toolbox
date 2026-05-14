import { describe, it, expect } from 'vitest';
import { Bien } from '../../../src/domain/patrimoine/bien.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { Lot } from '../../../src/domain/patrimoine/lot.js';

describe('Bien invariants', () => {
  const adresseValide = Adresse.creer({
    rue: '12 rue des Lilas',
    codePostal: '75020',
    ville: 'Paris',
  });

  const lotValide = Lot.creer({
    designation: 'Appartement principal',
    surface: 45,
    type: 'appartement',
    etage: null,
  });

  it('Bien.creer rejette surface ≤ 0', () => {
    expect(() =>
      Bien.creer({
        adresse: adresseValide,
        surface: 0,
        type: 'appartement',
        anneeConstruction: 1985,
        lots: [lotValide],
      }),
    ).toThrow(/surface/i);
  });

  it('Bien.creer rejette lots vide', () => {
    expect(() =>
      Bien.creer({
        adresse: adresseValide,
        surface: 45,
        type: 'appartement',
        anneeConstruction: 1985,
        lots: [],
      }),
    ).toThrow(/lot/i);
  });

  it('Bien.creer accepte 1 lot et surface 45', () => {
    const bien = Bien.creer({
      adresse: adresseValide,
      surface: 45,
      type: 'appartement',
      anneeConstruction: 1985,
      lots: [lotValide],
    });

    expect(bien.surface).toBe(45);
    expect(bien.lots).toHaveLength(1);
    expect(bien.adresse.enLigne()).toBe('12 rue des Lilas, 75020 Paris');
  });
});
