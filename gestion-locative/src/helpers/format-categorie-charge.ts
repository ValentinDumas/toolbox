/**
 * Formate une QualificationFiscale en libellé français lisible.
 *
 * Réutilise LABELS_QUALIFICATION défini dans le domaine (qualification-fiscale.ts)
 * pour garantir la cohérence des labels entre domaine et UI.
 *
 * @param qualification - QualificationFiscale
 */
import { LABELS_QUALIFICATION } from '../domain/fiscalite/qualification-fiscale.js';
import type { QualificationFiscale } from '../domain/fiscalite/qualification-fiscale.js';

export function formatCategorieCharge(qualification: QualificationFiscale): string {
  return LABELS_QUALIFICATION[qualification];
}
