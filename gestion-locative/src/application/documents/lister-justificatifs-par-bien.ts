import type { BienId } from '../../domain/_shared/identifiants.js';
import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

const PAGE_SIZE_FICHE = 5;

/**
 * Use case `listerJustificatifsParBien` (UI-5.4, fiche Bien section "Documents").
 *
 * Retourne les `pageSize` derniers justificatifs rattachés au Bien (ORDER BY
 * `date_document DESC`) + total pour le lien "Voir tous les documents de ce Bien (N)".
 */
export async function listerJustificatifsParBien(
  cmd: { bienId: BienId | string; pageSize?: number },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ items: Justificatif[]; total: number }> {
  const pageSize = cmd.pageSize ?? PAGE_SIZE_FICHE;
  const { items, total } = await deps.justificatifRepo.rechercher({
    bienId: cmd.bienId,
    page: 1,
    pageSize,
  });
  return { items, total };
}
