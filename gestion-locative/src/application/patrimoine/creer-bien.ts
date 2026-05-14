import { Adresse } from '../../domain/_shared/adresse.js';
import type { BienId } from '../../domain/_shared/identifiants.js';
import { Bien, type TypeBien } from '../../domain/patrimoine/bien.js';
import { Lot, type TypeLot } from '../../domain/patrimoine/lot.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export interface CreerBienCommand {
  adresse: { rue: string; codePostal: string; ville: string };
  surface: number;
  type: TypeBien;
  anneeConstruction: number;
  lots: Array<{ designation: string; surface: number | null; type: TypeLot; etage: number | null }>;
}

export async function creerBien(commande: CreerBienCommand, repo: BienRepository): Promise<BienId> {
  const adresse = Adresse.creer(commande.adresse);
  const lots = commande.lots.map((l) => Lot.creer(l));
  const bien = Bien.creer({
    adresse,
    surface: commande.surface,
    type: commande.type,
    anneeConstruction: commande.anneeConstruction,
    lots,
  });

  await repo.enregistrer(bien);
  return bien.id;
}
