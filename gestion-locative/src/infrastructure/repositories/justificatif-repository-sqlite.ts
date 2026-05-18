import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type {
  BienId,
  CheminRelatif,
  JustificatifId,
  LocataireId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import {
  Justificatif,
  type MimeJustificatif,
  type TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type {
  JustificatifPage,
  JustificatifRechercheFiltres,
  JustificatifRepository,
} from '../../domain/documents/justificatif-repository.js';
import type { DB, JustificatifsTable } from '../db/kysely-types.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  type: JustificatifsTable['type'];
  date_document: string;
  titre: string;
  montant_ttc_centimes: number | null;
  chemin_fichier: string;
  nom_fichier_original: string;
  mime_type: JustificatifsTable['mime_type'];
  taille_octets: number;
  bien_id: string | null;
  locataire_id: string | null;
  notes: string | null;
  cree_le: string;
  corbeille_le: string | null;
  raison_corbeille: string | null;
};

export class JustificatifRepositorySqlite implements JustificatifRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(justificatif: Justificatif, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const row = this.versRow(justificatif);

    await db
      .insertInto('justificatifs')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          titre: row.titre,
          montant_ttc_centimes: row.montant_ttc_centimes,
          notes: row.notes,
          corbeille_le: row.corbeille_le,
          raison_corbeille: row.raison_corbeille,
        }),
      )
      .execute();
  }

  async trouverParId(
    id: JustificatifId | string,
  ): Promise<Justificatif | null> {
    const row = await this.db
      .selectFrom('justificatifs')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.versDomaine(row as Row) : null;
  }

  async rechercher(
    filtres: JustificatifRechercheFiltres,
  ): Promise<JustificatifPage> {
    const pageSize = filtres.pageSize ?? 20;
    const page = filtres.page ?? 1;

    let q = this.db.selectFrom('justificatifs').selectAll();

    if (filtres.search !== undefined && filtres.search.trim().length > 0) {
      const pattern = `%${filtres.search.trim()}%`;
      q = q.where((eb) =>
        eb.or([
          eb('titre', 'like', pattern),
          eb('notes', 'like', pattern),
          eb('nom_fichier_original', 'like', pattern),
        ]),
      );
    }
    if (filtres.bienId !== undefined && filtres.bienId !== null) {
      q = q.where('bien_id', '=', filtres.bienId);
    }
    if (filtres.locataireId !== undefined && filtres.locataireId !== null) {
      q = q.where('locataire_id', '=', filtres.locataireId);
    }
    if (filtres.type !== undefined) {
      q = q.where('type', '=', filtres.type);
    }
    if (filtres.typeIn !== undefined && filtres.typeIn.length > 0) {
      q = q.where('type', 'in', filtres.typeIn);
    }
    if (filtres.anneeFiscale !== undefined) {
      q = q.where(
        (eb) => eb.fn('substr', ['date_document', eb.val(1), eb.val(4)]),
        '=',
        String(filtres.anneeFiscale),
      );
    }
    if (!filtres.inclureCorbeille) {
      q = q.where('corbeille_le', 'is', null);
    }

    // Count total with same filters
    let qCount = this.db
      .selectFrom('justificatifs')
      .select((eb) => eb.fn.countAll<number>().as('count'));
    if (filtres.search !== undefined && filtres.search.trim().length > 0) {
      const pattern = `%${filtres.search.trim()}%`;
      qCount = qCount.where((eb) =>
        eb.or([
          eb('titre', 'like', pattern),
          eb('notes', 'like', pattern),
          eb('nom_fichier_original', 'like', pattern),
        ]),
      );
    }
    if (filtres.bienId !== undefined && filtres.bienId !== null) {
      qCount = qCount.where('bien_id', '=', filtres.bienId);
    }
    if (filtres.locataireId !== undefined && filtres.locataireId !== null) {
      qCount = qCount.where('locataire_id', '=', filtres.locataireId);
    }
    if (filtres.type !== undefined) {
      qCount = qCount.where('type', '=', filtres.type);
    }
    if (filtres.typeIn !== undefined && filtres.typeIn.length > 0) {
      qCount = qCount.where('type', 'in', filtres.typeIn);
    }
    if (filtres.anneeFiscale !== undefined) {
      qCount = qCount.where(
        (eb) => eb.fn('substr', ['date_document', eb.val(1), eb.val(4)]),
        '=',
        String(filtres.anneeFiscale),
      );
    }
    if (!filtres.inclureCorbeille) {
      qCount = qCount.where('corbeille_le', 'is', null);
    }

    const totalRow = await qCount.executeTakeFirstOrThrow();
    const total = Number(totalRow.count);

    const rows = await q
      .orderBy('date_document', 'desc')
      .orderBy('id', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();

    return {
      items: rows.map((r) => this.versDomaine(r as Row)),
      total,
    };
  }

  async listerCorbeille(): Promise<Justificatif[]> {
    const rows = await this.db
      .selectFrom('justificatifs')
      .selectAll()
      .where('corbeille_le', 'is not', null)
      .orderBy('corbeille_le', 'desc')
      .execute();
    return rows.map((r) => this.versDomaine(r as Row));
  }

  async supprimerDefinitivement(
    id: JustificatifId,
    trxArg?: unknown,
  ): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db.deleteFrom('justificatifs').where('id', '=', id).execute();
  }

  private versDomaine(row: Row): Justificatif {
    return Justificatif.creer({
      id: row.id as JustificatifId,
      type: row.type as TypeJustificatif,
      dateDocument: Temporal.PlainDate.from(row.date_document),
      titre: row.titre,
      montantTtc:
        row.montant_ttc_centimes === null
          ? null
          : Money.fromCentimes(BigInt(row.montant_ttc_centimes)),
      cheminFichier: row.chemin_fichier as CheminRelatif,
      nomFichierOriginal: row.nom_fichier_original,
      mimeType: row.mime_type as MimeJustificatif,
      tailleOctets: row.taille_octets,
      bienId: (row.bien_id as BienId | null) ?? null,
      locataireId: (row.locataire_id as LocataireId | null) ?? null,
      notes: row.notes,
      creeLe: Temporal.PlainDate.from(row.cree_le),
      corbeilleLe: row.corbeille_le
        ? Temporal.PlainDate.from(row.corbeille_le)
        : null,
      raisonCorbeille: row.raison_corbeille,
    });
  }

  private versRow(j: Justificatif): Row {
    return {
      id: j.id,
      type: j.type,
      date_document: j.dateDocument.toString(),
      titre: j.titre,
      montant_ttc_centimes:
        j.montantTtc === null ? null : j.montantTtc.toSqliteInteger(),
      chemin_fichier: j.cheminFichier,
      nom_fichier_original: j.nomFichierOriginal,
      mime_type: j.mimeType,
      taille_octets: j.tailleOctets,
      bien_id: j.bienId ?? null,
      locataire_id: j.locataireId ?? null,
      notes: j.notes,
      cree_le: j.creeLe.toString(),
      corbeille_le: j.corbeilleLe?.toString() ?? null,
      raison_corbeille: j.raisonCorbeille,
    };
  }
}
