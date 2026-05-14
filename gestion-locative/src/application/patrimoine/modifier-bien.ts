import { Adresse } from '../../domain/_shared/adresse.js';
import type { BienId } from '../../domain/_shared/identifiants.js';
import type { TypeBien } from '../../domain/patrimoine/bien.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export interface ModifierBienCommand {
  id: BienId;
  adresse?: { rue: string; codePostal: string; ville: string };
  surface?: number;
  type?: TypeBien;
  anneeConstruction?: number;
}

export async function modifierBien(commande: ModifierBienCommand, repo: BienRepository): Promise<void> {
  const bien = await repo.trouverParId(commande.id);
  if (!bien) throw new BienIntrouvable(commande.id);

  const patch = {
    adresse: commande.adresse ? Adresse.creer(commande.adresse) : undefined,
    surface: commande.surface,
    type: commande.type,
    anneeConstruction: commande.anneeConstruction,
  };

  const bienModifie = bien.modifier(patch);
  await repo.enregistrer(bienModifie);
}
