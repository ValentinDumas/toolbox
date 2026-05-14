import { Bailleur } from '../../domain/identite/bailleur.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { BailleurId } from '../../domain/_shared/identifiants.js';
import type { Adresse } from '../../domain/_shared/adresse.js';

export interface CreerOuMajBailleurCommande {
  nomComplet: string;
  adresse: Adresse;
}

/**
 * Use case upsert Bailleur singleton (D-67).
 * Lookup → creer si absent, modifier si présent.
 * Retourne l'id du bailleur (créé ou mis à jour).
 */
export async function creerOuMajBailleur(
  commande: CreerOuMajBailleurCommande,
  bailleurRepo: BailleurRepository,
): Promise<BailleurId> {
  const existant = await bailleurRepo.trouver();

  if (!existant) {
    const bailleur = Bailleur.creer({
      nomComplet: commande.nomComplet,
      adresse: commande.adresse,
    });
    await bailleurRepo.enregistrer(bailleur);
    return bailleur.id;
  }

  const modifie = existant.modifier({
    nomComplet: commande.nomComplet,
    adresse: commande.adresse,
  });
  await bailleurRepo.mettreAJour(modifie);
  return modifie.id;
}
