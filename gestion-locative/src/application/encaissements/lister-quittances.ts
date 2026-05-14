import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import type { Quittance } from '../../domain/encaissements/quittance.js';

/**
 * Use case — Lister toutes les quittances.
 */
export async function listerQuittances(
  quittanceRepo: QuittanceRepository,
  opts: { inclureAnnulees?: boolean } = {},
): Promise<Quittance[]> {
  return quittanceRepo.listerToutes(opts);
}
