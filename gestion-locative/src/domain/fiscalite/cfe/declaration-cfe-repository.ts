import type { BienId, DeclarationCfeId } from '../../_shared/identifiants.js';

import type { DeclarationCfe } from './declaration-cfe.js';

/**
 * Port `DeclarationCfeRepository` — Phase 6 / FIS-06 / D-CFE6.2.
 *
 * `enregistrer` est un upsert : la clé d'idempotence métier est composite
 * `(bien_id, millesime)`. Une 2ᵉ insertion sur le même couple remplace la
 * version existante (contrairement à `DeclarationAnnuelle` append-only).
 *
 * Cf. Pattern critique 6 — 06-PATTERNS.md.
 */
export interface DeclarationCfeRepository {
  /**
   * Upsert sur (bien_id, millesime). Un `trxArg` optionnel permet l'exécution
   * dans une transaction Kysely (cohérence application/orchestration).
   */
  enregistrer(decl: DeclarationCfe, trxArg?: unknown): Promise<void>;

  trouverParId(id: DeclarationCfeId | string): Promise<DeclarationCfe | null>;

  trouverParBienMillesime(
    bienId: BienId,
    millesime: number,
  ): Promise<DeclarationCfe | null>;

  /** Liste les déclarations CFE d'un bien, triées millésime décroissant. */
  listerParBien(bienId: BienId | string): Promise<DeclarationCfe[]>;
}
