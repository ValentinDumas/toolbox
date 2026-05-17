/**
 * Helper preHandler — formaterEtatItem (DP-18).
 * Transforme un EtatItem en libellé français lisible.
 */
import type { EtatItem } from '../domain/_shared/inventaire-item.js';

const LABELS_ETAT: Record<Exclude<EtatItem, null>, string> = {
  bon: 'Bon',
  moyen: 'Moyen',
  degrade: 'Dégradé',
};

export function formaterEtatItem(etat: EtatItem): string {
  return etat === null ? '—' : LABELS_ETAT[etat];
}
