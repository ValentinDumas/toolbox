import type { BienId } from '../../domain/_shared/identifiants.js';
import type { DeclarationCfe } from '../../domain/fiscalite/cfe/declaration-cfe.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';

export interface ListerDeclarationsCfeParBienCommande {
  bienId: BienId;
}

export interface ListerDeclarationsCfeParBienDeps {
  cfeRepo: DeclarationCfeRepository;
}

/**
 * Use case lecture — liste les DeclarationCfe d'un Bien, triées millésime DESC
 * (Phase 6 / FIS-06).
 *
 * Wrapper léger sur `cfeRepo.listerParBien` qui sépare le port domaine de
 * l'usage côté routes web (cohérence avec Phase 5).
 */
export async function listerDeclarationsCfeParBien(
  commande: ListerDeclarationsCfeParBienCommande,
  deps: ListerDeclarationsCfeParBienDeps,
): Promise<DeclarationCfe[]> {
  return deps.cfeRepo.listerParBien(commande.bienId);
}
