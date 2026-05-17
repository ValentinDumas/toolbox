/**
 * Adapter SQLite pour EtatDesLieuxRepository — LOC-03 (D-82, D-86, D-89).
 * Pattern QuittanceRepositorySqlite (versDomaine + versRow + upsert via onConflict).
 */
import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
import { EtatDesLieux, type TypeEDL } from '../../domain/locatif/etat-des-lieux.js';
import { InventaireItem } from '../../domain/_shared/inventaire-item.js';
import type { BailId, EtatDesLieuxId } from '../../domain/_shared/identifiants.js';

export class EtatDesLieuxRepositorySqlite implements EtatDesLieuxRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(edl: EtatDesLieux): Promise<void> {
    await this.db
      .insertInto('etat_des_lieux')
      .values({
        id: edl.id,
        bail_id: edl.bailId,
        type: edl.type,
        date_edl: edl.dateEdl.toString(),
        contradictoire: edl.contradictoire ? 1 : 0,
        date_signature: edl.dateSignature?.toString() ?? null,
        inventaire: JSON.stringify(edl.inventaire.map((i) => i.toJSON())),
        annule_le: edl.annuleLe?.toString() ?? null,
        raison_annulation: edl.raisonAnnulation ?? null,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          // Seul le soft-delete est mis à jour via upsert (invariant : inventaire immuable après création)
          annule_le: edl.annuleLe?.toString() ?? null,
          raison_annulation: edl.raisonAnnulation ?? null,
        }),
      )
      .execute();
  }

  async trouverParId(id: EtatDesLieuxId): Promise<EtatDesLieux | null> {
    const row = await this.db
      .selectFrom('etat_des_lieux')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row);
  }

  async trouverActifParBailEtType(bailId: BailId, type: TypeEDL): Promise<EtatDesLieux | null> {
    const row = await this.db
      .selectFrom('etat_des_lieux')
      .selectAll()
      .where('bail_id', '=', bailId)
      .where('type', '=', type)
      .where('annule_le', 'is', null)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row);
  }

  async listerParBail(bailId: BailId): Promise<EtatDesLieux[]> {
    const rows = await this.db
      .selectFrom('etat_des_lieux')
      .selectAll()
      .where('bail_id', '=', bailId)
      .orderBy('cree_le', 'desc')
      .execute();

    return rows.map((row) => this.versDomaine(row));
  }

  private versDomaine(row: {
    id: string;
    bail_id: string;
    type: string;
    date_edl: string;
    contradictoire: 0 | 1;
    date_signature: string | null;
    inventaire: string;
    annule_le: string | null;
    raison_annulation: string | null;
  }): EtatDesLieux {
    const inventaireData = JSON.parse(row.inventaire) as Array<{
      typeItem: string;
      present: boolean;
      etat: string | null;
      note: string | null;
    }>;

    const inventaire = inventaireData.map((p) =>
      InventaireItem.creer({
        typeItem: p.typeItem as any,
        present: p.present,
        etat: p.etat as any,
        note: p.note,
      }),
    );

    return EtatDesLieux.creer({
      id: row.id as EtatDesLieuxId,
      bailId: row.bail_id as BailId,
      type: row.type as TypeEDL,
      dateEdl: Temporal.PlainDate.from(row.date_edl),
      contradictoire: row.contradictoire === 1,
      dateSignature: row.date_signature ? Temporal.PlainDate.from(row.date_signature) : null,
      inventaire,
      annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
      raisonAnnulation: row.raison_annulation,
    });
  }
}
