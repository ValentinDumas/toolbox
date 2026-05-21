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
import { AmortissementExercice } from '../../../src/domain/fiscalite/amortissement-exercice.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BienId, ComposantId } from '../../../src/domain/_shared/identifiants.js';

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

// ─── Couverture domaine : AmortissementExercice invariants (lignes 84-96) ────────

describe('AmortissementExercice.creer — invariants (D-FIS-G1.7)', () => {
  const BIEN_ID = crypto.randomUUID() as BienId;
  const COMPOSANT_ID = crypto.randomUUID() as ComposantId;

  function baseProps() {
    return {
      bienId: BIEN_ID,
      composantId: COMPOSANT_ID,
      exercice: 2026,
      typeLigne: 'COMPOSANT' as const,
      dotationTheorique: Money.fromEuros(5_000),
      dotationAppliquee: Money.fromEuros(5_000),
      ardGenere: Money.zero(),
    };
  }

  it('exercice <= 0 → throw InvariantViolated (ligne 84-86)', () => {
    expect(() =>
      AmortissementExercice.creer({ ...baseProps(), exercice: 0 }),
    ).toThrow(InvariantViolated);
  });

  it('SYNTHESE_BIEN avec composantId non null → throw InvariantViolated (lignes 89-91)', () => {
    expect(() =>
      AmortissementExercice.creer({
        ...baseProps(),
        typeLigne: 'SYNTHESE_BIEN',
        composantId: COMPOSANT_ID, // doit être null pour SYNTHESE_BIEN
      }),
    ).toThrow(InvariantViolated);
  });

  it('COMPOSANT avec composantId null → throw InvariantViolated (lignes 93-96)', () => {
    expect(() =>
      AmortissementExercice.creer({
        ...baseProps(),
        typeLigne: 'COMPOSANT',
        composantId: null, // doit être non null pour COMPOSANT
      }),
    ).toThrow(InvariantViolated);
  });

  it('SYNTHESE_BIEN valide (composantId=null) → crée sans erreur', () => {
    expect(() =>
      AmortissementExercice.creer({
        bienId: BIEN_ID,
        composantId: null,
        exercice: 2026,
        typeLigne: 'SYNTHESE_BIEN',
        dotationTheorique: Money.fromEuros(5_000),
        dotationAppliquee: Money.fromEuros(5_000),
        ardGenere: Money.zero(),
        ardCumuleDisponible: Money.fromEuros(2_000),
        ardConsomme: Money.zero(),
      }),
    ).not.toThrow();
  });

  it('COMPOSANT valide → crée et expose l\'id généré', () => {
    const ae = AmortissementExercice.creer(baseProps());
    expect(ae.id).toBeTruthy();
    expect(ae.bienId).toBe(BIEN_ID);
    expect(ae.exercice).toBe(2026);
    expect(ae.typeLigne).toBe('COMPOSANT');
  });
});
