import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EcheanceLoyer, StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
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

/**
 * Use case : lister TOUTES les échéances avec filtres optionnels.
 * Wrapper léger. La logique de tri/filtrage est dans le repo.
 */
export async function listerToutesEcheances(
  filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer },
  echeanceLoyerRepo: EcheanceLoyerRepository,
): Promise<EcheanceLoyer[]> {
  return echeanceLoyerRepo.listerTous(filtres);
}
