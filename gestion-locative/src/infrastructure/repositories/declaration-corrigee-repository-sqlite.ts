/**
 * Adapter SQLite — DeclarationCorrigeeRepositorySqlite.
 *
 * APPEND-ONLY STRICT (D-FIS-G4.4) :
 *   - enregistrer utilise insertInto().values().execute() SANS .onConflict()
 *   - N corrections successives autorisées sur la même declarationOriginaleId
 *   - La déclaration originale RESTE INTACTE — aucun UPDATE sur declarations_annuelles
 *
 * Pattern analog : src/infrastructure/repositories/bail-indexation-repository-sqlite.ts
 *
 * Sources juridiques :
 *   - D-FIS-G4.4 : append-only, originale intouchée
 *   - T-05-06-09 : threat mitigation — creer-declaration-corrigee NE modifie pas l'originale
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { DeclarationCorrigeeRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import { DeclarationCorrigee } from '../../domain/fiscalite/declaration-corrigee.js';
import type { DeclarationAnnuelleId, DeclarationCorrigeeId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  declaration_originale_id: string;
  motif: string;
  recettes_totales_centimes: number;
  charges_qualifiees_json: string;
  dotation_amortissement_centimes: number;
  ard_genere_centimes: number;
  ard_consomme_centimes: number;
  revenus_foyer_snapshot_centimes: number | null;
  statut_lmnp_lmp: string;
  regime_applique: 'micro_bic' | 'reel';
  cree_le: string;
};

/**
 * Adapter SQLite append-only pour DeclarationCorrigee.
 *
 * NE contient PAS de onConflict — append-only strict (D-FIS-G4.4).
 */
export class DeclarationCorrigeeRepositorySqlite implements DeclarationCorrigeeRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Insère une DeclarationCorrigee.
   *
   * Append-only strict : insertInto().values().execute() SANS onConflict.
   * N insertions sur même declaration_originale_id sont toutes conservées (PAS d'UNIQUE).
   */
  async enregistrer(corr: DeclarationCorrigee, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .insertInto('declarations_corrigees')
      .values({
        id: corr.id,
        declaration_originale_id: corr.declarationOriginaleId,
        motif: corr.motif,
        recettes_totales_centimes: corr.recettesTotales.toSqliteInteger(),
        charges_qualifiees_json: this.serializeCharges(corr.chargesQualifieesParCategorie),
        dotation_amortissement_centimes: corr.dotationAmortissement.toSqliteInteger(),
        ard_genere_centimes: corr.ardGenere.toSqliteInteger(),
        ard_consomme_centimes: corr.ardConsomme.toSqliteInteger(),
        revenus_foyer_snapshot_centimes: corr.revenusFoyerSnapshot?.toSqliteInteger() ?? null,
        statut_lmnp_lmp: corr.statutLmnpLmp,
        regime_applique: corr.regimeApplique,
        cree_le: corr.creeLe.toString(),
      })
      .execute();
    // PAS de .onConflict() — append-only strict (D-FIS-G4.4)
  }

  async trouverParId(id: DeclarationCorrigeeId | string): Promise<DeclarationCorrigee | null> {
    const row = await this.db
      .selectFrom('declarations_corrigees')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.versDomaine(row as Row) : null;
  }

  async listerParDeclarationOriginale(
    originaleId: DeclarationAnnuelleId,
  ): Promise<DeclarationCorrigee[]> {
    const rows = await this.db
      .selectFrom('declarations_corrigees')
      .selectAll()
      .where('declaration_originale_id', '=', originaleId)
      .orderBy('cree_le', 'desc')
      .execute();

    return rows.map((r) => this.versDomaine(r as Row));
  }

  // ─── Mapping ────────────────────────────────────────────────────────────────

  private versDomaine(row: Row): DeclarationCorrigee {
    return DeclarationCorrigee.creer({
      id: row.id as DeclarationCorrigeeId,
      declarationOriginaleId: row.declaration_originale_id as DeclarationAnnuelleId,
      motif: row.motif,
      regimeApplique: row.regime_applique,
      recettesTotales: Money.fromCentimes(BigInt(row.recettes_totales_centimes)),
      chargesQualifieesParCategorie: this.deserializeCharges(row.charges_qualifiees_json),
      dotationAmortissement: Money.fromCentimes(BigInt(row.dotation_amortissement_centimes)),
      ardGenere: Money.fromCentimes(BigInt(row.ard_genere_centimes)),
      ardConsomme: Money.fromCentimes(BigInt(row.ard_consomme_centimes)),
      revenusFoyerSnapshot: row.revenus_foyer_snapshot_centimes !== null
        ? Money.fromCentimes(BigInt(row.revenus_foyer_snapshot_centimes))
        : null,
      statutLmnpLmp: row.statut_lmnp_lmp as VerdictLmp,
      creeLe: Temporal.PlainDateTime.from(row.cree_le),
    });
  }

  private serializeCharges(charges: Record<QualificationFiscale, Money>): string {
    const obj: Record<string, number> = {};
    for (const [cat, money] of Object.entries(charges)) {
      obj[cat] = money.toSqliteInteger();
    }
    return JSON.stringify(obj);
  }

  private deserializeCharges(json: string): Record<QualificationFiscale, Money> {
    const obj = JSON.parse(json) as Record<string, number>;
    const result: Partial<Record<QualificationFiscale, Money>> = {};
    for (const [cat, centimes] of Object.entries(obj)) {
      result[cat as QualificationFiscale] = Money.fromCentimes(BigInt(centimes));
    }
    const allCats: QualificationFiscale[] = [
      'non_qualifie',
      'entretien_reparation',
      'amelioration',
      'charge_courante_periodique',
      'non_deductible',
    ];
    for (const cat of allCats) {
      if (!result[cat]) result[cat] = Money.zero();
    }
    return result as Record<QualificationFiscale, Money>;
  }
}
