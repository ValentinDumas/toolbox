import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

/**
 * Use case : lister les échéances de loyer d'un bail.
 * Wrapper léger du repository — la logique de tri et de filtrage est dans le repo.
 */
export async function listerEcheancesParBail(
  bailId: BailId,
  echeanceLoyerRepo: EcheanceLoyerRepository,
): Promise<EcheanceLoyer[]> {
  return echeanceLoyerRepo.listerParBail(bailId);
}
