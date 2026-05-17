/**
 * Helper preHandler — formaterTypeItemInventaire (DP-18).
 * Retourne le libellé français d'un TypeItemInventaire depuis LABELS_ITEM_INVENTAIRE.
 */
import { LABELS_ITEM_INVENTAIRE, type TypeItemInventaire } from '../domain/_shared/inventaire-item.js';

export function formaterTypeItemInventaire(type: TypeItemInventaire): string {
  return LABELS_ITEM_INVENTAIRE[type];
}
