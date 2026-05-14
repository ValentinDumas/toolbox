import type { RelanceRepository } from '../../domain/encaissements/relance-repository.js';
import type { Relance } from '../../domain/encaissements/relance.js';

/**
 * Use case — liste toutes les relances.
 */
export async function listerRelances(
  opts: { inclureAnnulees?: boolean },
  relanceRepo: RelanceRepository,
): Promise<Relance[]> {
  return relanceRepo.listerToutes(opts);
}
