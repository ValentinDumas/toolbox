import { Temporal } from '@js-temporal/polyfill';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';

export interface ModifierLocataireCommand {
  id: LocataireId;
  nom?: string;
  prenom?: string;
  dateNaissance?: string; // ISO YYYY-MM-DD
  communeNaissance?: string;
  paysNaissance?: string;
  nationalite?: string;
  email?: string;
  telephone?: string | null;
  adresseActuelle?: { rue: string; codePostal: string; ville: string };
}

export async function modifierLocataire(
  commande: ModifierLocataireCommand,
  repo: LocataireRepository,
): Promise<void> {
  const locataire = await repo.trouverParId(commande.id);
  if (!locataire) throw new LocataireIntrouvable(commande.id);

  const lieuNaissance =
    commande.communeNaissance !== undefined || commande.paysNaissance !== undefined
      ? {
          commune: commande.communeNaissance ?? locataire.lieuNaissance.commune,
          pays: commande.paysNaissance ?? locataire.lieuNaissance.pays,
        }
      : undefined;

  const patch = {
    nom: commande.nom,
    prenom: commande.prenom,
    dateNaissance: commande.dateNaissance
      ? Temporal.PlainDate.from(commande.dateNaissance)
      : undefined,
    lieuNaissance,
    nationalite: commande.nationalite,
    email: commande.email,
    telephone: commande.telephone,
    adresseActuelle: commande.adresseActuelle
      ? Adresse.creer(commande.adresseActuelle)
      : undefined,
  };

  const locataireModifie = locataire.modifier(patch);
  await repo.enregistrer(locataireModifie);
}
