/**
 * Fake `MappingLiasseProvider` — Map injectable pour les tests
 * (Phase 6 / FIS-05 / D-L6.3).
 *
 * Permet de tester le fail-fast `MappingLiasseAbsent` sans patcher l'impl en
 * mémoire (`MappingLiasseProviderEnMemoire`) ni dépendre du data file
 * `mapping-liasse-2026.ts`.
 *
 * Utilisation :
 * ```ts
 * const fake = new MappingLiasseProviderFake(new Map([[2025, MAPPING_LIASSE_2026]]));
 * fake.pour(2026); // → throw MappingLiasseAbsent
 * ```
 */

import type { MappingLiasseProvider } from '../../src/domain/fiscalite/liasse/mapping-liasse-provider.js';
import type { MappingLiasse2026 } from '../../src/domain/fiscalite/liasse/mapping-liasse-2026.js';
import { MappingLiasseAbsent } from '../../src/domain/fiscalite/erreurs.js';

export class MappingLiasseProviderFake implements MappingLiasseProvider {
  constructor(private readonly mappings: Map<number, MappingLiasse2026>) {}

  pour(millesime: number): MappingLiasse2026 {
    const mapping = this.mappings.get(millesime);
    if (!mapping) {
      throw new MappingLiasseAbsent(millesime);
    }
    return mapping;
  }
}
