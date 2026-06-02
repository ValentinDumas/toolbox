/**
 * Port `MappingLiasseProvider` — injection versionnable du mapping case-par-case
 * du cerfa 2031-SD + annexes 2033-A/B/C/D + 2042-C-PRO (Phase 6 / FIS-05 / D-L6.3).
 *
 * Pattern miroir exact : `src/domain/fiscalite/regles/regle-fiscale-provider.ts`.
 *
 * **Différence sémantique vs `RegleFiscaleProvider` (pitfall §6 RESEARCH.md) :**
 * - `RegleFiscaleProvider` couvre la révision triennale 2026-2028 d'un coup.
 * - `MappingLiasseProvider` couvre **un seul millésime** au démarrage car
 *   le format du cerfa peut changer chaque année (LF). Le fail-fast sur tout
 *   autre millésime force la création de `mapping-liasse-<millesime>.ts`
 *   après revérification du PDF officiel impots.gouv.fr (R1.1 RISKS.md).
 *
 * Aucun use case n'a besoin d'être modifié au changement de millésime — le
 * port est la frontière (anti-pattern §1 : pas de hardcode de case ailleurs).
 */

import { MAPPING_LIASSE_2026, type MappingLiasse2026 } from './mapping-liasse-2026.js';
import { MappingLiasseAbsent } from '../erreurs.js';

/**
 * Port domaine `MappingLiasseProvider`.
 *
 * Exposé par injection dans tous les use cases qui produisent un brouillon liasse
 * (vue HTML Wave 1, traçabilité Wave 2, rectificative Wave 3, exports PDF/CSV Wave 4).
 */
export interface MappingLiasseProvider {
  /**
   * Retourne le mapping case-par-case pour un millésime cerfa donné.
   * @throws {MappingLiasseAbsent} si le millésime n'est pas couvert.
   */
  pour(millesime: number): MappingLiasse2026;
}

/**
 * Implémentation par défaut en mémoire — couvre **uniquement 2026** au démarrage.
 *
 * Pour ajouter un millésime :
 *   1. Créer `src/domain/fiscalite/liasse/mapping-liasse-<millesime>.ts` en
 *      revérifiant chaque code lettre sur le PDF officiel impots.gouv.fr.
 *   2. L'importer ici et l'ajouter à la `Map`.
 *
 * Source : R1.1 RISKS.md (surveillance fiscale annuelle post-LF).
 */
export class MappingLiasseProviderEnMemoire implements MappingLiasseProvider {
  private readonly _mappings: Map<number, MappingLiasse2026>;

  constructor() {
    this._mappings = new Map<number, MappingLiasse2026>([
      [2026, MAPPING_LIASSE_2026],
      // V1 : pas de garantie pour 2027/2028 sans revue manuelle du cerfa millésime (R1.1).
      // Le cerfa peut changer chaque année (LF — D-L6.3).
    ]);
  }

  /**
   * Retourne le mapping pour le millésime demandé.
   * @throws {MappingLiasseAbsent} si le millésime n'est pas couvert (différence
   *   sémantique vs `RegleFiscaleProvider` qui couvre la révision triennale).
   */
  pour(millesime: number): MappingLiasse2026 {
    const mapping = this._mappings.get(millesime);
    if (!mapping) {
      throw new MappingLiasseAbsent(millesime);
    }
    return mapping;
  }
}
