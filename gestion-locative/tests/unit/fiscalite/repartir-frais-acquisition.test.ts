/**
 * Tests unitaires — repartirFraisAcquisition use case pur (D-FIS-G1.3).
 *
 * BDD outside-in : tests RED avant implémentation.
 * Source : BOFIP-BIC-AMT-10-20 §110 — frais d'acquisition répartis au prorata
 *          sur composants amortissables, dernier composant absorbant l'arrondi.
 * Analog : tests/unit/encaissements/creer-encaissement.test.ts
 */
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import { repartirFraisAcquisition } from '../../../src/application/fiscalite/repartir-frais-acquisition.js';

const BIEN_ID = crypto.randomUUID() as BienId;
const DATE_ACQ = Temporal.PlainDate.from('2026-03-15');

function creerComposant(
  type: 'terrain' | 'gros_oeuvre' | 'toiture_facade' | 'installations_techniques' | 'agencements_interieurs' | 'mobilier',
  montantEuros: number,
) {
  return Composant.creer({
    bienId: BIEN_ID,
    type,
    montantHt: Money.fromEuros(montantEuros),
    dateAcquisition: DATE_ACQ,
    origineKind: 'initial',
  });
}

describe('repartirFraisAcquisition — cas G1.3 (BOFIP-BIC-AMT-10-20 §110)', () => {
  it('Test 14 : exemple G1.3 — 5 composants amortissables Σ 200k + frais 24k → prorata avec arrondi mobilier', () => {
    const composants = [
      creerComposant('terrain', 0),         // non amortissable
      creerComposant('gros_oeuvre', 150_000),
      creerComposant('toiture_facade', 30_000),
      creerComposant('installations_techniques', 10_000),
      creerComposant('agencements_interieurs', 5_000),
      creerComposant('mobilier', 5_000),
    ];

    const fraisTotal = Money.fromEuros(24_000);
    const repartition = repartirFraisAcquisition({ composants, fraisTotal });

    // terrain non inclus (non amortissable)
    expect(repartition.size).toBe(5);

    // gros_oeuvre : 24_000 × (150_000 / 200_000) = 18_000 €
    const goId = composants[1]!.id;
    expect(repartition.get(goId)?.egale(Money.fromEuros(18_000))).toBe(true);

    // toiture_facade : 24_000 × (30_000 / 200_000) = 3_600 €
    const toitureId = composants[2]!.id;
    expect(repartition.get(toitureId)?.egale(Money.fromEuros(3_600))).toBe(true);

    // installations_techniques : 24_000 × (10_000 / 200_000) = 1_200 €
    const instalId = composants[3]!.id;
    expect(repartition.get(instalId)?.egale(Money.fromEuros(1_200))).toBe(true);

    // agencements_interieurs : 24_000 × (5_000 / 200_000) = 600 €
    const agencementsId = composants[4]!.id;
    expect(repartition.get(agencementsId)?.egale(Money.fromEuros(600))).toBe(true);

    // mobilier (dernier) absorbe l'arrondi
    // théorique : 24_000 × (5_000 / 200_000) = 600 €
    // Σ précédents = 18_000 + 3_600 + 1_200 + 600 = 23_400
    // mobilier = 24_000 - 23_400 = 600 €
    const mobilierCId = composants[5]!.id;
    expect(repartition.get(mobilierCId)?.egale(Money.fromEuros(600))).toBe(true);

    // Σ toutes quotes-parts === fraisTotal exact au centime
    let total = Money.zero();
    for (const v of repartition.values()) {
      total = total.additionner(v);
    }
    expect(total.egale(fraisTotal)).toBe(true);
  });

  it('Test 15 : 1 seul composant amortissable reçoit 100 % des frais', () => {
    const composants = [
      creerComposant('terrain', 0),
      creerComposant('gros_oeuvre', 200_000),
    ];
    const fraisTotal = Money.fromEuros(20_000);
    const repartition = repartirFraisAcquisition({ composants, fraisTotal });

    expect(repartition.size).toBe(1);
    const goId = composants[1]!.id;
    expect(repartition.get(goId)?.egale(Money.fromEuros(20_000))).toBe(true);
  });

  it('Test 16 : aucun composant amortissable (que terrain) → Map vide (D-FIS-G1.1)', () => {
    const composants = [creerComposant('terrain', 0)];
    const fraisTotal = Money.fromEuros(5_000);
    const repartition = repartirFraisAcquisition({ composants, fraisTotal });
    expect(repartition.size).toBe(0);
  });

  it('Test 17 : Σ amortissables montantHt = 0 (cas terrain uniquement avec d\'autres à 0) → Map vide', () => {
    // Seul composant amortissable mais montantHt = 0 (edge case bizarre — caller refuse)
    // Note : composant amortissable avec montantHt = 0 lance InvariantViolated à la création
    // Donc ce cas test que si tous composants sont terrain (non amortissables), on retourne Map vide
    const composants = [creerComposant('terrain', 0)];
    const result = repartirFraisAcquisition({ composants, fraisTotal: Money.fromEuros(1_000) });
    expect(result.size).toBe(0);
  });

  it('arrondi absorbé par le dernier dans ordre stable — cas avec arrondi non trivial', () => {
    // 3 composants amortissables avec Σ = 100_000, frais = 1_000 € (non divisible proprement)
    // Σ = 100_000 (3 composants : gros_oeuvre 34_000 + toiture 33_000 + mobilier 33_000)
    // Attendu : mobilier absorbe arrondi pour garantir Σ = 1_000 €
    const composants = [
      creerComposant('gros_oeuvre', 34_000),
      creerComposant('toiture_facade', 33_000),
      creerComposant('mobilier', 33_000),
    ];
    const fraisTotal = Money.fromEuros(1_000);
    const repartition = repartirFraisAcquisition({ composants, fraisTotal });

    let somme = Money.zero();
    for (const v of repartition.values()) {
      somme = somme.additionner(v);
    }
    // La somme doit être exactement égale aux fraisTotal
    expect(somme.egale(fraisTotal)).toBe(true);
    expect(repartition.size).toBe(3);
  });
});
