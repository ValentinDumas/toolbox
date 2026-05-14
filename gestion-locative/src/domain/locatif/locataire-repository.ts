import type { Locataire } from './locataire.js';
import type { LocataireId } from '../_shared/identifiants.js';

export interface LocataireRepository {
  enregistrer(locataire: Locataire): Promise<void>;
  trouverParId(id: LocataireId): Promise<Locataire | null>;
  listerTous(): Promise<Locataire[]>;
  supprimer(id: LocataireId): Promise<void>;
}
