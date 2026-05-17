import type { TypeDiagnostic } from '../domain/_shared/duree-validite-diagnostic.js';

const LABELS_TYPE_DIAGNOSTIC: Record<TypeDiagnostic, string> = {
  dpe: 'DPE',
  gaz: 'Gaz',
  elec: 'Électricité',
  erp: 'ERP (risques et pollutions)',
};

/**
 * Formate un TypeDiagnostic en libellé français.
 * DP-18 : helper preHandler injectable dans les locals EJS.
 */
export function formaterTypeDiagnostic(type: TypeDiagnostic): string {
  return LABELS_TYPE_DIAGNOSTIC[type];
}
