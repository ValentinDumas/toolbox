import type { DeclarationCfeId } from '../../domain/_shared/identifiants.js';
import { DeclarationCfeIntrouvable } from '../../domain/fiscalite/erreurs.js';
import type { DeclarationCfe, DeclarationCfeProps } from '../../domain/fiscalite/cfe/declaration-cfe.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';

export type PatchDeclarationCfe = Partial<
  Omit<DeclarationCfeProps, 'id' | 'bienId' | 'millesime'>
>;

export interface ModifierDeclarationCfeCommande {
  id: DeclarationCfeId;
  patch: PatchDeclarationCfe;
}

export interface ModifierDeclarationCfeDeps {
  cfeRepo: DeclarationCfeRepository;
}

/**
 * Use case — modifier une DeclarationCfe existante (Phase 6 / FIS-06).
 *
 * Charge → applique le patch via copy-on-write → upsert.
 *
 * Throws:
 *   - `DeclarationCfeIntrouvable` si id inconnu.
 *   - `InvariantViolated` si le patch viole un invariant D-CFE6.3.
 */
export async function modifierDeclarationCfe(
  commande: ModifierDeclarationCfeCommande,
  deps: ModifierDeclarationCfeDeps,
): Promise<DeclarationCfe> {
  const existante = await deps.cfeRepo.trouverParId(commande.id);
  if (!existante) {
    throw new DeclarationCfeIntrouvable(commande.id);
  }
  const nouvelleVersion = existante.modifier(commande.patch);
  await deps.cfeRepo.enregistrer(nouvelleVersion);
  return nouvelleVersion;
}
