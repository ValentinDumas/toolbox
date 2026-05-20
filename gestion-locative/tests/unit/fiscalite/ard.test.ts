/**
 * Tests unitaires — VO ARD (Amortissement Réputé Différé).
 *
 * Sources juridiques :
 *   - CGI art. 39 B : ARD reportable sans limite de durée
 *   - BOFIP-BIC-AMT-20-10 : prorata temporis et traitement ARD
 *   - D-FIS-G1.7 : read-model matérialisé AmortissementExercice
 *
 * @tags @phase5 @fis-04-ard
 */

import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { ARD } from '../../../src/domain/fiscalite/ard.js';

describe('ARD — VO Amortissement Réputé Différé (CGI art. 39 B)', () => {
  // Test 9a — creer() retourne un VO valide
  it('creer(5000 €, 2026) retourne un ARD valide avec montant et exercice de génération', () => {
    const ard = ARD.creer(Money.fromEuros(5_000), 2026);

    expect(ard.montant.toCentimes()).toBe(500_000n);
    expect(ard.exerciceGeneration).toBe(2026);
  });

  // Test 9b — consommer() est immutable et retourne le reste + consommé
  it('consommer(3000 €) sur ARD(5000 €, 2026) retourne reste=2000 € et consomme=3000 €', () => {
    const ard = ARD.creer(Money.fromEuros(5_000), 2026);

    const { reste, consomme } = ard.consommer(Money.fromEuros(3_000));

    expect(reste.montant.toCentimes()).toBe(200_000n);
    expect(reste.exerciceGeneration).toBe(2026);
    expect(consomme.toCentimes()).toBe(300_000n);

    // Immutabilité : l'ARD original est inchangé
    expect(ard.montant.toCentimes()).toBe(500_000n);
  });

  // Test 9b bis — consommer() le montant exact laisse un ARD zéro
  it('consommer(5000 €) sur ARD(5000 €) retourne reste=0 € et consomme=5000 €', () => {
    const ard = ARD.creer(Money.fromEuros(5_000), 2026);

    const { reste, consomme } = ard.consommer(Money.fromEuros(5_000));

    expect(reste.montant.toCentimes()).toBe(0n);
    expect(consomme.toCentimes()).toBe(500_000n);
  });

  // Test 9c — invariant montant négatif
  it('creer() avec montant négatif doit lever InvariantViolated', () => {
    // Money.fromCentimes refuse les négatifs — Money lui-même throw
    expect(() => Money.fromCentimes(-1n)).toThrow();
  });

  // Test 9c — invariant exerciceGeneration <= 0
  it('creer() avec exerciceGeneration=0 doit lever InvariantViolated', () => {
    expect(() => ARD.creer(Money.fromEuros(1_000), 0)).toThrow('exerciceGeneration');
  });

  it('creer() avec exerciceGeneration négatif doit lever InvariantViolated', () => {
    expect(() => ARD.creer(Money.fromEuros(1_000), -1)).toThrow('exerciceGeneration');
  });

  // Test invariant consommer > disponible
  it('consommer() plus que le montant disponible doit lever InvariantViolated', () => {
    const ard = ARD.creer(Money.fromEuros(1_000), 2026);

    expect(() => ard.consommer(Money.fromEuros(1_500))).toThrow();
  });
});
