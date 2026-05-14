import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Locataire } from '../../../src/domain/locatif/locataire.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

const adresseValide = () =>
  Adresse.creer({ rue: '1 rue Test', codePostal: '75001', ville: 'Paris' });

const datePassee = Temporal.PlainDate.from('1985-06-15');

const propsValides = () => ({
  nom: 'Dupont',
  prenom: 'Marie',
  dateNaissance: datePassee,
  lieuNaissance: { commune: 'Paris', pays: 'France' },
  nationalite: 'française',
  email: 'marie@example.fr',
  telephone: '0123456789',
  adresseActuelle: adresseValide(),
});

describe('Locataire.creer', () => {
  it('rejette nom vide', () => {
    expect(() => Locataire.creer({ ...propsValides(), nom: '' })).toThrow(InvariantViolated);
    expect(() => Locataire.creer({ ...propsValides(), nom: '   ' })).toThrow(InvariantViolated);
  });

  it('rejette prenom vide', () => {
    expect(() => Locataire.creer({ ...propsValides(), prenom: '' })).toThrow(InvariantViolated);
    expect(() => Locataire.creer({ ...propsValides(), prenom: '   ' })).toThrow(InvariantViolated);
  });

  it("rejette email malformé ('toto')", () => {
    expect(() => Locataire.creer({ ...propsValides(), email: 'toto' })).toThrow(InvariantViolated);
    expect(() => Locataire.creer({ ...propsValides(), email: 'sans-arobase.fr' })).toThrow(InvariantViolated);
  });

  it('rejette date_naissance dans le futur', () => {
    const demain = Temporal.Now.plainDateISO().add({ days: 1 });
    expect(() => Locataire.creer({ ...propsValides(), dateNaissance: demain })).toThrow(InvariantViolated);
  });

  it('rejette commune_naissance vide', () => {
    expect(() =>
      Locataire.creer({ ...propsValides(), lieuNaissance: { commune: '', pays: 'France' } }),
    ).toThrow(InvariantViolated);
  });

  it('rejette pays_naissance vide', () => {
    expect(() =>
      Locataire.creer({ ...propsValides(), lieuNaissance: { commune: 'Paris', pays: '' } }),
    ).toThrow(InvariantViolated);
  });

  it('accepte un Locataire valide complet', () => {
    const loc = Locataire.creer(propsValides());
    expect(loc.nom).toBe('Dupont');
    expect(loc.prenom).toBe('Marie');
    expect(loc.email).toBe('marie@example.fr');
    expect(loc.dateNaissance.toString()).toBe('1985-06-15');
    expect(loc.lieuNaissance.commune).toBe('Paris');
    expect(loc.lieuNaissance.pays).toBe('France');
    expect(loc.telephone).toBe('0123456789');
    expect(loc.id).toBeDefined();
  });

  it('Locataire.modifier({ email }) retourne nouvelle instance immutable', () => {
    const original = Locataire.creer(propsValides());
    const modifie = original.modifier({ email: 'new@example.fr' });

    expect(modifie.email).toBe('new@example.fr');
    expect(original.email).toBe('marie@example.fr');
    expect(modifie.id).toBe(original.id);
    expect(modifie.nom).toBe(original.nom);
  });
});
