import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import { JustificatifIntrouvable } from '../../domain/documents/erreurs.js';
import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

/**
 * Use case `restaurerJustificatif` (DOC-03, D-109).
 *
 * Annule un soft-delete : remet `corbeille_le = NULL` + `raison_corbeille = NULL`
 * via `Justificatif.restaurer()` (copy-on-write).
 *
 * Throws :
 *   - JustificatifIntrouvable si lookup échoue.
 *   - DocumentNonEnCorbeille si la row n'est pas déjà en corbeille (domain).
 */
export async function restaurerJustificatif(
  cmd: { id: JustificatifId | string },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ justificatif: Justificatif }> {
  const existant = await deps.justificatifRepo.trouverParId(cmd.id);
  if (!existant) {
    throw new JustificatifIntrouvable(String(cmd.id));
  }
  const restaure = existant.restaurer();
  await deps.justificatifRepo.enregistrer(restaure);
  return { justificatif: restaure };
}
