import type { BailId } from '../_shared/identifiants.js';

/**
 * Port domaine — détecte si un Bail a de l'activité.
 * D-74 : la suppression d'un Bail est refusée si ce port retourne true.
 *
 * Implémentation progressive (walking-enabler) :
 *   - 02-01 adapter v0 : toujours false (tables activité non encore créées).
 *   - 02-02 étendu : count(echeance_loyer WHERE bail_id = ?).
 *   - 02-03 étendu : + count(encaissement via echeance).
 *   - 02-04 étendu : + count(quittance via echeance).
 */
export interface ActiviteBailDetector {
  /**
   * Retourne true si le Bail a au moins une EcheanceLoyer, un Encaissement
   * ou une Quittance (active ou annulée). D-74 — suppression refusée.
   */
  aDeLActivite(bailId: BailId): Promise<boolean>;
}
