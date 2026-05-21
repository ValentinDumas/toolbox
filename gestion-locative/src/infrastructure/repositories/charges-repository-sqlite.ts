import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { ChargesRepository, ChargesParCategorie } from '../../domain/fiscalite/charges-repository.js';
import {
  QUALIFICATIONS_VALIDES,
  type QualificationFiscale,
} from '../../domain/fiscalite/qualification-fiscale.js';
import { Money } from '../../domain/_shared/money.js';
import type { BailleurId, BienId } from '../../domain/_shared/identifiants.js';

/** Valeurs de qualification exclues de l'agrégation (non qualifié = pas encore traité). */
const QUALIFICATIONS_EXCLUES = ['non_qualifie'] as const;

/**
 * Adapter SQLite — ChargesRepository (FIS-03, D-FIS-G2.2).
 *
 * Agrège les charges qualifiées par catégorie pour un exercice fiscal.
 *
 * Note D-LOCK-2 : bailleurId ignoré en V1 (single-bailleur).
 * Note D-FIS-G2.6 : les enfants (parent_justificatif_id NOT NULL) sont inclus.
 *   Le parent après split est 'non_deductible' → comptabilisé naturellement.
 * Note D-FIS-G2.11 : rattachement par coalesce(date_paiement, date_document).
 */
export class ChargesRepositorySqlite implements ChargesRepository {
  constructor(private readonly db: Kysely<DB>) {}

  /**
   * Somme des charges qualifiées par catégorie pour une année (D-FIS-G2.2).
   *
   * @param _bailleurId - V1.1 : filtrage par bailleur. En V1, ignoré.
   * @param annee - exercice fiscal (ex: 2026)
   */
  async sommeChargesParCategorie(_bailleurId: BailleurId, annee: number): Promise<ChargesParCategorie> {
    const rows = await this.db
      .selectFrom('justificatifs')
      .select(['qualification_fiscale'])
      .select((eb) => eb.fn.sum<number>('montant_ttc_centimes').as('total'))
      .where('corbeille_le', 'is', null)
      .where('qualification_fiscale', 'is not', null)
      .where('qualification_fiscale', 'not in', QUALIFICATIONS_EXCLUES)
      .where(
        (eb) =>
          eb.fn('substr', [
            eb.fn('coalesce', ['date_paiement', 'date_document']),
            eb.val(1),
            eb.val(4),
          ]),
        '=',
        String(annee),
      )
      .groupBy('qualification_fiscale')
      .execute();

    // Initialiser toutes les catégories à Money.zero()
    const result = Object.fromEntries(
      QUALIFICATIONS_VALIDES.map((q) => [q, Money.zero()]),
    ) as ChargesParCategorie;

    // Remplir avec les données réelles
    for (const row of rows) {
      const qualification = row.qualification_fiscale as QualificationFiscale | null;
      if (qualification && (QUALIFICATIONS_VALIDES as readonly string[]).includes(qualification)) {
        const total = row.total ?? 0;
        if (total > 0) {
          result[qualification] = Money.fromCentimes(BigInt(Math.round(total)));
        }
      }
    }

    return result;
  }

  /**
   * Somme des charges déductibles pour un bien donné (D-FIS-G5.1).
   *
   * Catégories déductibles : entretien_reparation, amelioration, charge_courante_periodique.
   * Les justificatifs avec bien_id=null (charges générales bailleur) sont exclus.
   *
   * @param bienId - identifiant du bien (filtrage direct par colonne bien_id)
   * @param annee - exercice fiscal (ex: 2026)
   */
  async sommeChargesParBien(bienId: BienId, annee: number): Promise<Money> {
    const CATEGORIES_DEDUCTIBLES = [
      'entretien_reparation',
      'amelioration',
      'charge_courante_periodique',
    ] as const;

    const result = await this.db
      .selectFrom('justificatifs')
      .select((eb) => eb.fn.sum<number>('montant_ttc_centimes').as('total'))
      .where('bien_id', '=', bienId)
      .where('corbeille_le', 'is', null)
      .where('qualification_fiscale', 'in', CATEGORIES_DEDUCTIBLES)
      .where(
        (eb) =>
          eb.fn('substr', [
            eb.fn('coalesce', ['date_paiement', 'date_document']),
            eb.val(1),
            eb.val(4),
          ]),
        '=',
        String(annee),
      )
      .executeTakeFirst();

    const total = result?.total ?? 0;
    if (total <= 0) {
      return Money.zero();
    }
    return Money.fromCentimes(BigInt(Math.round(total)));
  }
}
