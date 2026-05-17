/**
 * Use case ListerEDL — LOC-03.
 * Retourne le tuple (edlEntreeActif, edlSortieActif) pour l'affichage sur la fiche Bail.
 */
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
import type { EtatDesLieux } from '../../domain/locatif/etat-des-lieux.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

export async function listerEDL(
  bailId: BailId,
  edlRepo: EtatDesLieuxRepository,
): Promise<{ entree: EtatDesLieux | null; sortie: EtatDesLieux | null }> {
  // Parallélisation des 2 lookups
  const [entree, sortie] = await Promise.all([
    edlRepo.trouverActifParBailEtType(bailId, 'entree'),
    edlRepo.trouverActifParBailEtType(bailId, 'sortie'),
  ]);

  return { entree, sortie };
}
