import type { BailId, LocataireId } from '../_shared/identifiants.js';

import type { Bail } from './bail.js';

/**
 * Port repository Bail.
 *
 * `trxArg` (type opaque dans le port pour ne pas importer Kysely dans le
 * domaine) permet à un use case d'enrôler `enregistrer` dans sa transaction.
 */
export interface BailRepository {
  enregistrer(bail: Bail, trxArg?: unknown): Promise<void>;
  trouverParId(id: BailId): Promise<Bail | null>;
  listerTous(): Promise<Bail[]>;
  listerParLocataire(locataireId: LocataireId): Promise<Bail[]>;
  supprimer(id: BailId): Promise<void>;
}
