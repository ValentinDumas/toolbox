import { Temporal } from '@js-temporal/polyfill';
import { Locataire } from '../../src/domain/locatif/locataire.js';
import { Adresse } from '../../src/domain/_shared/adresse.js';
import type { LocataireId } from '../../src/domain/_shared/identifiants.js';

interface OverridesLocataire {
  id?: LocataireId;
  nom?: string;
  prenom?: string;
  dateNaissance?: Temporal.PlainDate;
  communeNaissance?: string;
  paysNaissance?: string;
  nationalite?: string;
  email?: string;
  telephone?: string | null;
  rue?: string;
  codePostal?: string;
  ville?: string;
}

export function unLocataireValide(overrides: OverridesLocataire = {}): Locataire {
  return Locataire.creer({
    id: overrides.id,
    nom: overrides.nom ?? 'Dupont',
    prenom: overrides.prenom ?? 'Marie',
    dateNaissance: overrides.dateNaissance ?? Temporal.PlainDate.from('1985-06-15'),
    lieuNaissance: {
      commune: overrides.communeNaissance ?? 'Paris',
      pays: overrides.paysNaissance ?? 'France',
    },
    nationalite: overrides.nationalite ?? 'française',
    email: overrides.email ?? 'marie@example.fr',
    telephone: overrides.telephone !== undefined ? overrides.telephone : '0123456789',
    adresseActuelle: Adresse.creer({
      rue: overrides.rue ?? '1 rue Test',
      codePostal: overrides.codePostal ?? '75001',
      ville: overrides.ville ?? 'Paris',
    }),
  });
}
