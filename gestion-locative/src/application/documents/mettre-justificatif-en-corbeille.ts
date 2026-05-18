import type { Clock } from '../../domain/_shared/clock.js';
import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import { JustificatifIntrouvable } from '../../domain/documents/erreurs.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

export interface MettreJustificatifEnCorbeilleCommande {
  id: JustificatifId | string;
  raison?: string;
}

export interface MettreJustificatifEnCorbeilleDeps {
  justificatifRepo: JustificatifRepository;
  clock: Clock;
}

/**
 * D-109 — soft-delete réversible (copy-on-write).
 * Le fichier physique est CONSERVÉ (rétention 10 ans).
 */
export async function mettreJustificatifEnCorbeille(
  commande: MettreJustificatifEnCorbeilleCommande,
  deps: MettreJustificatifEnCorbeilleDeps,
): Promise<void> {
  const j = await deps.justificatifRepo.trouverParId(commande.id);
  if (!j) {
    throw new JustificatifIntrouvable(String(commande.id));
  }
  const today = deps.clock.aujourdhui();
  const enCorbeille = j.mettreEnCorbeille(
    commande.raison ?? 'Mise en corbeille',
    today,
  );
  await deps.justificatifRepo.enregistrer(enCorbeille);
}
