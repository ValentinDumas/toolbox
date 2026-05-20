import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { calculerMicroBic } from '../../../src/application/fiscalite/calculer-micro-bic.js';

/**
 * Tests TDD — use case pur calculerMicroBic (FIS-02, D-FIS-G4.3).
 *
 * Sources juridiques :
 *   - CGI art. 50-0 (seuil micro-BIC 83 600 € recettes 2026-2028)
 *   - CGI art. 50-0 (abattement 50 %, plancher 305 €)
 *
 * Cas limites obligatoires (CONTEXT.md L242-244) :
 *   - Recettes = 8_359_999n (83 599,99 €) → micro éligible (seuilDepasse=false)
 *   - Recettes = 8_360_001n (83 600,01 €) → réel forcé (seuilDepasse=true)
 *   - Recettes × 50 % < 305 € → plancher 305 € appliqué
 *   - Recettes < abattement plancher → abattement plafonné aux recettes
 */
describe('calculerMicroBic', () => {
  it('abattement 50 % standard (recettes 60 000 €)', () => {
    const recettes = Money.fromEuros(60_000);
    const result = calculerMicroBic(recettes, REGLES_2026);
    expect(result.abattementApplique.centimes).toBe(3_000_000n); // 30 000 €
    expect(result.resultatImposable.centimes).toBe(3_000_000n); // 30 000 €
    expect(result.seuilDepasse).toBe(false);
  });

  it('plancher 305 € appliqué si abattement 50 % < 305 € (recettes 600 €)', () => {
    // 600 € × 50 % = 300 € < 305 € plancher
    const recettes = Money.fromCentimes(60_000n); // 600 €
    const result = calculerMicroBic(recettes, REGLES_2026);
    expect(result.abattementApplique.centimes).toBe(30_500n); // 305 €
    expect(result.resultatImposable.centimes).toBe(29_500n);  // 600 - 305 = 295 €
    expect(result.seuilDepasse).toBe(false);
  });

  it('seuil exact 83 599,99 € → micro éligible (seuilDepasse=false)', () => {
    const recettes = Money.fromCentimes(8_359_999n); // 83 599,99 €
    const result = calculerMicroBic(recettes, REGLES_2026);
    expect(result.seuilDepasse).toBe(false);
  });

  it('seuil + 1 centime 83 600,01 € → réel forcé (seuilDepasse=true)', () => {
    const recettes = Money.fromCentimes(8_360_001n); // 83 600,01 €
    const result = calculerMicroBic(recettes, REGLES_2026);
    expect(result.seuilDepasse).toBe(true);
  });

  it('abattement plafonné aux recettes si plancher > recettes (recettes 100 €)', () => {
    // 100 € × 50 % = 50 € < plancher 305 € → plancher = 305 € > recettes = 100 €
    // Abattement doit être plafonné à 100 € (les recettes elles-mêmes)
    const recettes = Money.fromCentimes(10_000n); // 100 €
    const result = calculerMicroBic(recettes, REGLES_2026);
    expect(result.abattementApplique.centimes).toBe(10_000n); // plafonné à 100 €
    expect(result.resultatImposable.centimes).toBe(0n); // 100 - 100 = 0 €
    expect(result.seuilDepasse).toBe(false);
  });
});
