import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import { Quittance } from '../../domain/encaissements/quittance.js';
import { formatNumeroQuittance } from '../../helpers/format-numero-quittance.js';
import type { EcheanceLoyerId, QuittanceId } from '../../domain/_shared/identifiants.js';

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
    const db = (trxArg as Kysely<DB> | undefined) ?? this.db;
    await (db as Kysely<DB>)
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
   * Incrémente le compteur dans meta (UPSERT).
   * Si trxArg fourni, utilise trxArg pour l'atomicité.
   */
  async prochainNumero(annee: number, trxArg?: unknown): Promise<string> {
    const db = (trxArg as Kysely<DB> | undefined) ?? this.db;
    const cle = `compteur_quittance_${annee}`;

    const row = await (db as Kysely<DB>)
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', cle)
      .executeTakeFirst();

    let nextValue: number;

    if (!row) {
      nextValue = 1;
      await (db as Kysely<DB>)
        .insertInto('meta')
        .values({ cle, valeur: '1' })
        .execute();
    } else {
      nextValue = Number(row.valeur) + 1;
      await (db as Kysely<DB>)
        .updateTable('meta')
        .set({ valeur: String(nextValue) })
        .where('cle', '=', cle)
        .execute();
    }

    return formatNumeroQuittance(annee, nextValue);
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
