import {
  LABELS_TYPE_JUSTIFICATIF,
  type TypeJustificatif,
} from '../domain/documents/justificatif.js';

/**
 * Formate un TypeJustificatif en libellé français (D-104, DP-25).
 * Helper preHandler injectable dans les locals EJS.
 */
export function formaterTypeJustificatif(type: TypeJustificatif): string {
  return LABELS_TYPE_JUSTIFICATIF[type];
}

export { LABELS_TYPE_JUSTIFICATIF };
