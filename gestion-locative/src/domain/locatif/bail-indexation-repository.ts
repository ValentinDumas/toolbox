import type { BailId, BailIndexationId } from '../_shared/identifiants.js';

import type { BailIndexation } from './bail-indexation.js';

/**
 * Port repository BailIndexation (Phase 3-04, LOC-04 apply, D-96).
 *
 * Append-only strict — pas de méthode `supprimer` ou `mettreAJour`.
 * Une correction métier se traduit par un nouvel enregistrement
 * (deuxième ligne, jamais une modification de la première).
 *
 * `trxArg` (type opaque dans le port pour ne pas importer Kysely dans le
 * domaine) permet à un use case d'enrôler `enregistrer` dans sa transaction.
 */
export interface BailIndexationRepository {
  enregistrer(bi: BailIndexation, trxArg?: unknown): Promise<void>;

  trouverParId(id: BailIndexationId): Promise<BailIndexation | null>;

  /** Liste les indexations d'un bail, triées date_effet DESC (chronologique inverse). */
  listerParBail(bailId: BailId): Promise<BailIndexation[]>;

  /** Retourne la dernière indexation enregistrée pour un bail (la plus récente), ou null. */
  dernierePourBail(bailId: BailId): Promise<BailIndexation | null>;
}
