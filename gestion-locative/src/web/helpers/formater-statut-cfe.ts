import {
  LIBELLES_STATUT_CFE,
  type StatutCfe,
} from '../../domain/fiscalite/cfe/statut-cfe.js';

/**
 * Retourne le libellé français du statut CFE (UI-SPEC §S9 / D-CFE6.3).
 * Wrapper pur sur le mapping constant — pas de calcul fiscal.
 */
export function formaterStatutCfe(statut: StatutCfe): string {
  return LIBELLES_STATUT_CFE[statut];
}
