/**
 * Adapter SQLite — TableauAmortissementRepositorySqlite.
 *
 * Implémente le port TableauAmortissementRepository (Phase 5, D-FIS-G1.7).
 *
 * APPEND-ONLY STRICT (T-05-04-02) :
 *   - enregistrerBatch utilise insertInto().values().execute() SANS .onConflict()
 *   - Une réinsertion sur (bien_id, composant_id, exercice) lève UNIQUE violation SQLite
 *   - Comportement attendu — protège contre la double clôture d'un même exercice
 *
 * Pattern analog : src/infrastructure/repositories/bail-indexation-repository-sqlite.ts
 * (append-only strict — L40-58).
 *
 * Sources juridiques :
 *   - CGI art. 39 B : ARD cumulé disponible reportable sans limite
 *   - D-FIS-G1.7 : read-model matérialisé append-only
 *   - T-05-04-02 : Append-only violé par onConflict → threat mitigé par absence de onConflict
 */

import type { Kysely, Transaction } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import { AmortissementExercice } from '../../domain/fiscalite/amortissement-exercice.js';
import type { BienId, BailleurId, AmortissementExerciceId, ComposantId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type AmortissementExerciceRow = {
  id: string;
  bien_id: string;
  composant_id: string | null;
  exercice: number;
  type_ligne: 'COMPOSANT' | 'SYNTHESE_BIEN';
  dotation_theorique_centimes: number;
  dotation_appliquee_centimes: number;
  ard_genere_centimes: number;
  ard_cumule_disponible_centimes: number | null;
  ard_consomme_centimes: number | null;
  cree_le: string;
};

/**
 * Ligne d'insertion — cree_le fourni explicitement (pattern ComposantInsertRow).
 * Kysely InsertObject exige tous les champs non-Generated.
 */
type AmortissementExerciceInsertRow = AmortissementExerciceRow;

/**
 * Adapter SQLite append-only pour le read-model AmortissementExercice.
 *
 * NE contient PAS de onConflict — append-only strict (T-05-04-02).
 */
export class TableauAmortissementRepositorySqlite implements TableauAmortissementRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Insère un lot de lignes AmortissementExercice en batch.
   *
   * Append-only strict : insertInto().values().execute() SANS onConflict.
   * Si le batch est vide, retourne immédiatement sans erreur.
   *
   * @throws SQLite UNIQUE violation si (bien_id, composant_id, exercice) déjà présent
   */
  async enregistrerBatch(lignes: AmortissementExercice[], trxArg?: unknown): Promise<void> {
    if (lignes.length === 0) return;

    const db = (trxArg as DbOrTrx | undefined) ?? this.db;
    const rows: AmortissementExerciceInsertRow[] = lignes.map((l) => this.versRow(l));

    await db
      .insertInto('amortissement_exercice')
      .values(rows)
      .execute();
    // PAS de .onConflict() — réinsertion = UNIQUE violation (attendu, T-05-04-02)
  }

  /**
   * Liste toutes les lignes pour un bien + exercice donnés.
   *
   * Retourne COMPOSANT + SYNTHESE_BIEN pour l'exercice demandé.
   */
  async listerParBienExercice(bienId: BienId, exercice: number): Promise<AmortissementExercice[]> {
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .selectAll()
      .where('bien_id', '=', bienId)
      .where('exercice', '=', exercice)
      .execute();

    return rows.map((r) => this.versDomaine(r as AmortissementExerciceRow));
  }

  /**
   * Retourne l'ARD cumulé disponible du dernier exercice clôturé (≤ exerciceMax - 1).
   *
   * Cherche la ligne SYNTHESE_BIEN la plus récente pour exercice < exerciceMax.
   * Retourne Money.zero() si aucun exercice précédent clôturé (premier exercice du bien).
   *
   * Source : CGI art. 39 B — ARD reportable sans limite.
   */
  async dernierArdCumule(bienId: BienId, exerciceMax: number): Promise<Money> {
    const row = await this.db
      .selectFrom('amortissement_exercice')
      .select(['ard_cumule_disponible_centimes'])
      .where('bien_id', '=', bienId)
      .where('type_ligne', '=', 'SYNTHESE_BIEN')
      .where('exercice', '<', exerciceMax)
      .orderBy('exercice', 'desc')
      .limit(1)
      .executeTakeFirst();

    if (!row || row.ard_cumule_disponible_centimes === null) {
      return Money.zero();
    }

    return Money.fromCentimes(BigInt(row.ard_cumule_disponible_centimes));
  }

  /**
   * Retourne l'ARD cumulé disponible TOTAL pour un bailleur et un exercice exact.
   *
   * Agrège Σ ard_cumule_disponible_centimes des lignes SYNTHESE_BIEN de tous les biens
   * du bailleur pour l'exercice exactement égal à exerciceMax.
   *
   * JOIN bien b ON b.id = ae.bien_id — D-LOCK-2 single-bailleur V1 (tous les biens du bailleur).
   * Note : la table amortissement_exercice n'a pas de colonne bailleur_id directe.
   *
   * Retourne Money.zero() si aucune SYNTHESE_BIEN trouvée (premier exercice de clôture du bailleur).
   *
   * Source : CGI art. 39 B — ARD reportable sans limite, propagation cross-exercice (T-05-06-11).
   * D-LOCK-2 : mono-bailleur V1 — tous les biens appartiennent au même bailleur.
   */
  async dernierArdCumuleBailleur(bailleurId: BailleurId, exerciceMax: number): Promise<Money> {
    // D-LOCK-2 : en V1 tous les biens appartiennent au seul bailleur.
    // Le bailleurId est passé pour la compatibilité V1.1 multi-bailleur.
    // On identifie les biens du bailleur via la table bien (pas de FK directe sur amortissement_exercice).
    // Pour simplifier en V1 (D-LOCK-2), on sélectionne TOUS les biens car mono-bailleur.
    const row = await this.db
      .selectFrom('amortissement_exercice as ae')
      .innerJoin('bien as b', 'b.id', 'ae.bien_id')
      .select((eb) => eb.fn.sum<number>('ae.ard_cumule_disponible_centimes').as('total_centimes'))
      .where('ae.type_ligne', '=', 'SYNTHESE_BIEN')
      .where('ae.exercice', '=', exerciceMax)
      .$if(true, (q) => q)  // D-LOCK-2 : V1 mono-bailleur → pas de filtre bailleur_id
      .executeTakeFirst();

    if (!row || row.total_centimes === null) {
      return Money.zero();
    }

    const total = Number(row.total_centimes);
    if (total === 0) return Money.zero();
    return Money.fromCentimes(BigInt(total));
  }

  // ─── Mapping ────────────────────────────────────────────────────────────────

  private versRow(ae: AmortissementExercice): AmortissementExerciceInsertRow {
    return {
      id: ae.id,
      bien_id: ae.bienId,
      composant_id: ae.composantId,
      exercice: ae.exercice,
      type_ligne: ae.typeLigne,
      dotation_theorique_centimes: ae.dotationTheorique.toSqliteInteger(),
      dotation_appliquee_centimes: ae.dotationAppliquee.toSqliteInteger(),
      ard_genere_centimes: ae.ardGenere.toSqliteInteger(),
      ard_cumule_disponible_centimes: ae.ardCumuleDisponible?.toSqliteInteger() ?? null,
      ard_consomme_centimes: ae.ardConsomme?.toSqliteInteger() ?? null,
      cree_le: new Date().toISOString(),
    };
  }

  private versDomaine(row: AmortissementExerciceRow): AmortissementExercice {
    return AmortissementExercice.creer({
      id: row.id as AmortissementExerciceId,
      bienId: row.bien_id as BienId,
      composantId: row.composant_id as ComposantId | null,
      exercice: row.exercice,
      typeLigne: row.type_ligne,
      dotationTheorique: Money.fromCentimes(BigInt(row.dotation_theorique_centimes)),
      dotationAppliquee: Money.fromCentimes(BigInt(row.dotation_appliquee_centimes)),
      ardGenere: Money.fromCentimes(BigInt(row.ard_genere_centimes)),
      ardCumuleDisponible: row.ard_cumule_disponible_centimes !== null
        ? Money.fromCentimes(BigInt(row.ard_cumule_disponible_centimes))
        : null,
      ardConsomme: row.ard_consomme_centimes !== null
        ? Money.fromCentimes(BigInt(row.ard_consomme_centimes))
        : null,
    });
  }
}
