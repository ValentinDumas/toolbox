import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

export async function supprimerBail(id: BailId, bailRepo: BailRepository): Promise<void> {
  const bail = await bailRepo.trouverParId(id);
  if (!bail) {
    throw new BailIntrouvable(id);
  }
  await bailRepo.supprimer(id);
}
