import type { BienId, LotId } from '../../domain/_shared/identifiants.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export async function supprimerLot(bienId: BienId, lotId: LotId, repo: BienRepository): Promise<void> {
  const bien = await repo.trouverParId(bienId);
  if (!bien) throw new BienIntrouvable(bienId);

  // Throws InvariantViolated si c'est le dernier lot (D-29)
  const bienSansLot = bien.supprimerLot(lotId);
  await repo.enregistrer(bienSansLot);
}
