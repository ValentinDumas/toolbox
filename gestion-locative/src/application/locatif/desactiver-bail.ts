import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

/**
 * Désactive un Bail : bascule actif_depuis à null.
 * D-74 : alternative non-destructive à la suppression.
 * L'historique (échéances, encaissements, quittances) est préservé.
 */
export async function desactiverBail(id: BailId, bailRepo: BailRepository): Promise<void> {
  const bail = await bailRepo.trouverParId(id);
  if (!bail) {
    throw new BailIntrouvable(id);
  }

  const bailDesactive = bail.desactiver();
  await bailRepo.enregistrer(bailDesactive);
}
