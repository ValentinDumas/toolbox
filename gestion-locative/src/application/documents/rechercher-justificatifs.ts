import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type {
  BienId,
  LocataireId,
} from '../../domain/_shared/identifiants.js';
import type {
  Justificatif,
  TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

/**
 * Filtres facettés exposés à la couche web pour `/coffre` (D-110, UI-3.2, UI-3.3).
 * 5 filtres combinables : search + bien + locataire + annee + type, pagination 20.
 */
export interface FiltresCoffre {
  search?: string;
  bienId?: BienId | string | null;
  locataireId?: LocataireId | string | null;
  anneeFiscale?: number;
  type?: TypeJustificatif;
  typeIn?: TypeJustificatif[];
  page?: number;
  pageSize?: number;
}

export interface RechercherJustificatifsResultat {
  items: Justificatif[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE_PAR_DEFAUT = 20;
const PAGE_SIZE_MAX = 100;

/**
 * Use case `rechercherJustificatifs` (DOC-02, D-110).
 *
 * Valide page ≥ 1 et pageSize ∈ [1, 100] (cap raisonnable) avant de déléguer
 * à `JustificatifRepository.rechercher`.
 */
export async function rechercherJustificatifs(
  filtres: FiltresCoffre,
  deps: { justificatifRepo: JustificatifRepository },
): Promise<RechercherJustificatifsResultat> {
  const page = filtres.page ?? 1;
  const pageSize = filtres.pageSize ?? PAGE_SIZE_PAR_DEFAUT;

  if (page < 1) {
    throw new InvariantViolated('La page doit être ≥ 1.');
  }
  if (pageSize < 1 || pageSize > PAGE_SIZE_MAX) {
    throw new InvariantViolated(
      `La taille de page doit être comprise entre 1 et ${PAGE_SIZE_MAX}.`,
    );
  }

  const { items, total } = await deps.justificatifRepo.rechercher({
    ...filtres,
    page,
    pageSize,
  });

  return { items, total, page, pageSize };
}
