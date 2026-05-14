import type { BienId, LotId } from '../../domain/_shared/identifiants.js';
import { Lot, type TypeLot } from '../../domain/patrimoine/lot.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export interface AjouterLotCommand {
  bienId: BienId;
  designation: string;
  surface: number | null;
  type: TypeLot;
  etage: number | null;
}

export async function ajouterLot(commande: AjouterLotCommand, repo: BienRepository): Promise<LotId> {
  const bien = await repo.trouverParId(commande.bienId);
  if (!bien) throw new BienIntrouvable(commande.bienId);

  const lot = Lot.creer({
    designation: commande.designation,
    surface: commande.surface,
    type: commande.type,
    etage: commande.etage,
  });

  const bienAvecLot = bien.ajouterLot(lot);
  await repo.enregistrer(bienAvecLot);
  return lot.id;
}
