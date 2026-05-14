import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { ActiviteBailDetector } from '../../domain/locatif/activite-bail-detector.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

/**
 * Supprime un Bail.
 * D-74 : refuse la suppression si le Bail a de l'activité (échéances, encaissements, quittances).
 */
export async function supprimerBail(
  id: BailId,
  bailRepo: BailRepository,
  activiteBailDetector: ActiviteBailDetector,
): Promise<void> {
  const bail = await bailRepo.trouverParId(id);
  if (!bail) {
    throw new BailIntrouvable(id);
  }

  if (await activiteBailDetector.aDeLActivite(id)) {
    throw new InvariantViolated('Bail avec activité ne peut être supprimé');
  }

  await bailRepo.supprimer(id);
}
