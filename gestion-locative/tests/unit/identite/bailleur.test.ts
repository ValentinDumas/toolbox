import { describe, it, expect } from 'vitest';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { unBailleurValide, uneAdresseValide } from '../../_builders/identite.js';

describe('Bailleur', () => {
  it('Bailleur.creer accepte un bailleur valide (nomComplet + adresse)', () => {
    expect(() => unBailleurValide()).not.toThrow();
  });

  it("Bailleur.creer avec nomComplet '   ' (vide ou espaces) throw InvariantViolated", () => {
    expect(() =>
      Bailleur.creer({ nomComplet: '   ', adresse: uneAdresseValide() }),
    ).toThrow(InvariantViolated);
  });

  it('bailleur.modifier({ nomComplet }) retourne nouveau Bailleur (copy-on-write)', () => {
    const bailleur = unBailleurValide({ nomComplet: 'Jean Dupont' });
    const modifie = bailleur.modifier({ nomComplet: 'Marie Martin' });
    expect(modifie.nomComplet).toBe('Marie Martin');
    expect(bailleur.nomComplet).toBe('Jean Dupont'); // immutable
    expect(modifie.id).toBe(bailleur.id); // même id
    expect(modifie).not.toBe(bailleur);
  });
});
