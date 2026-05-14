import { describe, it, expect } from 'vitest';
import { Bien } from '../../../src/domain/patrimoine/bien.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { Lot } from '../../../src/domain/patrimoine/lot.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';

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

  it('Bien.modifier({ surface: 50 }) retourne nouvelle instance avec surface 50 — ancien inchangé', () => {
    const original = unBienValide({ surface: 45 });
    const modifie = original.modifier({ surface: 50 });

    expect(modifie.surface).toBe(50);
    expect(original.surface).toBe(45); // immutabilité
    expect(modifie.id).toBe(original.id);
  });

  it('Bien.modifier({ surface: 0 }) throw InvariantViolated', () => {
    const bien = unBienValide();
    expect(() => bien.modifier({ surface: 0 })).toThrow(/surface/i);
  });

  it('Bien.ajouterLot retourne nouvelle instance avec lots.length + 1', () => {
    const bien = unBienValide();
    const nouveauLot = unLotValide({ designation: 'Cave', type: 'cave', surface: null });
    const bienAvecLot = bien.ajouterLot(nouveauLot);

    expect(bienAvecLot.lots).toHaveLength(bien.lots.length + 1);
    expect(bien.lots).toHaveLength(1); // original inchangé
  });

  it('Bien.supprimerLot retire le lot ciblé', () => {
    const lot1 = unLotValide({ designation: 'Lot 1' });
    const lot2 = unLotValide({ designation: 'Lot 2', type: 'parking', surface: null });
    const bien = unBienValide({ lots: [lot1, lot2] });

    const bienSansLot2 = bien.supprimerLot(lot2.id);

    expect(bienSansLot2.lots).toHaveLength(1);
    expect(bienSansLot2.lots[0]!.designation).toBe('Lot 1');
  });

  it('Bien.supprimerLot du dernier lot throw InvariantViolated', () => {
    const lotUnique = unLotValide();
    const bien = unBienValide({ lots: [lotUnique] });

    expect(() => bien.supprimerLot(lotUnique.id)).toThrow(/au moins un Lot/i);
  });
});
