/**
 * Ports repositories DeclarationAnnuelle + DeclarationCorrigee (Plan 06).
 *
 * Deux ports SOLID séparés :
 *   - DeclarationAnnuelleRepository : gestion du snapshot fiscal annuel append-only
 *   - DeclarationCorrigeeRepository : gestion des corrections post-clôture append-only
 *
 * APPEND-ONLY STRICT (D-FIS-G4.2, D-FIS-G4.4) :
 *   - Pas de méthode UPDATE ni DELETE
 *   - enregistrer fait INSERT SANS onConflict
 *   - UNIQUE (bailleur_id, exercice) côté DB protège contre la double clôture
 *
 * Analog : src/domain/locatif/bail-indexation-repository.ts
 */

import type { BailleurId, DeclarationAnnuelleId, DeclarationCorrigeeId } from '../_shared/identifiants.js';
import type { DeclarationAnnuelle } from './declaration-annuelle.js';
import type { DeclarationCorrigee } from './declaration-corrigee.js';

/**
 * Port repository pour DeclarationAnnuelle.
 *
 * APPEND-ONLY : pas de méthode UPDATE, DELETE ou onConflict dans les adapters.
 */
export interface DeclarationAnnuelleRepository {
  /**
   * Insère une nouvelle DeclarationAnnuelle.
   *
   * Append-only strict : JAMAIS de onConflict.
   * Si (bailleur_id, exercice) existe déjà → UNIQUE violation SQLite (attendu — double clôture interdite).
   *
   * @param decl - déclaration à insérer
   * @param trxArg - transaction Kysely optionnelle (cloturer-exercice atomique)
   */
  enregistrer(decl: DeclarationAnnuelle, trxArg?: unknown): Promise<void>;

  /** Recherche par ID. Retourne null si absent. */
  trouverParId(id: DeclarationAnnuelleId | string): Promise<DeclarationAnnuelle | null>;

  /**
   * Recherche par (bailleur_id, exercice).
   * Utilisé pour :
   *   (1) le figée check D-FIS-G2.5 (qualifier-justificatif + qualifier-ticket-travaux)
   *   (2) la vérification pre-clôture (DeclarationDejaExiste)
   *
   * Retourne null si aucune déclaration clôturée pour cet exercice.
   */
  trouverParBailleurExercice(bailleurId: BailleurId, exercice: number): Promise<DeclarationAnnuelle | null>;

  /**
   * Liste toutes les déclarations d'un bailleur, triées par exercice DESC.
   * Utilisé par la route racine /fiscalite.
   */
  listerParBailleur(bailleurId: BailleurId): Promise<DeclarationAnnuelle[]>;
}

/**
 * Port repository pour DeclarationCorrigee.
 *
 * APPEND-ONLY : N corrections successives autorisées sur la même originale.
 * Pas d'UNIQUE sur declaration_originale_id — chaque correction est une nouvelle ligne.
 */
export interface DeclarationCorrigeeRepository {
  /**
   * Insère une nouvelle DeclarationCorrigee.
   *
   * Append-only strict : JAMAIS de onConflict ni de modification de l'originale.
   *
   * @param corr - correction à insérer
   * @param trxArg - transaction Kysely optionnelle
   */
  enregistrer(corr: DeclarationCorrigee, trxArg?: unknown): Promise<void>;

  /** Recherche par ID. Retourne null si absent. */
  trouverParId(id: DeclarationCorrigeeId | string): Promise<DeclarationCorrigee | null>;

  /**
   * Liste toutes les corrections d'une déclaration originale, triées par creeLe DESC.
   * Utilisé pour afficher l'historique des corrections (N corrections successives).
   */
  listerParDeclarationOriginale(originaleId: DeclarationAnnuelleId): Promise<DeclarationCorrigee[]>;
}
