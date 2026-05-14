import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { ActiviteBailDetector } from '../../domain/locatif/activite-bail-detector.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

/**
 * Adapter SQLite v0 pour ActiviteBailDetector (D-74).
 *
 * En 02-01 aucune table d'activité n'existe encore — retourne toujours false.
 * Extension progressive :
 *   - 02-02 : count(echeance_loyer WHERE bail_id = ?)
 *   - 02-03 : + count(encaissement via echeance)
 *   - 02-04 : + count(quittance via echeance)
 * Pattern final : OR logique entre les 3 sous-requêtes pour court-circuiter
 * dès qu'une activité est détectée.
 */
export class ActiviteBailDetectorSqlite implements ActiviteBailDetector {
  constructor(private readonly db: Kysely<DB>) {}

  async aDeLActivite(_bailId: BailId): Promise<boolean> {
    // 02-01 walking-enabler : aucune table d'activité ne contribue encore.
    // Retour false = suppression autorisée par défaut.
    // Plans 02-02 à 02-04 étendront cette méthode.
    return false;
  }
}
