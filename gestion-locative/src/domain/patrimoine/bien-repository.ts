import type { Bien } from './bien.js';
import type { BienId } from '../_shared/identifiants.js';

export interface BienRepository {
  enregistrer(bien: Bien): Promise<void>;
  trouverParId(id: BienId): Promise<Bien | null>;
  listerTous(): Promise<Bien[]>;
  supprimer(id: BienId): Promise<void>;
}
