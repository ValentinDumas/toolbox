import { Adresse } from '../../src/domain/_shared/adresse.js';
import { Bailleur } from '../../src/domain/identite/bailleur.js';
import type { BailleurId } from '../../src/domain/_shared/identifiants.js';

interface OverridesAdresse {
  rue?: string;
  codePostal?: string;
  ville?: string;
}

export function uneAdresseValide(overrides: OverridesAdresse = {}): Adresse {
  return Adresse.creer({
    rue: overrides.rue ?? '12 rue de la Paix',
    codePostal: overrides.codePostal ?? '75002',
    ville: overrides.ville ?? 'Paris',
  });
}

interface OverridesBailleur {
  id?: BailleurId;
  nomComplet?: string;
  adresse?: Adresse;
}

export function unBailleurValide(overrides: OverridesBailleur = {}): Bailleur {
  return Bailleur.creer({
    id: overrides.id,
    nomComplet: overrides.nomComplet ?? 'Jean Dupont',
    adresse: overrides.adresse ?? uneAdresseValide(),
  });
}
