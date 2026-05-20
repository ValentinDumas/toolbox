import type { Money } from '../_shared/money.js';
import type { BailleurId } from '../_shared/identifiants.js';
import type { QualificationFiscale } from './qualification-fiscale.js';

/** Map des charges agrégées par catégorie de qualification (D-FIS-G2.2). */
export type ChargesParCategorie = Record<QualificationFiscale, Money>;

/**
 * Port — agrégation des charges qualifiées par catégorie annuelle (FIS-03).
 *
 * Source : D-FIS-G2.2 (4 catégories alignées 2033-A) + D-FIS-G2.6 (enfants inclus, parent exclu).
 *
 * Note D-LOCK-2 : le bailleurId est conservé pour la compatibilité V1.1 multi-bailleur.
 */
export interface ChargesRepository {
  /**
   * Retourne les sommes par catégorie de qualification fiscale pour une année.
   *
   * Règles :
   *   - Inclut : justificatifs qualifiés + corbeille_le IS NULL
   *   - Rattachement par coalesce(date_paiement, date_document) (D-FIS-G2.11)
   *   - Les enfants (parent_justificatif_id NOT NULL) sont inclus avec leur qualification propre
   *   - Le parent après split est 'non_deductible' → comptabilisé naturellement dans non_deductible
   *   - non_qualifie et NULL qualification exclus de la somme
   *   - Valeur Money.zero() pour les catégories sans données
   *
   * @param bailleurId - identifiant bailleur (V1.1 multi-bailleur, ignoré en V1)
   * @param annee - exercice fiscal (ex: 2026)
   */
  sommeChargesParCategorie(bailleurId: BailleurId, annee: number): Promise<ChargesParCategorie>;
}
