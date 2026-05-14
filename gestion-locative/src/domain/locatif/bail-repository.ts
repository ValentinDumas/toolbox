import type { BailId, LocataireId } from '../_shared/identifiants.js';

import type { Bail } from './bail.js';

export interface BailRepository {
  enregistrer(bail: Bail): Promise<void>;
  trouverParId(id: BailId): Promise<Bail | null>;
  listerTous(): Promise<Bail[]>;
  listerParLocataire(locataireId: LocataireId): Promise<Bail[]>;
  supprimer(id: BailId): Promise<void>;
}
