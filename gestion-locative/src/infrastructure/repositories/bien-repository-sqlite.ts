import type { Kysely } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import type { DB } from '../db/kysely-types.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { Bien, type TypeBien } from '../../domain/patrimoine/bien.js';
import { Lot, type TypeLot } from '../../domain/patrimoine/lot.js';
import { Diagnostic } from '../../domain/patrimoine/diagnostic.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { BienId, DiagnosticId, LotId } from '../../domain/_shared/identifiants.js';
import type { ClasseDpe, TypeDiagnostic } from '../../domain/_shared/duree-validite-diagnostic.js';

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
          classe_dpe: bien.classeDpe ?? null,
        })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            rue: bien.adresse.rue,
            code_postal: bien.adresse.codePostal,
            ville: bien.adresse.ville,
            surface: bien.surface,
            type: bien.type,
            annee_construction: bien.anneeConstruction,
            classe_dpe: bien.classeDpe ?? null,
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

      // Purge + réinsertion atomique des diagnostics (DP-15, D-76)
      // Pattern Lot 01-03 — garantit la cohérence transactionnelle du sous-agrégat
      await trx.deleteFrom('diagnostics').where('bien_id', '=', bien.id).execute();

      if (bien.diagnostics.length > 0) {
        for (const d of bien.diagnostics) {
          await trx
            .insertInto('diagnostics')
            .values({
              id: d.id,
              bien_id: bien.id,
              type: d.type,
              date_emission: d.dateEmission.toString(),
              date_expiration: d.dateExpiration?.toString() ?? null,
              classe_dpe: d.classeDpe ?? null,
            })
            .execute();
        }
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

    const diagnosticsRows = await this.db
      .selectFrom('diagnostics')
      .selectAll()
      .where('bien_id', '=', id)
      .orderBy('date_emission', 'desc')
      .execute();

    return this.versDomaine(bienRow, lotRows, diagnosticsRows);
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

      const diagnosticsRows = await this.db
        .selectFrom('diagnostics')
        .selectAll()
        .where('bien_id', '=', bienRow.id)
        .orderBy('date_emission', 'desc')
        .execute();

      biens.push(this.versDomaine(bienRow, lotRows, diagnosticsRows));
    }

    return biens;
  }

  async supprimer(id: BienId): Promise<void> {
    const maintenant = new Date().toISOString();
    await this.db.transaction().execute(async (trx) => {
      await trx
        .updateTable('bien')
        .set({ supprime_le: maintenant })
        .where('id', '=', id)
        .execute();
      // Cascade soft-delete sur les lots associés (D-29 — cohérence de l'agrégat)
      await trx
        .updateTable('lot')
        .set({ supprime_le: maintenant })
        .where('bien_id', '=', id)
        .where('supprime_le', 'is', null)
        .execute();
      // Note: diagnostics pas supprimés — D-79 historique traçabilité plus-value LF 2025.
      // Ils sont liés au bien_id, requêtes futures filtreront par bien non supprimé.
    });
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
      classe_dpe?: string | null;
    },
    lotRows: Array<{
      id: string;
      designation: string;
      surface: number | null;
      type: string;
      etage: number | null;
    }>,
    diagnosticsRows: Array<{
      id: string;
      type: string;
      date_emission: string;
      date_expiration: string | null;
      classe_dpe: string | null;
    }> = [],
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

    // Reconstruction des diagnostics depuis les rows DB
    // Diagnostic.creer() recalcule dateExpiration depuis DUREES_VALIDITE — cohérence implicite.
    const diagnostics = diagnosticsRows.map((r) =>
      Diagnostic.creer({
        id: r.id as DiagnosticId,
        type: r.type as TypeDiagnostic,
        dateEmission: Temporal.PlainDate.from(r.date_emission),
        classeDpe: r.classe_dpe as ClasseDpe | null,
      }),
    );

    return Bien.creer({
      id: bienRow.id as BienId,
      adresse,
      surface: bienRow.surface,
      type: bienRow.type as TypeBien,
      anneeConstruction: bienRow.annee_construction,
      lots,
      diagnostics,
      classeDpe: (bienRow.classe_dpe as ClasseDpe | null | undefined) ?? null,
    });
  }
}
