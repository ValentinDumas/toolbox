import type { BienId } from '../../domain/_shared/identifiants.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export async function supprimerBien(id: BienId, repo: BienRepository): Promise<void> {
  const bien = await repo.trouverParId(id);
  if (!bien) throw new BienIntrouvable(id);
  await repo.supprimer(id);
}
