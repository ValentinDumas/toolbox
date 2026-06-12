import { Temporal } from '@js-temporal/polyfill';

import type { BienId, DeclarationCfeId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { Alerte } from '../../domain/_shared/alerte.js';
import {
  calculerAlertesCfe,
  type AlerteCfe,
} from '../../domain/fiscalite/cfe/alerte-cfe-j30.js';
import type { StatutCfe } from '../../domain/fiscalite/cfe/statut-cfe.js';
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
 * Projection de compatibilité Phase 6 : Alerte unifié (D-AL-01) → AlerteCfe plat.
 *
 * Les consommateurs Phase 6 (routes fiscalite/racine.ts, biens.ts, partial EJS)
 * continuent de recevoir des AlerteCfe[] plats sans modification.
 *
 * Le dashboard Phase 7 (07-04/07-05) consommera calculerAlertesCfe() directement
 * en forme Alerte[] unifiée, sans passer par cette projection.
 */
function versAlerteCfe(alerte: Alerte): AlerteCfe {
  const extra = alerte.source.extra ?? {};
  return {
    declarationCfeId: alerte.source.refId as DeclarationCfeId,
    bienId: alerte.source.bienId!,
    millesime: extra['millesime'] as number,
    joursRestants: alerte.joursRestants,
    dateEcheancePaiement: extra['dateEcheancePaiement'] as Temporal.PlainDate,
    statutCfe: extra['statutCfe'] as StatutCfe,
  };
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
    return calculerAlertesCfe(declarations, maintenant).map(versAlerteCfe);
  }
  const biens = await deps.bienRepo.listerTous();
  const listes = await Promise.all(biens.map((b) => deps.cfeRepo.listerParBien(b.id)));
  return calculerAlertesCfe(listes.flat(), maintenant).map(versAlerteCfe);
}
