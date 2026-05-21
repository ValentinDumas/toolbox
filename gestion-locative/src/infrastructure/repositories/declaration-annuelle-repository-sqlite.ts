/**
 * Adapter SQLite — DeclarationAnnuelleRepositorySqlite.
 *
 * APPEND-ONLY STRICT (D-FIS-G4.2) :
 *   - enregistrer utilise insertInto().values().execute() SANS .onConflict()
 *   - Une réinsertion sur (bailleur_id, exercice) lève UNIQUE violation SQLite (attendu)
 *   - Comportement attendu — protège contre la double clôture (T-05-06-01)
 *
 * Pattern analog : src/infrastructure/repositories/bail-indexation-repository-sqlite.ts
 * (append-only strict — L40-58).
 *
 * Sources juridiques :
 *   - D-FIS-G4.2 : snapshot par valeur — immutable post-création
 *   - T-05-06-01 : Double clôture race → mitigée par UNIQUE (bailleur_id, exercice)
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { REGLES_2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  bailleur_id: string;
  exercice: number;
  regime_applique: 'micro_bic' | 'reel';
  recettes_totales_centimes: number;
  charges_qualifiees_json: string;
  dotation_amortissement_centimes: number;
  ard_genere_centimes: number;
  ard_consomme_centimes: number;
  revenus_foyer_snapshot_centimes: number | null;
  statut_lmnp_lmp: string;
  composants_snapshot_json: string;
  cloture_le: string;
};

/**
 * Adapter SQLite append-only pour DeclarationAnnuelle.
 *
 * NE contient PAS de onConflict — append-only strict (D-FIS-G4.2).
 */
export class DeclarationAnnuelleRepositorySqlite implements DeclarationAnnuelleRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Insère une DeclarationAnnuelle.
   *
   * Append-only strict : insertInto().values().execute() SANS onConflict.
   * UNIQUE violation si (bailleur_id, exercice) déjà présent = double clôture interdite.
   */
  async enregistrer(decl: DeclarationAnnuelle, trxArg?: unknown): Promise<void> {
    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    await db
      .insertInto('declarations_annuelles')
      .values({
        id: decl.id,
        bailleur_id: decl.bailleurId,
        exercice: decl.exercice,
        regime_applique: decl.regimeApplique,
        recettes_totales_centimes: decl.recettesTotales.toSqliteInteger(),
        charges_qualifiees_json: this.serializeCharges(decl.chargesQualifieesParCategorie),
        dotation_amortissement_centimes: decl.dotationAmortissement.toSqliteInteger(),
        ard_genere_centimes: decl.ardGenere.toSqliteInteger(),
        ard_consomme_centimes: decl.ardConsomme.toSqliteInteger(),
        revenus_foyer_snapshot_centimes: decl.revenusFoyerSnapshot?.toSqliteInteger() ?? null,
        statut_lmnp_lmp: decl.statutLmnpLmp,
        composants_snapshot_json: decl.composantsSnapshot,
        cloture_le: decl.clotureLe.toString(),
      })
      .execute();
    // PAS de .onConflict() — append-only strict (D-FIS-G4.2)
  }

  async trouverParId(id: DeclarationAnnuelleId | string): Promise<DeclarationAnnuelle | null> {
    const row = await this.db
      .selectFrom('declarations_annuelles')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    return row ? this.versDomaine(row as Row) : null;
  }

  async trouverParBailleurExercice(
    bailleurId: BailleurId,
    exercice: number,
  ): Promise<DeclarationAnnuelle | null> {
    const row = await this.db
      .selectFrom('declarations_annuelles')
      .selectAll()
      .where('bailleur_id', '=', bailleurId)
      .where('exercice', '=', exercice)
      .executeTakeFirst();

    return row ? this.versDomaine(row as Row) : null;
  }

  async listerParBailleur(bailleurId: BailleurId): Promise<DeclarationAnnuelle[]> {
    const rows = await this.db
      .selectFrom('declarations_annuelles')
      .selectAll()
      .where('bailleur_id', '=', bailleurId)
      .orderBy('exercice', 'desc')
      .execute();

    return rows.map((r) => this.versDomaine(r as Row));
  }

  // ─── Mapping ────────────────────────────────────────────────────────────────

  private versDomaine(row: Row): DeclarationAnnuelle {
    const chargesQualifieesParCategorie = this.deserializeCharges(row.charges_qualifiees_json);
    return DeclarationAnnuelle.creer({
      id: row.id as DeclarationAnnuelleId,
      bailleurId: row.bailleur_id as BailleurId,
      exercice: row.exercice,
      regimeApplique: row.regime_applique,
      recettesTotales: Money.fromCentimes(BigInt(row.recettes_totales_centimes)),
      chargesQualifieesParCategorie,
      dotationAmortissement: Money.fromCentimes(BigInt(row.dotation_amortissement_centimes)),
      ardGenere: Money.fromCentimes(BigInt(row.ard_genere_centimes)),
      ardConsomme: Money.fromCentimes(BigInt(row.ard_consomme_centimes)),
      revenusFoyerSnapshot: row.revenus_foyer_snapshot_centimes !== null
        ? Money.fromCentimes(BigInt(row.revenus_foyer_snapshot_centimes))
        : null,
      statutLmnpLmp: row.statut_lmnp_lmp as VerdictLmp,
      composantsSnapshot: row.composants_snapshot_json,
      clotureLe: Temporal.PlainDate.from(row.cloture_le),
      // Invariant D-FIS-G3.1 : seuil injecté depuis les règles 2026 (ou de l'exercice correspondant)
      // En V1, on utilise REGLES_2026 — le seuil ne devrait pas changer entre exercices 2026-2028
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
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
    // Garantir toutes les catégories avec Money.zero() si absent
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
