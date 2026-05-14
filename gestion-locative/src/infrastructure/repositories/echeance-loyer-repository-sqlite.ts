import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import { EcheanceLoyer, type StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import { Money } from '../../domain/_shared/money.js';
import type { EcheanceLoyerId, BailId } from '../../domain/_shared/identifiants.js';

type EcheanceLoyerRow = {
  id: string;
  bail_id: string;
  periode_debut: string;
  periode_fin: string;
  jour_echeance_attendue: string;
  loyer_hc: number;
  montant_charges: number;
  mode_charges: 'forfait' | 'provisions';
  total: number;
  statut: string;
  annule_le: string | null;
};

export class EcheanceLoyerRepositorySqlite implements EcheanceLoyerRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(echeance: EcheanceLoyer): Promise<void> {
    await this.db
      .insertInto('echeance_loyer')
      .values(this.versRow(echeance))
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          statut: echeance.statut,
          modifie_le: new Date().toISOString(),
          annule_le: echeance.annuleLe?.toString() ?? null,
        }),
      )
      .execute();
  }

  async enregistrerBatch(echeances: EcheanceLoyer[]): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      for (const e of echeances) {
        await trx
          .insertInto('echeance_loyer')
          .values(this.versRow(e))
          .execute();
      }
    });
  }

  async trouverParId(id: EcheanceLoyerId | string): Promise<EcheanceLoyer | null> {
    // CR-04 : ne PAS filtrer annule_le ici. Le soft-delete préserve l'historique
    // pour audit (D-60 / D-74). Les callers (route /quittances/:id,
    // recalculer-statut-echeance, enregistrer-relance) doivent décider de la
    // suite en consultant `echeance.statut === 'annulee'` ou `echeance.annuleLe`.
    // Le filtrage des annulées reste légitime côté `listerParBail` et
    // `listerNonPayees` (collections).
    const row = await this.db
      .selectFrom('echeance_loyer')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as EcheanceLoyerRow);
  }

  async listerParBail(bailId: BailId): Promise<EcheanceLoyer[]> {
    const rows = await this.db
      .selectFrom('echeance_loyer')
      .selectAll()
      .where('bail_id', '=', bailId)
      .where('annule_le', 'is', null)
      .orderBy('periode_debut', 'asc')
      .execute();

    return rows.map((r) => this.versDomaine(r as EcheanceLoyerRow));
  }

  async mettreAJourStatut(id: EcheanceLoyerId | string, statut: StatutEcheanceLoyer): Promise<void> {
    await this.db
      .updateTable('echeance_loyer')
      .set({ statut, modifie_le: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }

  async listerNonPayees(): Promise<EcheanceLoyer[]> {
    const rows = await this.db
      .selectFrom('echeance_loyer')
      .selectAll()
      .where('statut', 'in', ['en_attente', 'partiellement_payee'])
      .where('annule_le', 'is', null)
      .orderBy('jour_echeance_attendue', 'asc')
      .execute();

    return rows.map((r) => this.versDomaine(r as EcheanceLoyerRow));
  }

  async supprimerLot(ids: EcheanceLoyerId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .deleteFrom('echeance_loyer')
      .where('id', 'in', ids)
      .execute();
  }

  async compterParBail(bailId: BailId): Promise<number> {
    const result = await this.db
      .selectFrom('echeance_loyer')
      .select((eb) => eb.fn.countAll<number>().as('n'))
      .where('bail_id', '=', bailId)
      .where('annule_le', 'is', null)
      .executeTakeFirst();

    return Number(result?.n ?? 0);
  }

  private versRow(e: EcheanceLoyer) {
    return {
      id: e.id,
      bail_id: e.bailId,
      periode_debut: e.periodeDebut.toString(),
      periode_fin: e.periodeFin.toString(),
      jour_echeance_attendue: e.jourEcheanceAttendue.toString(),
      loyer_hc: Number(e.loyerHc.toCentimes()),
      montant_charges: Number(e.montantCharges.toCentimes()),
      mode_charges: e.modeCharges,
      total: Number(e.total.toCentimes()),
      statut: e.statut,
      annule_le: e.annuleLe?.toString() ?? null,
    };
  }

  private versDomaine(row: EcheanceLoyerRow): EcheanceLoyer {
    const loyerHc = Money.fromCentimes(BigInt(row.loyer_hc));
    const montantCharges = Money.fromCentimes(BigInt(row.montant_charges));
    const total = Money.fromCentimes(BigInt(row.total));

    return EcheanceLoyer.creer({
      id: row.id as EcheanceLoyerId,
      bailId: row.bail_id as BailId,
      periodeDebut: Temporal.PlainDate.from(row.periode_debut),
      periodeFin: Temporal.PlainDate.from(row.periode_fin),
      jourEcheanceAttendue: Temporal.PlainDate.from(row.jour_echeance_attendue),
      loyerHc,
      montantCharges,
      modeCharges: row.mode_charges,
      total,
      statut: row.statut as StatutEcheanceLoyer,
      annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
    });
  }
}
