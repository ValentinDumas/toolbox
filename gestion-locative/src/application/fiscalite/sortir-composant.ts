/**
 * Use case : Sortie d'un composant en cours d'exercice (D-FIS-G5.2).
 *
 * Logique :
 *   (1) Lookup composant via composantRepo.trouverParId → null → throw ComposantIntrouvable.
 *   (2) composant.sortir(motif, dateSortie) — vérifie invariants :
 *       - composant déjà sorti → throw InvariantViolated (propagé).
 *       - dateSortie < dateAcquisition → throw InvariantViolated (propagé).
 *   (3) composantRepo.enregistrer (upsert via onConflict — modifie dateSortie + motifSortie).
 *
 * Note fiscale D-FIS-G5.2 :
 *   - La dotation d'amortissement de l'exercice de sortie est calculée en prorata
 *     jusqu'à dateSortie (estActifPourExercice + joursDansExercice dans calculerAmortissement).
 *   - Les exercices suivants excluent automatiquement le composant sorti (estActifPourExercice=false).
 *   - La VNC est conservée dans composants_snapshot_json de DeclarationAnnuelle pour la
 *     plus-value future (LF 2025 art. 84, CGI art. 150 VB III — réintégration gros œuvre, SIM-02 V1.1).
 *
 * Sources juridiques :
 *   - D-FIS-G5.2 : sortie composant (vente, mise_au_rebut, sinistre, autre)
 *   - LF 2025 art. 84 : réintégration des amortissements gros œuvre dans la plus-value cession
 *   - CGI art. 150 VB III : assiette plus-value immobilière LMNP
 *
 * Anti-patterns :
 *   - JAMAIS d'import technique (ORM, HTTP, fichier) dans ce fichier (hexagonal pur)
 *   - JAMAIS de float pour les montants (Money BigInt centimes)
 */

import { Temporal } from '@js-temporal/polyfill';
import type { ComposantId, MotifSortieComposant } from '../../domain/fiscalite/composant.js';
import type { ComposantRepository } from '../../domain/fiscalite/composant-repository.js';

// Re-export depuis le domaine pour que les routes puissent importer MotifSortieComposant
export type { MotifSortieComposant } from '../../domain/fiscalite/composant.js';

/**
 * Erreur levée si le composant n'est pas trouvé en base (lookup retourne null).
 */
export class ComposantIntrouvable extends Error {
  constructor(composantId: string) {
    super(`Composant introuvable : ${composantId} — D-FIS-G5.2`);
    this.name = 'ComposantIntrouvable';
  }
}

export interface SortirComposantCommande {
  composantId: ComposantId;
  motif: MotifSortieComposant;
  dateSortie: Temporal.PlainDate;
}

export interface SortirComposantDeps {
  composantRepo: ComposantRepository;
}

/**
 * Sort un composant du parc actif du bien (D-FIS-G5.2).
 *
 * @param commande - composantId + motif + dateSortie
 * @param deps - dépendances injectées (hexagonal)
 * @throws ComposantIntrouvable si le composant n'existe pas
 * @throws InvariantViolated si déjà sorti ou dateSortie incohérente (propagé depuis domaine)
 */
export async function sortirComposant(
  commande: SortirComposantCommande,
  deps: SortirComposantDeps,
): Promise<void> {
  const { composantId, motif, dateSortie } = commande;
  const { composantRepo } = deps;

  // (1) Lookup — throw si absent
  const composant = await composantRepo.trouverParId(composantId);
  if (composant === null) {
    throw new ComposantIntrouvable(composantId);
  }

  // (2) Sortie copy-on-write — InvariantViolated propagé si déjà sorti ou date incohérente
  const composantSorti = composant.sortir(motif, dateSortie);

  // (3) Persistance upsert (onConflict dans l'adapter SQLite modifie dateSortie + motifSortie)
  await composantRepo.enregistrer(composantSorti);
}
