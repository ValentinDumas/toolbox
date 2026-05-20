/**
 * Tests BDD — Règles fiscales LMNP 2026 (D-LOCK-1).
 *
 * Couverture obligatoire (CONTEXT.md L240-252) :
 *   - Chaque constante a la bonne valeur (centimes BigInt)
 *   - DUREES_AMORTISSEMENT_ANS expose les 6 types BOFIP avec leur durée canonique
 *   - RegleFiscaleProviderEnMemoire.pour(2026) retourne REGLES_2026
 *   - RegleFiscaleProviderEnMemoire.pour(2025) throw RegleFiscaleAbsente
 *   - RegleFiscaleProviderEnMemoire.pour(2029) throw RegleFiscaleAbsente
 *   - Cas limite seuil micro-BIC (8_359_999n lte SEUIL vs 8_360_001n gt SEUIL)
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { RegleFiscaleAbsente } from '../../../src/domain/fiscalite/erreurs.js';

describe('REGLES_2026 — constantes fiscales LMNP 2026 (D-LOCK-1)', () => {
  it('SEUIL_MICRO_BIC_LONGUE_DUREE = 8_360_000n centimes (83 600 €)', () => {
    expect(REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE.toCentimes()).toBe(8_360_000n);
  });

  it('PLANCHER_ABATTEMENT = 30_500n centimes (305 €)', () => {
    expect(REGLES_2026.PLANCHER_ABATTEMENT.toCentimes()).toBe(30_500n);
  });

  it('ABATTEMENT_LONGUE_DUREE ratio = 1/2 (BigInt, pas float)', () => {
    expect(REGLES_2026.ABATTEMENT_LONGUE_DUREE_NUM).toBe(1n);
    expect(REGLES_2026.ABATTEMENT_LONGUE_DUREE_DEN).toBe(2n);
  });

  it('SEUIL_LMP_RECETTES = 2_300_000n centimes (23 000 €)', () => {
    expect(REGLES_2026.SEUIL_LMP_RECETTES.toCentimes()).toBe(2_300_000n);
  });

  it('LF_2025_DATE_EFFET_PV = 2025-02-15 (Temporal.PlainDate)', () => {
    expect(REGLES_2026.LF_2025_DATE_EFFET_PV).toBeInstanceOf(Temporal.PlainDate);
    expect(REGLES_2026.LF_2025_DATE_EFFET_PV.toString()).toBe('2025-02-15');
  });

  it('ARD_DUREE_REPORT_SANS_LIMITE = true (CGI art. 39 B)', () => {
    expect(REGLES_2026.ARD_DUREE_REPORT_SANS_LIMITE).toBe(true);
  });

  describe('DUREES_AMORTISSEMENT_ANS — 6 types BOFIP (D-FIS-G1.1)', () => {
    it('terrain = 0 (non amortissable, CGI art. 39)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.terrain).toBe(0);
    });

    it('gros_oeuvre = 40 ans (BOFIP-BIC-AMT-20-40)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.gros_oeuvre).toBe(40);
    });

    it('toiture_facade = 25 ans (BOFIP)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.toiture_facade).toBe(25);
    });

    it('installations_techniques = 20 ans (BOFIP)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.installations_techniques).toBe(20);
    });

    it('agencements_interieurs = 15 ans (BOFIP)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.agencements_interieurs).toBe(15);
    });

    it('mobilier = 7 ans (BOFIP, référence typique LMNP)', () => {
      expect(REGLES_2026.DUREES_AMORTISSEMENT_ANS.mobilier).toBe(7);
    });
  });
});

describe('RegleFiscaleProviderEnMemoire — port d\'injection versionné (D-LOCK-1)', () => {
  it('pour(2026) retourne REGLES_2026', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(2026);
    expect(regles.SEUIL_MICRO_BIC_LONGUE_DUREE.toCentimes()).toBe(8_360_000n);
  });

  it('pour(2027) retourne REGLES_2026 (révision triennale 2026-2028)', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(2027);
    expect(regles.SEUIL_MICRO_BIC_LONGUE_DUREE.toCentimes()).toBe(8_360_000n);
  });

  it('pour(2028) retourne REGLES_2026 (révision triennale 2026-2028)', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(2028);
    expect(regles.SEUIL_MICRO_BIC_LONGUE_DUREE.toCentimes()).toBe(8_360_000n);
  });

  it('pour(2025) throw RegleFiscaleAbsente (avant plage versionnée)', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    expect(() => provider.pour(2025)).toThrowError(RegleFiscaleAbsente);
  });

  it('pour(2029) throw RegleFiscaleAbsente (après plage versionnée)', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    expect(() => provider.pour(2029)).toThrowError(RegleFiscaleAbsente);
  });

  it('RegleFiscaleAbsente a le bon nom et message', () => {
    const provider = new RegleFiscaleProviderEnMemoire();
    try {
      provider.pour(2025);
    } catch (e) {
      const err = e as Error;
      expect(err.name).toBe('RegleFiscaleAbsente');
      expect(err.message).toContain('2025');
    }
  });
});

describe('Cas limites seuil micro-BIC (CONTEXT.md L242-244)', () => {
  it('recettes 8_359_999n (83 599,99 €) lte SEUIL_MICRO_BIC → micro éligible', () => {
    const recettes = Money.fromCentimes(8_359_999n);
    expect(recettes.lte(REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE)).toBe(true);
  });

  it('recettes 8_360_000n (83 600,00 €) lte SEUIL_MICRO_BIC → micro éligible (exact)', () => {
    const recettes = Money.fromCentimes(8_360_000n);
    expect(recettes.lte(REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE)).toBe(true);
  });

  it('recettes 8_360_001n (83 600,01 €) gt SEUIL_MICRO_BIC → réel forcé', () => {
    const recettes = Money.fromCentimes(8_360_001n);
    expect(recettes.lte(REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE)).toBe(false);
    expect(recettes.superieurA(REGLES_2026.SEUIL_MICRO_BIC_LONGUE_DUREE)).toBe(true);
  });

  it('recettes 2_299_999n (22 999,99 €) lte SEUIL_LMP → LMNP confirmé (critère recettes)', () => {
    const recettes = Money.fromCentimes(2_299_999n);
    expect(recettes.lte(REGLES_2026.SEUIL_LMP_RECETTES)).toBe(true);
  });

  it('recettes 2_300_001n (23 000,01 €) gt SEUIL_LMP → critère recettes LMP franchi', () => {
    const recettes = Money.fromCentimes(2_300_001n);
    expect(recettes.superieurA(REGLES_2026.SEUIL_LMP_RECETTES)).toBe(true);
  });
});
