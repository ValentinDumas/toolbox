/**
 * Adapter SQLite — DeclarationCfeRepositorySqlite (Phase 6 / FIS-06 / D-CFE6.2).
 *
 * Upsert composite : `onConflict.columns(['bien_id', 'millesime'])` —
 * la clé d'idempotence métier est (bien_id, millesime), PAS `id` (D-CFE6.2).
 *
 * Différence vs DeclarationAnnuelleRepositorySqlite (append-only strict) :
 *   - CFE permet l'édition d'une déclaration existante → `doUpdateSet`.
 *   - DeclarationAnnuelle interdit la double clôture → pas de `onConflict`.
 *
 * Pattern miroir partiel : ticket-travaux-repository-sqlite.ts (upsert) +
 * declaration-annuelle-repository-sqlite.ts (mapping versDomaine/versRow).
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type { DB, StatutCfeRow } from '../db/kysely-types.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import { DeclarationCfe } from '../../domain/fiscalite/cfe/declaration-cfe.js';
import type { StatutCfe } from '../../domain/fiscalite/cfe/statut-cfe.js';
import type {
  BienId,
  DeclarationCfeId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  bien_id: string;
  millesime: number;
  statut: StatutCfeRow;
  date_depot_declaration: string | null;
  montant_avis_centimes: number | null;
  date_echeance_paiement: string;
};

export class DeclarationCfeRepositorySqlite implements DeclarationCfeRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(decl: DeclarationCfe, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const row = this.versRow(decl);
    await db
      .insertInto('declarations_cfe')
      .values(row)
      .onConflict((oc) =>
        oc.columns(['bien_id', 'millesime']).doUpdateSet({
          statut: row.statut,
          date_depot_declaration: row.date_depot_declaration,
          montant_avis_centimes: row.montant_avis_centimes,
          date_echeance_paiement: row.date_echeance_paiement,
        }),
      )
      .execute();
  }

  async trouverParId(id: DeclarationCfeId | string): Promise<DeclarationCfe | null> {
    const row = await this.db
      .selectFrom('declarations_cfe')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? this.versDomaine(row as Row) : null;
  }

  async trouverParBienMillesime(
    bienId: BienId,
    millesime: number,
  ): Promise<DeclarationCfe | null> {
    const row = await this.db
      .selectFrom('declarations_cfe')
      .selectAll()
      .where('bien_id', '=', bienId)
      .where('millesime', '=', millesime)
      .executeTakeFirst();
    return row ? this.versDomaine(row as Row) : null;
  }

  async listerParBien(bienId: BienId | string): Promise<DeclarationCfe[]> {
    const rows = await this.db
      .selectFrom('declarations_cfe')
      .selectAll()
      .where('bien_id', '=', bienId)
      .orderBy('millesime', 'desc')
      .execute();
    return rows.map((r) => this.versDomaine(r as Row));
  }

  private versDomaine(row: Row): DeclarationCfe {
    return DeclarationCfe.creer({
      id: row.id as DeclarationCfeId,
      bienId: row.bien_id as BienId,
      millesime: row.millesime,
      statut: row.statut as StatutCfe,
      dateDepotDeclaration: row.date_depot_declaration
        ? Temporal.PlainDate.from(row.date_depot_declaration)
        : null,
      montantAvisCentimes:
        row.montant_avis_centimes !== null
          ? Money.fromCentimes(BigInt(row.montant_avis_centimes))
          : null,
      dateEcheancePaiement: Temporal.PlainDate.from(row.date_echeance_paiement),
    });
  }

  private versRow(decl: DeclarationCfe): Row {
    return {
      id: decl.id,
      bien_id: decl.bienId,
      millesime: decl.millesime,
      statut: decl.statut as StatutCfeRow,
      date_depot_declaration: decl.dateDepotDeclaration
        ? decl.dateDepotDeclaration.toString()
        : null,
      montant_avis_centimes:
        decl.montantAvisCentimes !== null
          ? decl.montantAvisCentimes.toSqliteInteger()
          : null,
      date_echeance_paiement: decl.dateEcheancePaiement.toString(),
    };
  }
}
