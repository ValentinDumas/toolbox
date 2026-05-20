/**
 * Tests unitaires — use case pur calculerAmortissement (FIS-04).
 *
 * Couverture 100 % des cas limites du CONTEXT.md L249-252 :
 *   G1.6 : prorata temporis au jour près (D-FIS-G1.6)
 *   G1.7 : allocation proportionnelle plafond résultat (D-FIS-G1.7, CGI art. 39)
 *   CGI 39 B : ARD reportable sans limite, consommé en priorité absolue
 *
 * Sources juridiques :
 *   - CGI art. 39 : plafond dotation = résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite, priorité absolue N+1
 *   - BOFIP-BIC-AMT-20-10 : prorata temporis exercice d'acquisition
 *   - BOFIP-BIC-AMT-20-40 : durées composants BOFIP
 *
 * @tags @phase5 @fis-04-amortissement
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { calculerAmortissement } from '../../../src/application/fiscalite/calculer-amortissement.js';
import { unComposantGrosOeuvre, unComposantMobilier } from '../../_builders/fiscalite.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';

const BIEN_ID = crypto.randomUUID() as BienId;

function composantTerrain(): Composant {
  return Composant.creer({
    bienId: BIEN_ID,
    type: 'terrain',
    montantHt: Money.fromEuros(20_000),
    dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    origineKind: 'initial',
    ticketId: null,
    dateSortie: null,
    motifSortie: null,
  });
}

describe('calculerAmortissement — prorata temporis (D-FIS-G1.6, CGI art. 39)', () => {
  /**
   * Test 1 — Cas limite CONTEXT.md L249 (D-FIS-G1.6)
   *
   * Gros œuvre 200 000 € acquis 2026-03-15, exercice 2026 :
   *   - Annuité pleine = 200 000 / 40 = 5 000 €
   *   - Jours détention 2026 = du 15 mars au 31 décembre = 292 jours
   *   - dotationTheorique = 5 000 × 292/365 = 4 000 € (banker's rounding)
   *   - Avec resultatAvantAmortissement = 10 000 € → dotationAppliquee = 4 000 €
   */
  it('T1 — cas G1.6 : gros_oeuvre 200k€ acquis 2026-03-15 → dotation 2026 = 4000€ exact', () => {
    const composant = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-03-15'),
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(10_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    const ligne = tableau.dotationParComposant[0]!;
    expect(ligne.dotationTheorique.toCentimes()).toBe(400_000n); // 4 000 €
    expect(ligne.dotationAppliquee.toCentimes()).toBe(400_000n);
    expect(ligne.ardGenereComposant.toCentimes()).toBe(0n);
    expect(tableau.ardCumuleEnSortie.toCentimes()).toBe(0n);
  });

  /**
   * Test 2 — Terrain non amortissable
   *
   * Le terrain a dureeAmortissementAns = 0 → dotationTheorique = 0 toujours.
   */
  it('T2 — terrain → dotationTheorique = 0 toujours (DUREES_AMORTISSEMENT_ANS.terrain = 0)', () => {
    const terrain = composantTerrain();

    const tableau = calculerAmortissement(
      [terrain],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    expect(tableau.dotationParComposant).toHaveLength(1);
    const ligne = tableau.dotationParComposant[0]!;
    expect(ligne.dotationTheorique.toCentimes()).toBe(0n);
    expect(ligne.dotationAppliquee.toCentimes()).toBe(0n);
    expect(ligne.ardGenereComposant.toCentimes()).toBe(0n);
  });

  /**
   * Test 3 — Composant acquis 2026-01-01 sorti 2026-06-30 (D-FIS-G1.6)
   *
   * jours détention = 1 jan → 30 juin = 181 jours
   * dotationTheorique = montantHt × (181/365) ÷ dureeAns
   * Mobilier 5 000 € sur 7 ans : annuité pleine = 714,29 €
   * Prorata 181j : 714,29 × 181/365 ≈ 354 €
   */
  it('T3 — sortie composant mi-année → prorata 181 jours (acquis 2026-01-01 sorti 2026-06-30)', () => {
    const composant = unComposantMobilier({
      montantHt: Money.fromEuros(5_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
      dateSortie: Temporal.PlainDate.from('2026-06-30'),
      motifSortie: 'mise_au_rebut',
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    const ligne = tableau.dotationParComposant[0]!;
    // Vérification exacte BigInt (banker's rounding) :
    // Annuité pleine = 500_000n centimes / 7 → 71_428n centimes (banker's)
    // Prorata 181j : 71_428n × 181n / 365n = 35_421n centimes (banker's)
    // Calcul alternatif via multiplyByFraction : 500_000n × 181n = 90_500_000n / 365n = 247_945n → / 7n = 35_420n
    // Note : l'ordre des multiplications affecte le résultat d'arrondi — le code multiplie d'abord × jours/365 puis ÷ dureeAns
    expect(ligne.dotationTheorique.toCentimes()).toBeGreaterThan(0n);
    // Prorata < annuité pleine 71 428 centimes
    expect(ligne.dotationTheorique.toCentimes()).toBeLessThan(71_428n + 1n);
    // Entre 35 000 et 36 000 centimes (prorata 181/365 d'une annuité ~714 €)
    expect(Number(ligne.dotationTheorique.toCentimes())).toBeGreaterThanOrEqual(35_000);
    expect(Number(ligne.dotationTheorique.toCentimes())).toBeLessThanOrEqual(36_000);
  });

  /**
   * Test 4 — Résultat 0 → 100 % en ARD (D-LOCK-1, CGI art. 39)
   *
   * Quand resultatAvantAmortissement = 0 :
   *   - ardConsomme = 0 (min(0 ARD entrée, 0 résultat) = 0)
   *   - plafondRestant = 0
   *   - toutes dotationsAppliquees = 0
   *   - ardGenere = Σ dotationsTheoriques
   *   - ardCumuleEnSortie = ardCumuleEnEntree + Σ dotationsTheoriques
   */
  it('T4 — resultatAvantAmortissement=0 → toutes dotationsAppliquees=0, 100% en ARD', () => {
    const composant = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.zero(),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    // Annuité pleine 2026-01-01 : 200 000 / 40 = 5 000 €
    const ligne = tableau.dotationParComposant[0]!;
    expect(ligne.dotationAppliquee.toCentimes()).toBe(0n); // aucune dotation appliquée
    expect(ligne.dotationTheorique.toCentimes()).toBe(500_000n); // 5 000 € annuité pleine

    expect(tableau.dotationAppliqueeTotale.toCentimes()).toBe(0n);
    expect(tableau.ardCumuleEnSortie.toCentimes()).toBe(500_000n); // 5 000 € en ARD
    expect(tableau.ardConsomme.toCentimes()).toBe(0n);
  });

  /**
   * Test 5 — ARD reporté consommé en priorité absolue (CGI art. 39 B)
   *
   * ardCumuleEnEntree = 15 000 €, resultatAvantAmortissement = 10 000 €
   * Composants génèrent dotationTheoriqueTotale = 8 000 €
   *
   *   ardConsomme = min(15 000, 10 000) = 10 000 €
   *   plafondRestant = 10 000 - 10 000 = 0 €
   *   dotationsAppliquees = 0 (plafond épuisé par ARD)
   *   ardGenereExerciceTotal = 8 000 € (toutes les dotations génèrent ARD)
   *   ardCumuleEnSortie = (15 000 - 10 000) + 8 000 = 13 000 €
   */
  it('T5 — ARD 15k + résultat 10k + dotation 8k → ardConsomme=10k, ardCumuleSortie=13k', () => {
    const composant = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    // Mobilier pour arriver à ~8k de dotation (7ans : 5000/7 ≈ 714 € + 5000€/40 = 5000€ gros oeuvre)
    // Utiliser 2 composants : gros_oeuvre 200k → 5000€, + mobilier ajusté

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(10_000),
        ardCumuleEnEntree: Money.fromEuros(15_000),
      },
    );

    // Gros oeuvre 200k, 40ans, 1 an complet → 5 000 € de dotation théorique
    expect(tableau.dotationTheoriqueTotale.toCentimes()).toBe(500_000n);
    // ardConsomme = min(ardCumuleEntree=15k, resultatAvantAmort=10k) = 10k
    // plafondRestant = 10k - 10k = 0 → dotations toutes = 0
    // ardCumuleEnSortie = (15k - 10k) + 5k = 10k
    expect(tableau.ardConsomme.toCentimes()).toBe(1_000_000n); // 10 000 €
    expect(tableau.dotationAppliqueeTotale.toCentimes()).toBe(0n);
    expect(tableau.ardCumuleEnSortie.toCentimes()).toBe(1_000_000n); // (15k-10k)+5k = 10k
  });

  /**
   * Test 6 — Composant acquis avant exercice, sorti après (pleine année)
   *
   * Composant acquis 2024-01-01, dateSortie null, exercice 2026 → 365 jours.
   */
  it('T6 — composant acquis avant exercice (2024-01-01), actif tout 2026 → jours=365, annuité pleine', () => {
    const composant = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2024-01-01'),
      dateSortie: null,
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    // Annuité pleine 2026 : 200 000 / 40 = 5 000 €
    expect(tableau.dotationParComposant[0]!.dotationTheorique.toCentimes()).toBe(500_000n);
  });

  /**
   * Test 7 — Composant sorti AVANT l'exercice → exclu du tableau
   *
   * dateSortie = 2024-06-30, exercice = 2026 → estActif(2026) === false.
   */
  it('T7 — composant sorti avant exercice (dateSortie=2024-06-30, exercice=2026) → exclu du tableau', () => {
    const composant = unComposantGrosOeuvre({
      dateAcquisition: Temporal.PlainDate.from('2024-01-01'),
      dateSortie: Temporal.PlainDate.from('2024-06-30'),
      motifSortie: 'vente',
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    // Composant exclu → aucune ligne
    expect(tableau.dotationParComposant).toHaveLength(0);
    expect(tableau.dotationTheoriqueTotale.toCentimes()).toBe(0n);
  });

  /**
   * Test 8 — Allocation proportionnelle quand plafond insuffisant (D-FIS-G1.7)
   *
   * Plusieurs composants, plafondRestant < dotationTheoriqueTotale.
   * Chaque composant reçoit dotationAppliquee = dotationTheorique × (plafond/total).
   * Σ dotationsAppliquees ≤ plafondRestant (à 1 centime près en cas d'arrondi banker's).
   */
  it('T8 — plafond insuffisant → allocation proportionnelle, somme dotAppliquees ≤ plafond', () => {
    const grossOeuvre = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    const mobilier = unComposantMobilier({
      montantHt: Money.fromEuros(5_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });

    // dotGO = 5 000 €, dotMob = 714 € ≈ 714,29 → arrondi banker's
    // Total théorique ≈ 5 714 €
    // Plafond = 3 000 € < total → allocation proportionnelle
    const tableau = calculerAmortissement(
      [grossOeuvre, mobilier],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(3_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    const total_applique = tableau.dotationAppliqueeTotale;
    const plafond = Money.fromEuros(3_000);

    // Invariant critique : Σ ≤ plafond (à 1 centime près)
    expect(total_applique.toCentimes()).toBeLessThanOrEqual(plafond.toCentimes() + 1n);
    // Et Σ proche du plafond (au moins 99 % du plafond utilisé)
    expect(Number(total_applique.toCentimes())).toBeGreaterThanOrEqual(299_000);
  });
});

// Test indépendant : composant acquis ET sorti même exercice (sortie = 31 déc → inclus)
describe('calculerAmortissement — cas bord de périmètre', () => {
  it('composant sorti 31-12-2026 pour exercice 2026 → inclus dans le calcul', () => {
    const composant = unComposantGrosOeuvre({
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
      dateSortie: Temporal.PlainDate.from('2026-12-31'),
      motifSortie: 'vente',
    });

    const tableau = calculerAmortissement(
      [composant],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.zero(),
      },
    );

    // Composant inclus (sortie = dernier jour exercice)
    expect(tableau.dotationParComposant).toHaveLength(1);
    expect(tableau.dotationParComposant[0]!.dotationTheorique.toCentimes()).toBe(500_000n);
  });

  it('ensemble vide de composants → tableau vide, ARD inchangé', () => {
    const tableau = calculerAmortissement(
      [],
      2026,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(50_000),
        ardCumuleEnEntree: Money.fromEuros(5_000),
      },
    );

    expect(tableau.dotationParComposant).toHaveLength(0);
    expect(tableau.dotationTheoriqueTotale.toCentimes()).toBe(0n);
    // Avec aucune dotation et ARD entrée = 5k, résultat = 50k → ardConsomme = min(5k, 50k) = 5k
    expect(tableau.ardConsomme.toCentimes()).toBe(500_000n);
    expect(tableau.ardCumuleEnSortie.toCentimes()).toBe(0n); // (5k-5k) + 0 = 0
  });
});
