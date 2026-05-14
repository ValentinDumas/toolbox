import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import { Quittance } from '../../domain/encaissements/quittance.js';
import { formatNumeroQuittance } from '../../helpers/format-numero-quittance.js';
import type { EcheanceLoyerId, QuittanceId } from '../../domain/_shared/identifiants.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type QuittanceRow = {
  id: string;
  echeance_id: string;
  numero: string;
  chemin_fichier_relatif: string;
  emise_le: string;
  annulee_le: string | null;
  raison_annulation: string | null;
};

export class QuittanceRepositorySqlite implements QuittanceRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(quittance: Quittance, trxArg?: unknown): Promise<void> {
    // CR-03 : utiliser trxArg s'il est fourni (Transaction<DB> extends Kysely<DB>)
    // — sinon fallback explicite sur this.db.
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .insertInto('quittance')
      .values({
        id: quittance.id,
        echeance_id: quittance.echeanceId,
        numero: quittance.numero,
        chemin_fichier_relatif: quittance.cheminFichierRelatif,
        emise_le: quittance.emiseLe.toString(),
        annulee_le: quittance.annuleeLe?.toString() ?? null,
        raison_annulation: quittance.raisonAnnulation ?? null,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          annulee_le: quittance.annuleeLe?.toString() ?? null,
          raison_annulation: quittance.raisonAnnulation ?? null,
        }),
      )
      .execute();
  }

  async trouverParId(id: QuittanceId | string): Promise<Quittance | null> {
    const row = await this.db
      .selectFrom('quittance')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as QuittanceRow);
  }

  async trouverActiveParEcheance(echeanceId: EcheanceLoyerId | string): Promise<Quittance | null> {
    const row = await this.db
      .selectFrom('quittance')
      .selectAll()
      .where('echeance_id', '=', echeanceId)
      .where('annulee_le', 'is', null)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as QuittanceRow);
  }

  async listerToutes(opts?: { inclureAnnulees?: boolean }): Promise<Quittance[]> {
    let query = this.db.selectFrom('quittance').selectAll();

    if (!opts?.inclureAnnulees) {
      query = query.where('annulee_le', 'is', null);
    }

    const rows = await query.orderBy('emise_le', 'desc').execute();
    return rows.map((r) => this.versDomaine(r as QuittanceRow));
  }

  /**
   * Retourne le prochain numéro de quittance pour l'année donnée.
   *
   * CR-03 : opération atomique via UPSERT + RETURNING (SQLite >= 3.35).
   * Élimine la race condition SELECT-puis-UPDATE entre deux processus
   * concurrents qui auraient lu la même valeur et écrit le même numéro.
   *
   * Si trxArg fourni, utilise trxArg pour s'inscrire dans la transaction
   * du use case appelant.
   */
  async prochainNumero(annee: number, trxArg?: unknown): Promise<string> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const cle = `compteur_quittance_${annee}`;

    const row = await db
      .insertInto('meta')
      .values({ cle, valeur: '1' })
      .onConflict((oc) =>
        oc.column('cle').doUpdateSet({
          valeur: sql`CAST(CAST(meta.valeur AS INTEGER) + 1 AS TEXT)`,
        }),
      )
      .returning('valeur')
      .executeTakeFirstOrThrow();

    return formatNumeroQuittance(annee, Number(row.valeur));
  }

  private versDomaine(row: QuittanceRow): Quittance {
    return Quittance.creer({
      id: row.id as QuittanceId,
      echeanceId: row.echeance_id as EcheanceLoyerId,
      numero: row.numero,
      cheminFichierRelatif: row.chemin_fichier_relatif,
      emiseLe: Temporal.PlainDate.from(row.emise_le),
      annuleeLe: row.annulee_le ? Temporal.PlainDate.from(row.annulee_le) : null,
      raisonAnnulation: row.raison_annulation ?? null,
    });
  }
}
