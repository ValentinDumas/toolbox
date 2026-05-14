import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { RelanceRepository } from '../../domain/encaissements/relance-repository.js';
import { Relance, type NiveauRelance, type CanalRelance } from '../../domain/encaissements/relance.js';
import type { EcheanceLoyerId, RelanceId } from '../../domain/_shared/identifiants.js';

type RelanceRow = {
  id: string;
  echeance_id: string;
  niveau: number;
  canal: string;
  envoyee_le: string;
  contenu_snapshot: string;
  annule_le: string | null;
};

export class RelanceRepositorySqlite implements RelanceRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(relance: Relance): Promise<void> {
    await this.db
      .insertInto('relance')
      .values({
        id: relance.id,
        echeance_id: relance.echeanceId,
        niveau: relance.niveau,
        canal: relance.canal,
        envoyee_le: relance.envoyeeLe.toString(),
        contenu_snapshot: relance.contenuSnapshot,
        annule_le: relance.annuleLe?.toString() ?? null,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          annule_le: relance.annuleLe?.toString() ?? null,
        }),
      )
      .execute();
  }

  async trouverParId(id: RelanceId | string): Promise<Relance | null> {
    const row = await this.db
      .selectFrom('relance')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row as RelanceRow);
  }

  async listerParEcheance(
    echeanceId: EcheanceLoyerId | string,
    opts?: { inclureAnnulees?: boolean },
  ): Promise<Relance[]> {
    let query = this.db
      .selectFrom('relance')
      .selectAll()
      .where('echeance_id', '=', echeanceId);

    if (!opts?.inclureAnnulees) {
      query = query.where('annule_le', 'is', null);
    }

    const rows = await query.orderBy('niveau', 'asc').execute();
    return rows.map((r) => this.versDomaine(r as RelanceRow));
  }

  async listerToutes(opts?: { inclureAnnulees?: boolean }): Promise<Relance[]> {
    let query = this.db
      .selectFrom('relance')
      .selectAll();

    if (!opts?.inclureAnnulees) {
      query = query.where('annule_le', 'is', null);
    }

    const rows = await query.orderBy('envoyee_le', 'desc').execute();
    return rows.map((r) => this.versDomaine(r as RelanceRow));
  }

  private versDomaine(row: RelanceRow): Relance {
    return Relance.creer({
      id: row.id as RelanceId,
      echeanceId: row.echeance_id as EcheanceLoyerId,
      niveau: row.niveau as NiveauRelance,
      canal: row.canal as CanalRelance,
      envoyeeLe: Temporal.PlainDate.from(row.envoyee_le),
      contenuSnapshot: row.contenu_snapshot,
      annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
    });
  }
}
