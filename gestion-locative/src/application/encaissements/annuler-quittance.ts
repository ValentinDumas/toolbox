import type { QuittanceId } from '../../domain/_shared/identifiants.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { QuittanceIntrouvable } from '../../domain/encaissements/erreurs.js';

interface CommandeAnnulerQuittance {
  id: QuittanceId | string;
  raison: string;
}

/**
 * Use case D-65 — Annulation d'une Quittance.
 *
 * - Marque annulee_le + raison_annulation.
 * - NE PAS supprimer le fichier PDF (D-63 immutabilité).
 * - Une nouvelle Quittance peut être émise ensuite (numéro suivant).
 */
export async function annulerQuittance(
  commande: CommandeAnnulerQuittance,
  quittanceRepo: QuittanceRepository,
  clock: Clock,
): Promise<void> {
  const quittance = await quittanceRepo.trouverParId(commande.id);
  if (!quittance) {
    throw new QuittanceIntrouvable(String(commande.id));
  }

  const quittanceAnnulee = quittance.annuler(commande.raison, clock.aujourdhui());
  await quittanceRepo.enregistrer(quittanceAnnulee);
}
