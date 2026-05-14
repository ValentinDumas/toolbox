import type { Bail } from './bail.js';
import type { BailId, LocataireId } from '../_shared/identifiants.js';

export interface BailRepository {
  enregistrer(bail: Bail): Promise<void>;
  trouverParId(id: BailId): Promise<Bail | null>;
  listerTous(): Promise<Bail[]>;
  listerParLocataire(locataireId: LocataireId): Promise<Bail[]>;
  supprimer(id: BailId): Promise<void>;
}
