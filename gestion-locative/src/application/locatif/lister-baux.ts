import type { Bail } from '../../domain/locatif/bail.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';

export async function listerBaux(bailRepo: BailRepository): Promise<Bail[]> {
  return bailRepo.listerTous();
}
