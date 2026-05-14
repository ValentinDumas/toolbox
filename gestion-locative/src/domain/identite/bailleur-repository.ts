import type { Bailleur } from './bailleur.js';

/**
 * Port domaine BailleurRepository — singleton.
 * Pas de listerTous/supprimer : un seul bailleur peut exister (D-67).
 */
export interface BailleurRepository {
  /** Retourne le bailleur ou null si aucun profil n'a été configuré. */
  trouver(): Promise<Bailleur | null>;

  /** Enregistre le bailleur. La contrainte UNIQUE(singleton_marker) protège contre les doublons. */
  enregistrer(bailleur: Bailleur): Promise<void>;

  /** Met à jour le profil bailleur existant. */
  mettreAJour(bailleur: Bailleur): Promise<void>;
}
