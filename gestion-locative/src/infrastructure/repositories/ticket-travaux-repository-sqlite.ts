import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type {
  BienId,
  JustificatifId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import {
  TicketTravaux,
  type StatutTicket,
  type NatureTicket,
} from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type {
  DB,
  TicketsTravauxTable,
} from '../db/kysely-types.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  bien_id: string;
  titre: string;
  description: string;
  date_ouverture: string;
  date_cloture: string | null;
  statut: TicketsTravauxTable['statut'];
  cout_estime_ttc_centimes: number | null;
  cout_reel_ttc_centimes: number | null;
  notes: string | null;
  cree_le: string;
  annule_le: string | null;
  raison_annulation: string | null;
  // Phase 5 — migration 0021
  nature: TicketsTravauxTable['nature'];
  nature_fiscale: TicketsTravauxTable['nature_fiscale'];
  qualifie_le_ticket?: string | null;
};

/**
 * Adapter SQLite pour TicketTravauxRepository (D-112 + D-113).
 *
 * Phase 5 extensions (migration 0021) :
 *   - versDomaine lit nature, nature_fiscale
 *   - versRow écrit nature, nature_fiscale
 *   - listerJustificatifsLies retourne Justificatif[] (au lieu de JustificatifId[])
 *     pour permettre au use case qualifier-ticket-travaux de les modifier
 *
 * - upsert via onConflict('id') sur les champs mutables (statut, dateCloture,
 *   coutEstime, coutReel, notes, annuleLe, raisonAnnulation, nature, natureFiscale).
 * - N:N pivot `ticket_justificatifs` : lier (idempotent onConflict doNothing) /
 *   delier (DELETE) / lister (JOIN justificatifs ORDER BY date_document DESC).
 */
export class TicketTravauxRepositorySqlite implements TicketTravauxRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(
    ticket: TicketTravaux,
    trxArg?: unknown,
  ): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const row = this.versRow(ticket);
    await db
      .insertInto('tickets_travaux')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          statut: row.statut,
          date_cloture: row.date_cloture,
          cout_estime_ttc_centimes: row.cout_estime_ttc_centimes,
          cout_reel_ttc_centimes: row.cout_reel_ttc_centimes,
          notes: row.notes,
          annule_le: row.annule_le,
          raison_annulation: row.raison_annulation,
          // Phase 5
          nature: row.nature,
          nature_fiscale: row.nature_fiscale,
        }),
      )
      .execute();
  }

  async trouverParId(
    id: TicketTravauxId | string,
  ): Promise<TicketTravaux | null> {
    const row = await this.db
      .selectFrom('tickets_travaux')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.versDomaine(row as Row) : null;
  }

  async listerParBien(
    bienId: BienId | string,
    opts?: { inclureAnnules?: boolean; statuts?: StatutTicket[] },
  ): Promise<TicketTravaux[]> {
    let q = this.db
      .selectFrom('tickets_travaux')
      .selectAll()
      .where('bien_id', '=', bienId);
    if (!opts?.inclureAnnules) {
      q = q.where('annule_le', 'is', null);
    }
    if (opts?.statuts !== undefined && opts.statuts.length > 0) {
      q = q.where('statut', 'in', opts.statuts);
    }
    const rows = await q.orderBy('date_ouverture', 'desc').execute();
    return rows.map((r) => this.versDomaine(r as Row));
  }

  async lierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trxArg?: unknown,
  ): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .insertInto('ticket_justificatifs')
      .values({ ticket_id: ticketId, justificatif_id: justificatifId })
      .onConflict((oc) =>
        oc.columns(['ticket_id', 'justificatif_id']).doNothing(),
      )
      .execute();
  }

  async delierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trxArg?: unknown,
  ): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .deleteFrom('ticket_justificatifs')
      .where('ticket_id', '=', ticketId)
      .where('justificatif_id', '=', justificatifId)
      .execute();
  }

  async listerJustificatifsLies(
    ticketId: TicketTravauxId | string,
  ): Promise<JustificatifId[]> {
    const rows = await this.db
      .selectFrom('ticket_justificatifs as tj')
      .innerJoin('justificatifs as j', 'j.id', 'tj.justificatif_id')
      .select(['j.id as id', 'j.date_document as date_document'])
      .where('tj.ticket_id', '=', ticketId)
      .orderBy('j.date_document', 'desc')
      .orderBy('j.id', 'desc')
      .execute();
    return rows.map((r) => r.id as JustificatifId);
  }

  private versDomaine(row: Row): TicketTravaux {
    return TicketTravaux.creer(
      {
        id: row.id as TicketTravauxId,
        bienId: row.bien_id as BienId,
        titre: row.titre,
        description: row.description,
        dateOuverture: Temporal.PlainDate.from(row.date_ouverture),
        dateCloture: row.date_cloture
          ? Temporal.PlainDate.from(row.date_cloture)
          : null,
        statut: row.statut as StatutTicket,
        coutEstimeTtc:
          row.cout_estime_ttc_centimes === null
            ? null
            : Money.fromCentimes(BigInt(row.cout_estime_ttc_centimes)),
        coutReelTtc:
          row.cout_reel_ttc_centimes === null
            ? null
            : Money.fromCentimes(BigInt(row.cout_reel_ttc_centimes)),
        notes: row.notes,
        creeLe: Temporal.PlainDate.from(row.cree_le),
        annuleLe: row.annule_le
          ? Temporal.PlainDate.from(row.annule_le)
          : null,
        raisonAnnulation: row.raison_annulation,
        // Phase 5
        nature: (row.nature as NatureTicket) ?? null,
        natureFiscale: (row.nature_fiscale as QualificationFiscale | null) ?? null,
        qualifieLeTicket: row.qualifie_le_ticket
          ? Temporal.PlainDate.from(row.qualifie_le_ticket)
          : null,
      },
      row.date_ouverture
        ? Temporal.PlainDate.from(row.date_ouverture)
        : Temporal.PlainDate.from('1900-01-01'),
    );
  }

  private versRow(t: TicketTravaux): Row {
    return {
      id: t.id,
      bien_id: t.bienId,
      titre: t.titre,
      description: t.description,
      date_ouverture: t.dateOuverture.toString(),
      date_cloture: t.dateCloture?.toString() ?? null,
      statut: t.statut,
      cout_estime_ttc_centimes:
        t.coutEstimeTtc === null ? null : t.coutEstimeTtc.toSqliteInteger(),
      cout_reel_ttc_centimes:
        t.coutReelTtc === null ? null : t.coutReelTtc.toSqliteInteger(),
      notes: t.notes,
      cree_le: t.creeLe.toString(),
      annule_le: t.annuleLe?.toString() ?? null,
      raison_annulation: t.raisonAnnulation,
      // Phase 5
      nature: t.nature as TicketsTravauxTable['nature'],
      nature_fiscale: t.natureFiscale as TicketsTravauxTable['nature_fiscale'],
      qualifie_le_ticket: t.qualifieLeTicket?.toString() ?? null,
    };
  }
}
