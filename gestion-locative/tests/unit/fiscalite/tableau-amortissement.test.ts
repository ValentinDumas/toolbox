/**
 * Tests unitaires — VO TableauAmortissementExercice + AmortissementExercice.
 *
 * Sources juridiques :
 *   - CGI art. 39 : dotation théorique vs appliquée
 *   - CGI art. 39 B : ARD reportable sans limite
 *   - D-FIS-G1.7 : read-model matérialisé append-only
 *   - BOFIP-BIC-AMT-20-40 : composants et durées
 *
 * @tags @phase5 @fis-04-amortissement
 */

import { describe, it, expect } from 'vitest';
import { Money } from '../../../src/domain/_shared/money.js';
import { TableauAmortissementExercice } from '../../../src/domain/fiscalite/tableau-amortissement.js';
import type { ComposantId } from '../../../src/domain/_shared/identifiants.js';

// Helpers pour les tests
function makeComposantId(): ComposantId {
  return crypto.randomUUID() as ComposantId;
}

describe('TableauAmortissementExercice — VO collection immutable (D-FIS-G1.7)', () => {
  // Test 10a — dotationTotale() = Σ dotationsAppliquees
  it('dotationAppliqueeTotale() retourne la somme des dotations appliquées de tous les composants', () => {
    const id1 = makeComposantId();
    const id2 = makeComposantId();

    const tableau = TableauAmortissementExercice.creer({
      exercice: 2026,
      dotationParComposant: [
        {
          composantId: id1,
          dotationTheorique: Money.fromEuros(4_000),
          dotationAppliquee: Money.fromEuros(4_000),
          ardGenereComposant: Money.zero(),
        },
        {
          composantId: id2,
          dotationTheorique: Money.fromEuros(3_000),
          dotationAppliquee: Money.fromEuros(2_500),
          ardGenereComposant: Money.fromEuros(500),
        },
      ],
      ardConsomme: Money.zero(),
      ardCumuleEnEntree: Money.zero(),
      ardCumuleEnSortie: Money.fromEuros(500),
      dotationAppliqueeTotale: Money.fromEuros(6_500),
      dotationTheoriqueTotale: Money.fromEuros(7_000),
    });

    expect(tableau.dotationAppliqueeTotale.toCentimes()).toBe(650_000n);
  });

  // Test 10b — ardGenereTotal() = Σ ardGenereComposant
  it('ardGenereTotal() retourne la somme des ARD générés par composant', () => {
    const id1 = makeComposantId();
    const id2 = makeComposantId();

    const tableau = TableauAmortissementExercice.creer({
      exercice: 2026,
      dotationParComposant: [
        {
          composantId: id1,
          dotationTheorique: Money.fromEuros(4_000),
          dotationAppliquee: Money.fromEuros(0),
          ardGenereComposant: Money.fromEuros(4_000),
        },
        {
          composantId: id2,
          dotationTheorique: Money.fromEuros(3_000),
          dotationAppliquee: Money.fromEuros(0),
          ardGenereComposant: Money.fromEuros(3_000),
        },
      ],
      ardConsomme: Money.zero(),
      ardCumuleEnEntree: Money.zero(),
      ardCumuleEnSortie: Money.fromEuros(7_000),
      dotationAppliqueeTotale: Money.zero(),
      dotationTheoriqueTotale: Money.fromEuros(7_000),
    });

    expect(tableau.ardGenereTotal().toCentimes()).toBe(700_000n);
  });

  // Test 10c — ARD consommé + cumulé en sortie corrects
  it('ardCumuleEnSortie et ardConsomme sont correctement exposés', () => {
    const id1 = makeComposantId();

    const tableau = TableauAmortissementExercice.creer({
      exercice: 2026,
      dotationParComposant: [
        {
          composantId: id1,
          dotationTheorique: Money.fromEuros(8_000),
          dotationAppliquee: Money.zero(),
          ardGenereComposant: Money.fromEuros(8_000),
        },
      ],
      ardConsomme: Money.fromEuros(10_000),
      ardCumuleEnEntree: Money.fromEuros(15_000),
      ardCumuleEnSortie: Money.fromEuros(13_000), // (15k-10k) + 8k
      dotationAppliqueeTotale: Money.zero(),
      dotationTheoriqueTotale: Money.fromEuros(8_000),
    });

    expect(tableau.ardConsomme.toCentimes()).toBe(1_000_000n);
    expect(tableau.ardCumuleEnSortie.toCentimes()).toBe(1_300_000n);
    expect(tableau.ardCumuleEnEntree.toCentimes()).toBe(1_500_000n);
  });

  // Collection immutable — dotationParComposant est ReadonlyArray
  it('dotationParComposant est un ReadonlyArray', () => {
    const id1 = makeComposantId();

    const tableau = TableauAmortissementExercice.creer({
      exercice: 2026,
      dotationParComposant: [
        {
          composantId: id1,
          dotationTheorique: Money.fromEuros(1_000),
          dotationAppliquee: Money.fromEuros(1_000),
          ardGenereComposant: Money.zero(),
        },
      ],
      ardConsomme: Money.zero(),
      ardCumuleEnEntree: Money.zero(),
      ardCumuleEnSortie: Money.zero(),
      dotationAppliqueeTotale: Money.fromEuros(1_000),
      dotationTheoriqueTotale: Money.fromEuros(1_000),
    });

    expect(tableau.dotationParComposant).toHaveLength(1);
    expect(tableau.dotationParComposant[0]!.composantId).toBe(id1);
  });
});
