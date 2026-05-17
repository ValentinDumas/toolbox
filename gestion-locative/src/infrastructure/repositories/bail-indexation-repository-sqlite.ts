import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import { BailIndexation, type RaisonNonApplication } from '../../domain/locatif/bail-indexation.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import type {
  BailId,
  BailIndexationId,
} from '../../domain/_shared/identifiants.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type BailIndexationRow = {
  id: string;
  bail_id: string;
  date_effet: string;
  irl_avant_trimestre: string;
  irl_avant_valeur: string;
  irl_apres_trimestre: string;
  irl_apres_valeur: string;
  loyer_avant_centimes: number;
  loyer_apres_centimes: number;
  indexation_appliquee: number;
  raison_non_application: string | null;
};

/**
 * Adapter SQLite — BailIndexationRepository.
 *
 * Append-only strict (D-96) : enregistrer fait UNIQUEMENT un INSERT.
 * Pas d'`onConflict` ni d'UPDATE — une réinsertion sur même `id` produira
 * une UNIQUE constraint violation (comportement attendu, voir test T20).
 */
export class BailIndexationRepositorySqlite implements BailIndexationRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(bi: BailIndexation, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .insertInto('bail_indexations')
      .values({
        id: bi.id,
        bail_id: bi.bailId,
        date_effet: bi.dateEffet.toString(),
        irl_avant_trimestre: bi.irlAvant.trimestre,
        irl_avant_valeur: bi.irlAvant.valeur,
        irl_apres_trimestre: bi.irlApres.trimestre,
        irl_apres_valeur: bi.irlApres.valeur,
        loyer_avant_centimes: bi.loyerAvant.toSqliteInteger(),
        loyer_apres_centimes: bi.loyerApres.toSqliteInteger(),
        indexation_appliquee: bi.indexationAppliquee ? 1 : 0,
        raison_non_application: bi.raisonNonApplication,
      })
      .execute();
  }

  async trouverParId(id: BailIndexationId): Promise<BailIndexation | null> {
    const row = await this.db
      .selectFrom('bail_indexations')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as BailIndexationRow);
  }

  async listerParBail(bailId: BailId): Promise<BailIndexation[]> {
    const rows = await this.db
      .selectFrom('bail_indexations')
      .selectAll()
      .where('bail_id', '=', bailId)
      .orderBy('date_effet', 'desc')
      .execute();

    return rows.map((r) => this.versDomaine(r as BailIndexationRow));
  }

  async dernierePourBail(bailId: BailId): Promise<BailIndexation | null> {
    const row = await this.db
      .selectFrom('bail_indexations')
      .selectAll()
      .where('bail_id', '=', bailId)
      .orderBy('date_effet', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as BailIndexationRow);
  }

  private versDomaine(row: BailIndexationRow): BailIndexation {
    return BailIndexation.creer({
      id: row.id as BailIndexationId,
      bailId: row.bail_id as BailId,
      dateEffet: Temporal.PlainDate.from(row.date_effet),
      irlAvant: IRL.creer({
        trimestre: row.irl_avant_trimestre,
        valeur: row.irl_avant_valeur,
      }),
      irlApres: IRL.creer({
        trimestre: row.irl_apres_trimestre,
        valeur: row.irl_apres_valeur,
      }),
      loyerAvant: Money.fromCentimes(BigInt(row.loyer_avant_centimes)),
      loyerApres: Money.fromCentimes(BigInt(row.loyer_apres_centimes)),
      indexationAppliquee: row.indexation_appliquee === 1,
      raisonNonApplication: row.raison_non_application as RaisonNonApplication | null,
    });
  }
}
