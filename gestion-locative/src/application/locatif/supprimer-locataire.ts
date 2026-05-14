import type { LocataireId } from '../../domain/_shared/identifiants.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';

export async function supprimerLocataire(
  id: LocataireId,
  repo: LocataireRepository,
): Promise<void> {
  const locataire = await repo.trouverParId(id);
  if (!locataire) throw new LocataireIntrouvable(id);
  await repo.supprimer(id);
}
