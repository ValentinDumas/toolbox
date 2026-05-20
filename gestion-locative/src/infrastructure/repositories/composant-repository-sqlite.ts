/**
 * Adapters SQLite — ComposantRepositorySqlite + ValorisationFiscaleRepositorySqlite.
 *
 * Implémentent les ports ComposantRepository + ValorisationFiscaleRepository (Phase 5).
 * Pattern : analog justificatif-repository-sqlite.ts (versDomaine + versRow + onConflict).
 *
 * D-FIS-G1.1, G1.4, G5.2 — hexagonal strict (pas d'import domaine dans cette couche sauf types).
 * Sources : BOFIP-BIC-AMT-10-20 §110, D-FIS-G1.1 à G1.8.
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import {
  Composant,
  type OrigineKindComposant,
  type MotifSortieComposant,
} from '../../domain/fiscalite/composant.js';
import type { TypeComposantBofip } from '../../domain/fiscalite/regles/regles-2026.js';
import { ValorisationFiscale } from '../../domain/fiscalite/valorisation-fiscale.js';
import type {
  ComposantRepository,
  ValorisationFiscaleRepository,
} from '../../domain/fiscalite/composant-repository.js';
import type {
  BienId,
  BailleurId,
  ComposantId,
  ValorisationFiscaleId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import type { DB, BienComposantTable, BienValorisationFiscaleTable } from '../db/kysely-types.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

// ─── Row types ───────────────────────────────────────────────────────────────

type ComposantRow = {
  id: string;
  bien_id: string;
  type: BienComposantTable['type'];
  montant_ht_centimes: number;
  date_acquisition: string;
  origine_kind: BienComposantTable['origine_kind'];
  ticket_id: string | null;
  date_sortie: string | null;
  motif_sortie: BienComposantTable['motif_sortie'];
  cree_le: string;
};

/** Ligne d'insertion — cree_le fourni explicitement (DEFAULT ignoré) */
type ComposantInsertRow = Omit<ComposantRow, 'cree_le'> & { cree_le: string };

type ValorisationFiscaleRow = {
  id: string;
  bien_id: string;
  prix_acquisition_centimes: number;
  date_acquisition: string;
  frais_notaire_centimes: number;
  frais_agence_centimes: number;
  quote_part_terrain_ratio: number;
  active_le: string;
};

// ─── ComposantRepositorySqlite ────────────────────────────────────────────────

/**
 * Adapter SQLite pour ComposantRepository (D-FIS-G1.1, G1.5, G5.2).
 *
 * Séparé de ValorisationFiscaleRepositorySqlite (SOLID SRP — évolution indépendante).
 */
export class ComposantRepositorySqlite implements ComposantRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Enregistre ou met à jour un Composant.
   * onConflict doUpdateSet : gère la mise à jour du dateSortie (sortir()).
   */
  async enregistrer(composant: Composant, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const row = this.versRow(composant);

    await db
      .insertInto('bien_composant')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          montant_ht_centimes: row.montant_ht_centimes,
          date_sortie: row.date_sortie,
          motif_sortie: row.motif_sortie,
        }),
      )
      .execute();
  }

  /**
   * Enregistre un batch de Composants en une seule transaction.
   * Utilisé par activer-fiscalite-bien (6 composants initiaux).
   */
  async enregistrerBatch(composants: Composant[], trxArg?: unknown): Promise<void> {
    if (composants.length === 0) return;
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const rows = composants.map((c) => this.versRow(c));

    await db.insertInto('bien_composant').values(rows).execute();
  }

  async trouverParId(id: ComposantId): Promise<Composant | null> {
    const row = await this.db
      .selectFrom('bien_composant')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.versDomaine(row as ComposantRow) : null;
  }

  /**
   * Liste les Composants actifs (dateSortie IS NULL OR dateSortie > today).
   * D-FIS-G1.6 : utilisé pour le calcul d'amortissement de l'exercice.
   */
  async listerActifsParBien(bienId: BienId, today: Temporal.PlainDate): Promise<Composant[]> {
    const rows = await this.db
      .selectFrom('bien_composant')
      .selectAll()
      .where('bien_id', '=', bienId)
      .where((eb) =>
        eb.or([
          eb('date_sortie', 'is', null),
          eb('date_sortie', '>', today.toString()),
        ]),
      )
      .execute();

    return rows.map((r) => this.versDomaine(r as ComposantRow));
  }

  /** Liste TOUS les Composants d'un bien (actifs + sortis) */
  async listerParBien(bienId: BienId): Promise<Composant[]> {
    const rows = await this.db
      .selectFrom('bien_composant')
      .selectAll()
      .where('bien_id', '=', bienId)
      .execute();

    return rows.map((r) => this.versDomaine(r as ComposantRow));
  }

  /**
   * Liste tous les Composants actifs pour un bailleur (JOIN via bien).
   * D-LOCK-2 (single-bailleur V1) : pas de filtre SQL bailleurId en V1.
   * Le paramètre bailleurId est conservé pour V1.1 multi-bailleur.
   */
  async listerActifsPourBailleur(_bailleurId: BailleurId, today: Temporal.PlainDate): Promise<Composant[]> {
    const rows = await this.db
      .selectFrom('bien_composant as bc')
      .innerJoin('bien as b', 'b.id', 'bc.bien_id')
      .selectAll('bc')
      .where((eb) =>
        eb.or([
          eb('bc.date_sortie', 'is', null),
          eb('bc.date_sortie', '>', today.toString()),
        ]),
      )
      .where('b.supprime_le', 'is', null)
      .execute();

    return rows.map((r) => this.versDomaine(r as ComposantRow));
  }

  private versDomaine(row: ComposantRow): Composant {
    return Composant.creer({
      id: row.id as ComposantId,
      bienId: row.bien_id as BienId,
      type: row.type as TypeComposantBofip,
      montantHt: Money.fromCentimes(BigInt(row.montant_ht_centimes)),
      dateAcquisition: Temporal.PlainDate.from(row.date_acquisition),
      origineKind: row.origine_kind as OrigineKindComposant,
      ticketId: row.ticket_id ? (row.ticket_id as TicketTravauxId) : null,
      dateSortie: row.date_sortie ? Temporal.PlainDate.from(row.date_sortie) : null,
      motifSortie: row.motif_sortie ? (row.motif_sortie as MotifSortieComposant) : null,
    });
  }

  private versRow(composant: Composant): ComposantInsertRow {
    return {
      id: composant.id,
      bien_id: composant.bienId,
      type: composant.type,
      montant_ht_centimes: composant.montantHt.toSqliteInteger(),
      date_acquisition: composant.dateAcquisition.toString(),
      origine_kind: composant.origineKind,
      ticket_id: composant.ticketId,
      date_sortie: composant.dateSortie ? composant.dateSortie.toString() : null,
      motif_sortie: composant.motifSortie,
      cree_le: new Date().toISOString(),
    };
  }
}

