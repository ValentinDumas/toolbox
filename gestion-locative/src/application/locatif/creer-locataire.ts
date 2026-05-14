import { Temporal } from '@js-temporal/polyfill';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';
import { Locataire } from '../../domain/locatif/locataire.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';

export interface CreerLocataireCommand {
  nom: string;
  prenom: string;
  dateNaissance: string; // ISO YYYY-MM-DD venant du formulaire
  communeNaissance: string;
  paysNaissance: string;
  nationalite: string;
  email: string;
  telephone: string | null;
  adresseActuelle: { rue: string; codePostal: string; ville: string };
}

export async function creerLocataire(
  commande: CreerLocataireCommand,
  repo: LocataireRepository,
): Promise<LocataireId> {
  const locataire = Locataire.creer({
    nom: commande.nom,
    prenom: commande.prenom,
    dateNaissance: Temporal.PlainDate.from(commande.dateNaissance),
    lieuNaissance: { commune: commande.communeNaissance, pays: commande.paysNaissance },
    nationalite: commande.nationalite,
    email: commande.email,
    telephone: commande.telephone,
    adresseActuelle: Adresse.creer(commande.adresseActuelle),
  });

  await repo.enregistrer(locataire);
  return locataire.id;
}
