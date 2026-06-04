import type { BienId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import {
  calculerAlertesCfe,
  type AlerteCfe,
} from '../../domain/fiscalite/cfe/alerte-cfe-j30.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';

export interface ListerAlertesCfeActivesFiltre {
  bienId?: BienId;
}

export interface ListerAlertesCfeActivesDeps {
  cfeRepo: DeclarationCfeRepository;
  bienRepo: BienRepository;
  clock: Clock;
}

/**
 * Use case lecture — retourne les CFE en alerte J-30 (D-CFE6.5).
 *
 * - Si `bienId` fourni : scan uniquement ce bien.
 * - Sinon : agrège sur l'ensemble des biens (V1 single-bailleur).
 *
 * Calcul à la demande via `clock.aujourdhui()` injecté — aucune
 * persistance d'état d'alerte (pattern miroir Phase 3 D-90 banner IRL).
 */
export async function listerAlertesCfeActives(
  filtre: ListerAlertesCfeActivesFiltre,
  deps: ListerAlertesCfeActivesDeps,
): Promise<AlerteCfe[]> {
  const maintenant = deps.clock.aujourdhui();
  if (filtre.bienId) {
    const declarations = await deps.cfeRepo.listerParBien(filtre.bienId);
    return calculerAlertesCfe(declarations, maintenant);
  }
  const biens = await deps.bienRepo.listerTous();
  const listes = await Promise.all(biens.map((b) => deps.cfeRepo.listerParBien(b.id)));
  return calculerAlertesCfe(listes.flat(), maintenant);
}