// ─── ValorisationFiscaleRepositorySqlite ─────────────────────────────────────

/**
 * Adapter SQLite pour ValorisationFiscaleRepository (D-FIS-G1.4).
 *
 * Séparé de ComposantRepositorySqlite (SOLID SRP).
 * UNIQUE(bien_id) assure l'idempotence (T-05-03-01).
 */
export class ValorisationFiscaleRepositorySqlite implements ValorisationFiscaleRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Enregistre la valorisation fiscale.
   * INSERT simple — la contrainte UNIQUE bien_id en DB est la défense de profondeur.
   * Le use case activer-fiscalite-bien vérifie en amont (trouverParBien) pour lever
   * BienDejaActifFiscalement avant toute écriture.
   */
  async enregistrer(valorisation: ValorisationFiscale, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const row = this.versRow(valorisation);

    await db.insertInto('bien_valorisation_fiscale').values(row).execute();
  }

  /** Lookup par bienId — null si fiscalité non activée */
  async trouverParBien(bienId: BienId): Promise<ValorisationFiscale | null> {
    const row = await this.db
      .selectFrom('bien_valorisation_fiscale')
      .selectAll()
      .where('bien_id', '=', bienId)
      .executeTakeFirst();

    return row ? this.versDomaine(row as ValorisationFiscaleRow) : null;
  }

  /** Lookup par id */
  async trouverParId(id: ValorisationFiscaleId): Promise<ValorisationFiscale | null> {
    const row = await this.db
      .selectFrom('bien_valorisation_fiscale')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.versDomaine(row as ValorisationFiscaleRow) : null;
  }

  private versDomaine(row: ValorisationFiscaleRow): ValorisationFiscale {
    return ValorisationFiscale.creer({
      id: row.id as ValorisationFiscaleId,
      bienId: row.bien_id as BienId,
      prixAcquisition: Money.fromCentimes(BigInt(row.prix_acquisition_centimes)),
      dateAcquisition: Temporal.PlainDate.from(row.date_acquisition),
      fraisNotaire: Money.fromCentimes(BigInt(row.frais_notaire_centimes)),
      fraisAgence: Money.fromCentimes(BigInt(row.frais_agence_centimes)),
      quotePartTerrainRatio: row.quote_part_terrain_ratio,
      activeLe: Temporal.PlainDateTime.from(row.active_le),
    });
  }

  private versRow(valorisation: ValorisationFiscale): BienValorisationFiscaleTable {
    return {
      id: valorisation.id,
      bien_id: valorisation.bienId,
      prix_acquisition_centimes: valorisation.prixAcquisition.toSqliteInteger(),
      date_acquisition: valorisation.dateAcquisition.toString(),
      frais_notaire_centimes: valorisation.fraisNotaire.toSqliteInteger(),
      frais_agence_centimes: valorisation.fraisAgence.toSqliteInteger(),
      quote_part_terrain_ratio: valorisation.quotePartTerrainRatio,
      active_le: valorisation.activeLe.toString(),
    };
  }
}
