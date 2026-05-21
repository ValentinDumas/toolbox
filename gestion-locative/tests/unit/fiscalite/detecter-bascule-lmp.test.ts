/**
 * Tests TDD — detecter-bascule-lmp (RED phase).
 *
 * Cas obligatoires CONTEXT.md L245-247 + D-FIS-G3.3 + D-FIS-G3.4.
 * Chaque exception du droit fiscal a son test dédié (BDD_PRACTICES.md).
 *
 * Sources juridiques :
 *   CGI art. 155 IV — critères LMP (a) recettes > 23 000 € ET (b) recettes > revenus actifs foyer.
 *   Conseil Constitutionnel n° 2009-587 DC — suppression condition RCS.
 *   D-FIS-G3.3 — verdict tri-état (LMNP confirmé / Indéterminé / LMP probable).
 *   D-FIS-G3.4 — évaluation indépendante par exercice (anti-sticky LMP).
 */

import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { detecterBasculeLmp } from '../../../src/application/fiscalite/detecter-bascule-lmp.js';

describe('detecterBasculeLmp — tri-état CGI art. 155 IV', () => {
  // ── Test 1 : recettes sous seuil + revenusFoyer null → LMNP confirmé ──────
  it('Test 1 : recettes 22_999.99 € + revenusFoyer null → lmnp_confirme (sous seuil, revenus pas requis)', () => {
    const recettes = Money.fromCentimes(2_299_999n); // 22 999,99 €
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer: null }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Test 2 : recettes sous seuil + revenusFoyer non null → LMNP confirmé ──
  it('Test 2 : recettes 22_999.99 € + revenusFoyer 10_000 € → lmnp_confirme', () => {
    const recettes = Money.fromCentimes(2_299_999n); // 22 999,99 €
    const revenusFoyer = Money.fromEuros(10_000);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Test 3 : recettes exactement 23 000 € + revenusFoyer null → LMNP confirmé ──
  it('Test 3 : recettes exactement 23 000 € (égalité non strict supérieur) → lmnp_confirme', () => {
    const recettes = Money.fromCentimes(2_300_000n); // 23 000,00 € exact
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer: null }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Test 4 : recettes 23 000.01 € + revenusFoyer null → indéterminé ───────
  it('Test 4 : recettes 23_000.01 € + revenusFoyer null → indetermine_revenus_foyer_manquants', () => {
    const recettes = Money.fromCentimes(2_300_001n); // 23 000,01 €
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer: null }, REGLES_2026);
    expect(resultat).toBe('indetermine_revenus_foyer_manquants');
  });

  // ── Test 5 : recettes < revenusFoyer → LMNP confirmé (critère b non rempli) ──
  it('Test 5 : recettes 24_000 € + revenusFoyer 24_001 € → lmnp_confirme (recettes ≤ revenusFoyer)', () => {
    const recettes = Money.fromEuros(24_000);
    const revenusFoyer = Money.fromEuros(24_001);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Test 6 : recettes = revenusFoyer → LMNP confirmé (égalité, critère b strict non rempli) ──
  it('Test 6 : recettes 24_000 € + revenusFoyer 24_000 € (égalité) → lmnp_confirme (CONTEXT.md L246 cas obligatoire)', () => {
    const recettes = Money.fromEuros(24_000);
    const revenusFoyer = Money.fromEuros(24_000);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Test 7 : les 2 critères stricts remplis → LMP probable ───────────────
  it('Test 7 : recettes 24_000 € + revenusFoyer 23_000 € → lmp_probable (les 2 critères CGI 155 IV remplis)', () => {
    const recettes = Money.fromEuros(24_000);
    const revenusFoyer = Money.fromEuros(23_000);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmp_probable');
  });

  // ── Test 8 : recettes > seuil + revenusFoyer null → indéterminé ──────────
  it('Test 8 : recettes 24_000 € + revenusFoyer null → indetermine_revenus_foyer_manquants', () => {
    const recettes = Money.fromEuros(24_000);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer: null }, REGLES_2026);
    expect(resultat).toBe('indetermine_revenus_foyer_manquants');
  });

  // ── Test 9 : anti-sticky — 3 exercices indépendants sans mémoire d'état ──
  it('Test 9 : anti-sticky (D-FIS-G3.4) — 3 appels successifs retournent des verdicts indépendants', () => {
    // N : LMNP — recettes 24 000 € + foyer 30 000 € → lmnp_confirme
    const verdictN = detecterBasculeLmp(
      { recettes: Money.fromEuros(24_000), revenusFoyer: Money.fromEuros(30_000) },
      REGLES_2026,
    );
    expect(verdictN).toBe('lmnp_confirme');

    // N+1 : LMP probable — recettes 24 000 € + foyer 20 000 € → lmp_probable
    const verdictN1 = detecterBasculeLmp(
      { recettes: Money.fromEuros(24_000), revenusFoyer: Money.fromEuros(20_000) },
      REGLES_2026,
    );
    expect(verdictN1).toBe('lmp_probable');

    // N+2 : LMNP — recettes 24 000 € + foyer 30 000 € → lmnp_confirme (PAS de sticky LMP)
    const verdictN2 = detecterBasculeLmp(
      { recettes: Money.fromEuros(24_000), revenusFoyer: Money.fromEuros(30_000) },
      REGLES_2026,
    );
    expect(verdictN2).toBe('lmnp_confirme');
  });

  // ── Cas limite boundary : recettes = 2_300_001n + revenusFoyer = 2_300_001n ──
  it('Cas limite CONTEXT.md L246 : recettes 23_000.01 € = revenusFoyer 23_000.01 € → lmnp_confirme (égalité non strict)', () => {
    const recettes = Money.fromCentimes(2_300_001n);
    const revenusFoyer = Money.fromCentimes(2_300_001n);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmnp_confirme');
  });

  // ── Cas limite boundary CONTEXT.md L247 : 2 critères stricts remplis ──────
  it('Cas limite CONTEXT.md L247 : recettes 24_000 € + revenusFoyer 23_000 € → lmp_probable', () => {
    const recettes = Money.fromCentimes(2_400_000n);
    const revenusFoyer = Money.fromCentimes(2_300_000n);
    const resultat = detecterBasculeLmp({ recettes, revenusFoyer }, REGLES_2026);
    expect(resultat).toBe('lmp_probable');
  });
});
