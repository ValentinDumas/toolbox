import type { Diagnostic } from '../../domain/patrimoine/diagnostic.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienId } from '../../domain/_shared/identifiants.js';

/**
 * Use case read-only : liste les diagnostics d'un Bien, triés par date_emission desc.
 * Retourne un tableau vide si le Bien n'a pas de diagnostics.
 * Throws BienIntrouvable si le Bien n'existe pas.
 */
export async function listerDiagnostics(
  bienId: BienId,
  bienRepo: BienRepository,
): Promise<Diagnostic[]> {
  const bien = await bienRepo.trouverParId(bienId);
  if (!bien) throw new BienIntrouvable(bienId);
  return [...bien.diagnostics]; // déjà triés date_emission desc par le repo
}
