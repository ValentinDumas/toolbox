import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import { Money } from '../../domain/_shared/money.js';
import type { BailleurId } from '../../domain/_shared/identifiants.js';

/**
 * Adapter SQLite — RecettesRepository (FIS-02, D-LOCK-2).
 *
 * Chaîne JOIN : encaissement e → echeance_loyer el → bail b.
 *
 * Note D-LOCK-2 (single-bailleur V1) : le bailleurId n'est pas utilisé en V1
 * car la table `bail` ne dispose pas encore de colonne bailleur_id (singleton).
 * JSDoc marqué pour V1.1 migration.
 *
 * Note D-FIS-G2.11 : rattachement par `e.date` (= datePaiement de l'encaissement).
 */
export class RecettesRepositorySqlite implements RecettesRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Somme des encaissements actifs pour une année (D-LOCK-2, D-FIS-G2.11).
   *
   * @param _bailleurId - V1.1 : filtrage par bailleur. En V1, ignoré (single-bailleur).
   * @param annee - exercice fiscal (ex: 2026)
   */
  async sommeRecettesAnnuelles(_bailleurId: BailleurId, annee: number): Promise<Money> {
    const result = await this.db
      .selectFrom('encaissement as e')
      .innerJoin('echeance_loyer as el', 'el.id', 'e.echeance_id')
      .innerJoin('bail as b', 'b.id', 'el.bail_id')
      .select((eb) => eb.fn.sum<number>('e.montant_centimes').as('total'))
      .where('e.annule_le', 'is', null)
      .where(
        (eb) => eb.fn('substr', ['e.date', eb.val(1), eb.val(4)]),
        '=',
        String(annee),
      )
      .executeTakeFirst();

    const total = result?.total ?? 0;

    // Si somme négative (compensateurs > paiements) → Money.zero()
    if (total <= 0) {
      return Money.zero();
    }
    return Money.fromCentimes(BigInt(Math.round(total)));
  }
}
