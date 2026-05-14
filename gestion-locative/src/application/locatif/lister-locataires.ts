import type { Locataire } from '../../domain/locatif/locataire.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';

export async function listerLocataires(repo: LocataireRepository): Promise<Locataire[]> {
  return repo.listerTous();
}
