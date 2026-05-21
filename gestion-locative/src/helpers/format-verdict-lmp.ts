/**
 * Formate un VerdictLmp en libellé français lisible.
 *
 * Réutilise LABELS_VERDICT_LMP défini dans l'application (Plan 05 detecter-bascule-lmp.ts)
 * pour éviter la duplication des labels UI.
 *
 * @param statut - VerdictLmp (lmnp_confirme | lmp_probable | indetermine_revenus_foyer_manquants)
 */
import { LABELS_VERDICT_LMP } from '../application/fiscalite/detecter-bascule-lmp.js';
import type { VerdictLmp } from '../domain/fiscalite/verdict-lmp.js';

export function formatVerdictLmp(statut: VerdictLmp): string {
  return LABELS_VERDICT_LMP[statut];
}
