import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import { Encaissement, type ModeEncaissement } from '../../domain/encaissements/encaissement.js';
import { Money } from '../../domain/_shared/money.js';
import type { EcheanceLoyerId, EncaissementId } from '../../domain/_shared/identifiants.js';

type EncaissementRow = {
  id: string;
  echeance_id: string;
  montant_centimes: number;
  date: string;
  mode: ModeEncaissement;
  annule_le: string | null;
  raison_annulation: string | null;
};

/**
 * Adapter SQLite pour EncaissementRepository.
 *
 * Montants négatifs : montant_centimes peut être < 0 (compensateurs D-60).
 * Pas de CHECK >= 0 en base — géré au niveau domaine.
 */
export class EncaissementRepositorySqlite implements EncaissementRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(encaissement: Encaissement): Promise<void> {
    await this.db
      .insertInto('encaissement')
      .values({
        id: encaissement.id,
        echeance_id: encaissement.echeanceId,
        montant_centimes: Number(encaissement.montant.toCentimes()),
        date: encaissement.date.toString(),
        mode: encaissement.mode,
        annule_le: encaissement.annuleLe?.toString() ?? null,
        raison_annulation: encaissement.raisonAnnulation ?? null,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          annule_le: encaissement.annuleLe?.toString() ?? null,
          raison_annulation: encaissement.raisonAnnulation ?? null,
        }),
      )
      .execute();
  }

  async trouverParId(id: EncaissementId | string): Promise<Encaissement | null> {
    const row = await this.db
      .selectFrom('encaissement')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as EncaissementRow);
  }

  async listerParEcheance(
    echeanceId: EcheanceLoyerId | string,
    opts?: { inclureAnnules?: boolean },
  ): Promise<Encaissement[]> {
    let query = this.db
      .selectFrom('encaissement')
      .selectAll()
      .where('echeance_id', '=', echeanceId);

    if (opts?.inclureAnnules === false) {
      query = query.where('annule_le', 'is', null);
    }

    const rows = await query.orderBy('cree_le', 'asc').execute();
    return rows.map((r) => this.versDomaine(r as EncaissementRow));
  }

  async listerTous(opts?: { inclureAnnules?: boolean }): Promise<Encaissement[]> {
    let query = this.db.selectFrom('encaissement').selectAll();

    if (opts?.inclureAnnules === false) {
      query = query.where('annule_le', 'is', null);
    }

    const rows = await query.orderBy('date', 'desc').execute();
    return rows.map((r) => this.versDomaine(r as EncaissementRow));
  }

  async sommePaieeParEcheance(echeanceId: EcheanceLoyerId | string): Promise<Money> {
    const result = await this.db
      .selectFrom('encaissement')
      .select((eb) => eb.fn.sum<number>('montant_centimes').as('total'))
      .where('echeance_id', '=', echeanceId)
      .where('annule_le', 'is', null)
      .executeTakeFirst();

    const total = result?.total ?? 0;

    if (total >= 0) {
      return Money.fromCentimes(BigInt(Math.round(total)));
    }
    // Somme négative (compensateurs supérieurs aux paiements)
    return Money.compensateur(Money.fromCentimes(BigInt(Math.round(-total))));
  }

  private versDomaine(row: EncaissementRow): Encaissement {
    const centimes = row.montant_centimes;
    const montant =
      centimes >= 0
        ? Money.fromCentimes(BigInt(centimes))
        : Money.compensateur(Money.fromCentimes(BigInt(-centimes)));

    return Encaissement.creer({
      id: row.id as EncaissementId,
      echeanceId: row.echeance_id as EcheanceLoyerId,
      montant,
      date: Temporal.PlainDate.from(row.date),
      mode: row.mode,
      annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
      raisonAnnulation: row.raison_annulation,
    });
  }
}
