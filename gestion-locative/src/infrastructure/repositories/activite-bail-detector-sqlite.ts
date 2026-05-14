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

  async aDeLActivite(bailId: BailId): Promise<boolean> {
    // 02-02 : count(echeance_loyer WHERE bail_id = ? AND annule_le IS NULL)
    const r = await this.db
      .selectFrom('echeance_loyer')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('bail_id', '=', bailId)
      .where('annule_le', 'is', null)
      .executeTakeFirst();

    const n = Number(r?.n ?? 0);
    if (n > 0) return true;

    // Plans 02-03 et 02-04 étendront avec encaissement + quittance.
    return false;
  }
}
