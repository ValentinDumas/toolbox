import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

/**
 * Use case `listerCorbeille` (DOC-03, UI-5.1).
 *
 * Retourne les justificatifs soft-deleted dans l'ordre `corbeille_le DESC`
 * (cf. JustificatifRepositorySqlite.listerCorbeille).
 */
export async function listerCorbeille(
  _cmd: Record<string, never>,
  deps: { justificatifRepo: JustificatifRepository },
): Promise<Justificatif[]> {
  return deps.justificatifRepo.listerCorbeille();
}
