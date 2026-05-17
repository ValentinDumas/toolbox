import type { BailId } from '../../domain/_shared/identifiants.js';
import type { BailIndexation } from '../../domain/locatif/bail-indexation.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';

/**
 * Use case read-only — historique des indexations d'un bail (tri date_effet DESC).
 * Consommé par : route GET /baux/:id (section "Historique des indexations IRL").
 */
export async function listerIndexationsBail(
  bailId: BailId,
  bailIndexationRepo: BailIndexationRepository,
): Promise<BailIndexation[]> {
  return bailIndexationRepo.listerParBail(bailId);
}
