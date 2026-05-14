import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import { Bail } from '../../domain/locatif/bail.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import { Cautionnement } from '../../domain/locatif/cautionnement.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { BailId, BienId, LotId, LocataireId } from '../../domain/_shared/identifiants.js';

export class BailRepositorySqlite implements BailRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(bail: Bail): Promise<void> {
    const cautionnementJson = bail.cautionnement
      ? JSON.stringify(bail.cautionnement.toJSON())
      : null;

    await this.db.transaction().execute(async (trx) => {
      // Upsert du bail — T-05-03 : Money converti en number (centimes INTEGER)
      await trx
        .insertInto('bail')
        .values({
          id: bail.id,
          locataire_id: bail.locataireId,
          bien_id: bail.bienId,
          type: bail.type,
          date_debut: bail.dateDebut.toString(),
          duree_mois: bail.dureeMois,
          loyer_hc: bail.loyerHc.toSqliteInteger(),
          mode_charges: bail.modeCharges,
          montant_charges: bail.montantCharges.toSqliteInteger(),
          depot_garantie: bail.depotGarantie.toSqliteInteger(),
          irl_trimestre: bail.irlReference.trimestre,
          irl_valeur: bail.irlReference.valeur,
          cautionnement: cautionnementJson,
          actif_depuis: bail.actifDepuis?.toString() ?? null,
          jour_echeance: bail.jourEcheance,
        })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            locataire_id: bail.locataireId,
            bien_id: bail.bienId,
            date_debut: bail.dateDebut.toString(),
            duree_mois: bail.dureeMois,
            loyer_hc: bail.loyerHc.toSqliteInteger(),
            mode_charges: bail.modeCharges,
            montant_charges: bail.montantCharges.toSqliteInteger(),
            depot_garantie: bail.depotGarantie.toSqliteInteger(),
            irl_trimestre: bail.irlReference.trimestre,
            irl_valeur: bail.irlReference.valeur,
            cautionnement: cautionnementJson,
            actif_depuis: bail.actifDepuis?.toString() ?? null,
            jour_echeance: bail.jourEcheance,
            modifie_le: new Date().toISOString(),
          }),
        )
        .execute();

      // Purge + réinsertion des lots (garantit cohérence si modification)
      await trx.deleteFrom('bail_lots').where('bail_id', '=', bail.id).execute();

      for (const lotId of bail.lotIds) {
        await trx
          .insertInto('bail_lots')
          .values({ bail_id: bail.id, lot_id: lotId })
          .execute();
      }
    });
  }

  async trouverParId(id: BailId): Promise<Bail | null> {
    const row = await this.db
      .selectFrom('bail')
      .selectAll()
      .where('id', '=', id)
      .where('supprime_le', 'is', null)
      .executeTakeFirst();

    if (!row) return null;

    const lotRows = await this.db
      .selectFrom('bail_lots')
      .select('lot_id')
      .where('bail_id', '=', id)
      .execute();

    const lotIds = lotRows.map((r) => r.lot_id as LotId);

    return this.versDomaine(row, lotIds);
  }

  async listerTous(): Promise<Bail[]> {
    const rows = await this.db
      .selectFrom('bail')
      .selectAll()
      .where('supprime_le', 'is', null)
      .orderBy('cree_le', 'desc')
      .execute();

    const baux: Bail[] = [];
    for (const row of rows) {
      const lotRows = await this.db
        .selectFrom('bail_lots')
        .select('lot_id')
        .where('bail_id', '=', row.id)
        .execute();
      baux.push(this.versDomaine(row, lotRows.map((r) => r.lot_id as LotId)));
    }
    return baux;
  }

  async listerParLocataire(locataireId: LocataireId): Promise<Bail[]> {
    const rows = await this.db
      .selectFrom('bail')
      .selectAll()
      .where('locataire_id', '=', locataireId)
      .where('supprime_le', 'is', null)
      .orderBy('cree_le', 'desc')
      .execute();

    const baux: Bail[] = [];
    for (const row of rows) {
      const lotRows = await this.db
        .selectFrom('bail_lots')
        .select('lot_id')
        .where('bail_id', '=', row.id)
        .execute();
      baux.push(this.versDomaine(row, lotRows.map((r) => r.lot_id as LotId)));
    }
    return baux;
  }

  async supprimer(id: BailId): Promise<void> {
    await this.db
      .updateTable('bail')
      .set({ supprime_le: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }

  private versDomaine(
    row: {
      id: string;
      locataire_id: string;
      bien_id: string;
      type: string;
      date_debut: string;
      duree_mois: number;
      loyer_hc: number;
      mode_charges: 'forfait' | 'provisions';
      montant_charges: number;
      depot_garantie: number;
      irl_trimestre: string;
      irl_valeur: string;
      cautionnement: string | null;
      actif_depuis?: string | null;
      jour_echeance?: number;
    },
    lotIds: LotId[],
  ): Bail {
    // Désérialisation Money : INTEGER centimes → BigInt → Money
    const loyerHc = Money.fromCentimes(BigInt(row.loyer_hc));
    const montantCharges = Money.fromCentimes(BigInt(row.montant_charges));
    const depotGarantie = Money.fromCentimes(BigInt(row.depot_garantie));

    // Désérialisation IRL
    const irlReference = IRL.creer({
      trimestre: row.irl_trimestre,
      valeur: row.irl_valeur,
    });

    // Désérialisation Temporal.PlainDate depuis TEXT ISO (pattern plan 04)
    const dateDebut = Temporal.PlainDate.from(row.date_debut);

    // Désérialisation Cautionnement JSON → VO
    const cautionnement = row.cautionnement
      ? this.cautionnementDepuisJson(row.cautionnement)
      : null;

    // Phase 2 — D-51, D-53 : actifDepuis + jourEcheance
    const actifDepuis = row.actif_depuis
      ? Temporal.PlainDate.from(row.actif_depuis)
      : null;
    const jourEcheance = row.jour_echeance ?? 1;

    return Bail.creer({
      id: row.id as BailId,
      locataireId: row.locataire_id as LocataireId,
      bienId: row.bien_id as BienId,
      lotIds,
      type: row.type as 'classique',
      dateDebut,
      dureeMois: row.duree_mois,
      loyerHc,
      modeCharges: row.mode_charges,
      montantCharges,
      depotGarantie,
      irlReference,
      cautionnement,
      actifDepuis,
      jourEcheance,
    });
  }

  private cautionnementDepuisJson(json: string): Cautionnement {
    const data = JSON.parse(json) as {
      type: string;
      garant: {
        nom: string;
        prenom: string;
        email: string;
        telephone: string;
        adresse: { rue: string; codePostal: string; ville: string };
      } | null;
      montantGaranti: number | null;
      dateSignature: string;
      dureeEngagement: number;
    };

    const garant = data.garant
      ? {
          nom: data.garant.nom,
          prenom: data.garant.prenom,
          email: data.garant.email,
          telephone: data.garant.telephone,
          adresse: Adresse.creer({
            rue: data.garant.adresse.rue,
            codePostal: data.garant.adresse.codePostal,
            ville: data.garant.adresse.ville,
          }),
        }
      : null;

    return Cautionnement.creer({
      type: data.type as 'physique' | 'visale' | 'gli',
      garant,
      montantGaranti: data.montantGaranti !== null
        ? Money.fromCentimes(BigInt(data.montantGaranti))
        : null,
      dateSignature: Temporal.PlainDate.from(data.dateSignature),
      dureeEngagement: data.dureeEngagement,
    });
  }
}
