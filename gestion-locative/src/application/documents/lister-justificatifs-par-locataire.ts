import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';
import type {
  Justificatif,
  TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

/**
 * D-120 — Types autorisés sur la fiche Locataire.
 *
 * Le dossier Locataire ne montre PAS les justificatifs Bien-only (factures
 * peinture, diagnostics PDF) — seulement ceux du domaine personnel
 * locataire (pièce d'identité, RIB/relevé, attestations, autre).
 */
export const TYPES_AUTORISES_LOCATAIRE: readonly TypeJustificatif[] = [
  'piece_locataire',
  'releve_bancaire',
  'attestation',
  'autre',
] as const;

const PAGE_SIZE_FICHE = 5;

/**
 * Use case `listerJustificatifsParLocataire` (UI-5.4 + D-120).
 *
 * Si `type` est fourni, il doit appartenir à `TYPES_AUTORISES_LOCATAIRE`
 * (sinon `InvariantViolated`). Sans `type`, on filtre via `typeIn` sur les 4
 * types autorisés — `typeIn` est exposé par la port `JustificatifRepository`
 * depuis Wave 1 (future-proof D-120).
 */
export async function listerJustificatifsParLocataire(
  cmd: {
    locataireId: LocataireId | string;
    type?: TypeJustificatif;
    pageSize?: number;
  },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ items: Justificatif[]; total: number }> {
  const pageSize = cmd.pageSize ?? PAGE_SIZE_FICHE;

  if (cmd.type !== undefined && !TYPES_AUTORISES_LOCATAIRE.includes(cmd.type)) {
    throw new InvariantViolated(
      `Type non autorisé sur la fiche Locataire : ${cmd.type}.`,
    );
  }

  if (cmd.type !== undefined) {
    const r = await deps.justificatifRepo.rechercher({
      locataireId: cmd.locataireId,
      type: cmd.type,
      page: 1,
      pageSize,
    });
    return { items: r.items, total: r.total };
  }

  const r = await deps.justificatifRepo.rechercher({
    locataireId: cmd.locataireId,
    typeIn: TYPES_AUTORISES_LOCATAIRE as TypeJustificatif[],
    page: 1,
    pageSize,
  });
  return { items: r.items, total: r.total };
}
