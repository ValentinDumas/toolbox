/**
 * Domain service pur comparerInventaires — LOC-03, D-99, D-101.
 * Compare l'inventaire de l'EDL d'entrée vs l'EDL de sortie.
 * Génère des warnings textuels (WARNING_ITEM_DISPARU / WARNING_ITEM_DEGRADE).
 * Vue diff UI différée Phase 4 (D-88).
 * 100% couverture logique métier (practices/BDD_PRACTICES.md).
 */
import { TYPES_ITEM_INVENTAIRE, LABELS_ITEM_INVENTAIRE, etatADegrade, type TypeItemInventaire, type EtatItem } from '../_shared/inventaire-item.js';
import type { EtatDesLieux } from './etat-des-lieux.js';

// ─── Warning ─────────────────────────────────────────────────────────────────

export const WARNING_ITEM_DISPARU = 'WARNING_ITEM_DISPARU' as const;
export const WARNING_ITEM_DEGRADE = 'WARNING_ITEM_DEGRADE' as const;

export type WarningCode = typeof WARNING_ITEM_DISPARU | typeof WARNING_ITEM_DEGRADE;

export interface Warning {
  code: WarningCode;
  typeItem: TypeItemInventaire;
  message: string;
  contexte?: {
    etatAvant?: EtatItem;
    etatApres?: EtatItem;
  };
}

// ─── comparerInventaires ──────────────────────────────────────────────────────

/**
 * Compare les inventaires entrée vs sortie et retourne les warnings de dégradation.
 * Règles D-101 :
 * - Item présent entrée + absent sortie → WARNING_ITEM_DISPARU
 * - Item présent entrée + état dégradé sortie → WARNING_ITEM_DEGRADE
 * - Item absent entrée + présent sortie → ignoré (D-101)
 *
 * L'ordre des warnings suit l'ordre canonique TYPES_ITEM_INVENTAIRE (décret 2015-981).
 */
export function comparerInventaires(entree: EtatDesLieux, sortie: EtatDesLieux): Warning[] {
  const warnings: Warning[] = [];

  for (const typeItem of TYPES_ITEM_INVENTAIRE) {
    const itemEntree = entree.inventaire.find((i) => i.typeItem === typeItem)!;
    const itemSortie = sortie.inventaire.find((i) => i.typeItem === typeItem)!;
    const label = LABELS_ITEM_INVENTAIRE[typeItem];

    if (itemEntree.present && !itemSortie.present) {
      // Item présent à l'entrée, absent à la sortie (disparu)
      warnings.push({
        code: WARNING_ITEM_DISPARU,
        typeItem,
        message: `${label} : présent à l'entrée, absent à la sortie. Vérifier une éventuelle retenue sur dépôt de garantie.`,
      });
    } else if (itemEntree.present && itemSortie.present && etatADegrade(itemEntree.etat, itemSortie.etat)) {
      // Item présent des deux côtés mais état dégradé
      warnings.push({
        code: WARNING_ITEM_DEGRADE,
        typeItem,
        message: `${label} : état ${itemEntree.etat} à l'entrée → ${itemSortie.etat} à la sortie. Vérifier une éventuelle retenue sur dépôt de garantie.`,
        contexte: {
          etatAvant: itemEntree.etat,
          etatApres: itemSortie.etat,
        },
      });
    }
    // Item absent entrée + présent sortie → ignoré (D-101)
  }

  return warnings;
}
