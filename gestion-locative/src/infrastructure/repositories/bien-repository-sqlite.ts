import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { Bien, type TypeBien } from '../../domain/patrimoine/bien.js';
import { Lot, type TypeLot } from '../../domain/patrimoine/lot.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { BienId, LotId } from '../../domain/_shared/identifiants.js';

export class BienRepositorySqlite implements BienRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(bien: Bien): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('bien')
        .values({
          id: bien.id,
          rue: bien.adresse.rue,
          code_postal: bien.adresse.codePostal,
          ville: bien.adresse.ville,
          surface: bien.surface,
          type: bien.type,
          annee_construction: bien.anneeConstruction,
        })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            rue: bien.adresse.rue,
            code_postal: bien.adresse.codePostal,
            ville: bien.adresse.ville,
            surface: bien.surface,
            type: bien.type,
            annee_construction: bien.anneeConstruction,
            modifie_le: new Date().toISOString(),
          }),
        )
        .execute();

      // Suppression puis réinsertion des lots (approche simple — atomique dans la transaction)
      await trx.deleteFrom('lot').where('bien_id', '=', bien.id).execute();

      for (const lot of bien.lots) {
        await trx
          .insertInto('lot')
          .values({
            id: lot.id,
            bien_id: bien.id,
            designation: lot.designation,
            surface: lot.surface ?? null,
            type: lot.type,
            etage: lot.etage ?? null,
          })
          .execute();
      }
    });
  }

  async trouverParId(id: BienId): Promise<Bien | null> {
    const bienRow = await this.db
      .selectFrom('bien')
      .selectAll()
      .where('id', '=', id)
      .where('supprime_le', 'is', null)
      .executeTakeFirst();

    if (!bienRow) return null;

    const lotRows = await this.db
      .selectFrom('lot')
      .selectAll()
      .where('bien_id', '=', id)
      .where('supprime_le', 'is', null)
      .execute();

    return this.versDomaine(bienRow, lotRows);
  }

  async listerTous(): Promise<Bien[]> {
    const bienRows = await this.db
      .selectFrom('bien')
      .selectAll()
      .where('supprime_le', 'is', null)
      .orderBy('cree_le', 'desc')
      .execute();

    const biens: Bien[] = [];
    for (const bienRow of bienRows) {
      const lotRows = await this.db
        .selectFrom('lot')
        .selectAll()
        .where('bien_id', '=', bienRow.id)
        .where('supprime_le', 'is', null)
        .execute();
      biens.push(this.versDomaine(bienRow, lotRows));
    }

    return biens;
  }

  async supprimer(id: BienId): Promise<void> {
    await this.db
      .updateTable('bien')
      .set({ supprime_le: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }

  private versDomaine(
    bienRow: {
      id: string;
      rue: string;
      code_postal: string;
      ville: string;
      surface: number;
      type: string;
      annee_construction: number;
    },
    lotRows: Array<{
      id: string;
      designation: string;
      surface: number | null;
      type: string;
      etage: number | null;
    }>,
  ): Bien {
    const adresse = Adresse.creer({
      rue: bienRow.rue,
      codePostal: bienRow.code_postal,
      ville: bienRow.ville,
    });

    const lots = lotRows.map((r) =>
      Lot.creer({
        id: r.id as LotId,
        designation: r.designation,
        surface: r.surface,
        type: r.type as TypeLot,
        etage: r.etage,
      }),
    );

    return Bien.creer({
      id: bienRow.id as BienId,
      adresse,
      surface: bienRow.surface,
      type: bienRow.type as TypeBien,
      anneeConstruction: bienRow.annee_construction,
      lots,
    });
  }
}
