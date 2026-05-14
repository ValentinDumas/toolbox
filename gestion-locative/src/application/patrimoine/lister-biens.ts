import type { Bien } from '../../domain/patrimoine/bien.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';

export async function listerBiens(repo: BienRepository): Promise<Bien[]> {
  return repo.listerTous();
}
