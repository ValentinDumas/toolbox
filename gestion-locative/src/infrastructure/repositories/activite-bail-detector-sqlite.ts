import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { ActiviteBailDetector } from '../../domain/locatif/activite-bail-detector.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

/**
 * Adapter SQLite pour ActiviteBailDetector (D-74).
 *
 * Détecte toute activité fonctionnelle d'un bail. Si vrai, supprimerBail
 * refuse la hard-delete (l'opérateur doit passer par desactiverBail).
 *
 * Activité détectée par OR logique entre 3 sous-requêtes (court-circuit
 * dès qu'une activité est trouvée) :
 *   - 02-02 : count(echeance_loyer WHERE bail_id = ?)
 *             — inclut les échéances soft-deleted (audit-friendly D-60) :
 *               sinon, annuler toutes les échéances d'un bail laisserait
 *               la hard-delete passer et orphaniserait encaissements et
 *               quittances liés.
 *   - 02-03 : count(encaissement via echeance.bail_id = ?)
 *   - 02-04 : count(quittance via echeance.bail_id = ?)
 */
export class ActiviteBailDetectorSqlite implements ActiviteBailDetector {
  constructor(private readonly db: Kysely<DB>) {}

  async aDeLActivite(bailId: BailId): Promise<boolean> {
    // 02-02 : echeance_loyer (inclut soft-deleted — audit-friendly D-60)
    const rEch = await this.db
      .selectFrom('echeance_loyer')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('bail_id', '=', bailId)
      .executeTakeFirst();
    if (Number(rEch?.n ?? 0) > 0) return true;

    // 02-03 : encaissements via echeances (inclut soft-deleted)
    const rEnc = await this.db
      .selectFrom('encaissement')
      .innerJoin('echeance_loyer', 'echeance_loyer.id', 'encaissement.echeance_id')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('echeance_loyer.bail_id', '=', bailId)
      .executeTakeFirst();
    if (Number(rEnc?.n ?? 0) > 0) return true;

    // 02-04 : quittances via echeances (inclut soft-deleted)
    const rQui = await this.db
      .selectFrom('quittance')
      .innerJoin('echeance_loyer', 'echeance_loyer.id', 'quittance.echeance_id')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('echeance_loyer.bail_id', '=', bailId)
      .executeTakeFirst();
    return Number(rQui?.n ?? 0) > 0;
  }
}
