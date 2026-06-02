/**
 * Tests unitaires — Port `MappingLiasseProvider` + data file `mapping-liasse-2026.ts`
 * (Phase 6 / FIS-05 / D-L6.3).
 *
 * Couverture obligatoire :
 *   - Le provider en mémoire retourne `MAPPING_LIASSE_2026` pour `pour(2026)`.
 *   - Le provider fait fail-fast `MappingLiasseAbsent` pour tout autre millésime.
 *   - Le mapping couvre les 5 sections V1 : 2031-SD + 2033-A/B/C/D
 *     (2042-C-PRO laissé vide, peuplé Plan 02 micro-BIC).
 *   - Chaque `caseId` est unique (propriété injectivité).
 *   - La section 2033-B contient au moins une case mappée sur `source='recettesTotales'`
 *     (clé permettant au use case Task 2 de relier la case au snapshot).
 *
 * Tests miroir : tests/unit/fiscalite/regles-2026.test.ts
 * Pattern : 06-PATTERNS.md §Pattern critique 1.
 */

import { describe, it, expect } from 'vitest';

import { MAPPING_LIASSE_2026 } from '../../../src/domain/fiscalite/liasse/mapping-liasse-2026.js';
import {
  MappingLiasseProviderEnMemoire,
} from '../../../src/domain/fiscalite/liasse/mapping-liasse-provider.js';
import { MappingLiasseAbsent } from '../../../src/domain/fiscalite/erreurs.js';

describe('MAPPING_LIASSE_2026 — data file versionné 2026 (D-L6.3)', () => {
  it('millesime est 2026', () => {
    expect(MAPPING_LIASSE_2026.millesime).toBe(2026);
  });

  it('expose les 5 annexes V1 (2031-SD, 2033-A, 2033-B, 2033-C, 2033-D)', () => {
    expect(MAPPING_LIASSE_2026.sections['2031-SD']).toBeDefined();
    expect(MAPPING_LIASSE_2026.sections['2033-A']).toBeDefined();
    expect(MAPPING_LIASSE_2026.sections['2033-B']).toBeDefined();
    expect(MAPPING_LIASSE_2026.sections['2033-C']).toBeDefined();
    expect(MAPPING_LIASSE_2026.sections['2033-D']).toBeDefined();
  });

  it('2042-C-PRO contient la case 5NI (Plan 06-02 — D-L6.2 micro-BIC)', () => {
    expect(MAPPING_LIASSE_2026.sections['2042-C-PRO']).toBeDefined();
    const case5NI = MAPPING_LIASSE_2026.sections['2042-C-PRO'].find((c) => c.caseId === '5NI');
    expect(case5NI).toBeDefined();
    expect(case5NI?.source).toBe('recettesTotales');
  });

  it('chaque caseId est unique (propriété injectivité, renforcée fast-check Plan 03)', () => {
    const tousLesCaseIds = Object.values(MAPPING_LIASSE_2026.sections)
      .flat()
      .map((c) => c.caseId);
    const uniques = new Set(tousLesCaseIds);
    expect(uniques.size).toBe(tousLesCaseIds.length);
  });

  it('2033-B contient une case mappée sur source=recettesTotales (clé use case Task 2)', () => {
    const cases2033B = MAPPING_LIASSE_2026.sections['2033-B'];
    const caseRecettes = cases2033B.find((c) => c.source === 'recettesTotales');
    expect(caseRecettes).toBeDefined();
    expect(caseRecettes?.annexe).toBe('2033-B');
  });

  it('2031-SD contient une case mappée sur source=beneficeFiscal', () => {
    const cases2031 = MAPPING_LIASSE_2026.sections['2031-SD'];
    const caseBeneficeFiscal = cases2031.find((c) => c.source === 'beneficeFiscal');
    expect(caseBeneficeFiscal).toBeDefined();
  });

  it('2031-SD contient une case mappée sur source=deficitFiscal', () => {
    const cases2031 = MAPPING_LIASSE_2026.sections['2031-SD'];
    const caseDeficit = cases2031.find((c) => c.source === 'deficitFiscal');
    expect(caseDeficit).toBeDefined();
  });

  it('2033-B contient une case mappée sur source=dotationAmortissement', () => {
    const cases2033B = MAPPING_LIASSE_2026.sections['2033-B'];
    const caseDotation = cases2033B.find((c) => c.source === 'dotationAmortissement');
    expect(caseDotation).toBeDefined();
  });

  it('2033-B contient une case mappée sur source=chargesAutresExternes (D-FIS-G2.2)', () => {
    const cases2033B = MAPPING_LIASSE_2026.sections['2033-B'];
    const caseCharges = cases2033B.find((c) => c.source === 'chargesAutresExternes');
    expect(caseCharges).toBeDefined();
  });

  it('2033-A contient au moins une case marquée source=manuel (D-A6.2 postes non modélisés)', () => {
    const cases2033A = MAPPING_LIASSE_2026.sections['2033-A'];
    const casesManuelles = cases2033A.filter((c) => c.source === 'manuel');
    expect(casesManuelles.length).toBeGreaterThan(0);
  });
});

describe('MappingLiasseProviderEnMemoire — port d\'injection versionné (D-L6.3)', () => {
  it('pour(2026) retourne MAPPING_LIASSE_2026', () => {
    const provider = new MappingLiasseProviderEnMemoire();
    const mapping = provider.pour(2026);
    expect(mapping).toBe(MAPPING_LIASSE_2026);
    expect(mapping.millesime).toBe(2026);
  });

  it('pour(2027) throw MappingLiasseAbsent (différence vs RegleFiscaleProvider triennal — pitfall §6)', () => {
    const provider = new MappingLiasseProviderEnMemoire();
    expect(() => provider.pour(2027)).toThrowError(MappingLiasseAbsent);
  });

  it('pour(2025) throw MappingLiasseAbsent (avant V1)', () => {
    const provider = new MappingLiasseProviderEnMemoire();
    expect(() => provider.pour(2025)).toThrowError(MappingLiasseAbsent);
  });

  it('MappingLiasseAbsent expose error.name = "MappingLiasseAbsent"', () => {
    const provider = new MappingLiasseProviderEnMemoire();
    try {
      provider.pour(2027);
      // jamais atteint
      expect.fail('attendu : MappingLiasseAbsent');
    } catch (e) {
      const err = e as Error;
      expect(err.name).toBe('MappingLiasseAbsent');
      expect(err.message).toContain('2027');
    }
  });

  it('MappingLiasseAbsent message cite explicitement R1.1 RISKS.md (surveillance fiscale annuelle)', () => {
    const provider = new MappingLiasseProviderEnMemoire();
    try {
      provider.pour(2027);
      expect.fail('attendu : MappingLiasseAbsent');
    } catch (e) {
      const err = e as Error;
      expect(err.message).toMatch(/R1\.1/);
    }
  });
});
