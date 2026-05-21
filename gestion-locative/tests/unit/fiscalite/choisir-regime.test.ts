/**
 * Tests unitaires — choisirRegime (D-FIS-G4.3).
 *
 * Sources :
 *   CGI art. 50-0 — seuil micro-BIC 83 600 € (2026-2028)
 *   BOFIP-BIC-DECLA-10-30 — option réel renouvelable 1 an tacitement
 *   D-FIS-G4.3 — choix libre sous seuil, forcé au-dessus
 *   T-05-06-08 — override 'micro_bic' ignoré si recettes > seuil
 *
 * @tags @phase5 @fis-06 unit
 */

import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { choisirRegime } from '../../../src/application/fiscalite/choisir-regime.js';

describe('choisirRegime — D-FIS-G4.3 (CGI art. 50-0 + BOFIP-BIC-DECLA-10-30)', () => {
  const SEUIL = REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE; // 83 600 €

  it('(a) recettes > seuil → réel forcé, override micro_bic ignoré (T-05-06-08)', () => {
    const recettes = SEUIL.additionner(Money.fromEuros(1)); // 83 601 €
    expect(choisirRegime(recettes, 'micro_bic', REGLES_2026)).toBe('reel');
  });

  it('(a) recettes > seuil → réel forcé, même sans override (undefined)', () => {
    const recettes = Money.fromEuros(90_000); // > 83 600 €
    expect(choisirRegime(recettes, undefined, REGLES_2026)).toBe('reel');
  });

  it('(b) recettes = seuil exact → non-dépassement → micro_bic par défaut', () => {
    // superieurA est STRICT — seuil exact n'est pas > seuil
    expect(choisirRegime(SEUIL, undefined, REGLES_2026)).toBe('micro_bic');
  });

  it('(b) recettes < seuil, override reel → reel (option bailleur BOFIP-BIC-DECLA-10-30)', () => {
    const recettes = Money.fromEuros(30_000); // < 83 600 €
    expect(choisirRegime(recettes, 'reel', REGLES_2026)).toBe('reel');
  });

  it('(c) recettes < seuil, regimeChoisi undefined → micro_bic (défaut)', () => {
    const recettes = Money.fromEuros(30_000);
    expect(choisirRegime(recettes, undefined, REGLES_2026)).toBe('micro_bic');
  });

  it('(c) recettes < seuil, regimeChoisi micro_bic explicite → micro_bic', () => {
    const recettes = Money.fromEuros(30_000);
    expect(choisirRegime(recettes, 'micro_bic', REGLES_2026)).toBe('micro_bic');
  });
});
