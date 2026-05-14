import type { Encaissement } from '../../domain/encaissements/encaissement.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';

/**
 * Use case : lister tous les Encaissements.
 * Par défaut, inclut les annulés pour l'audit.
 */
export async function listerEncaissements(
  opts: { inclureAnnules: boolean },
  encaissementRepo: EncaissementRepository,
): Promise<Encaissement[]> {
  return encaissementRepo.listerTous({ inclureAnnules: opts.inclureAnnules });
}
