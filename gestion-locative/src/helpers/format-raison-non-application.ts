import type { RaisonNonApplication } from '../domain/locatif/bail-indexation.js';

/**
 * Helper UI Phase 3-04 (DP-18) — formate une raison de non-application
 * d'indexation IRL pour affichage dans la fiche Bail / historique.
 *
 *   null            → 'Appliquée'
 *   'gel_dpe'       → 'Gel DPE'
 *   'refus_bailleur'→ 'Choix du bailleur'
 */
const LABELS: Record<RaisonNonApplication, string> = {
  gel_dpe: 'Gel DPE',
  refus_bailleur: 'Choix du bailleur',
};

export function formaterRaisonNonApplication(
  raison: RaisonNonApplication | null,
): string {
  if (raison === null) return 'Appliquée';
  return LABELS[raison];
}
