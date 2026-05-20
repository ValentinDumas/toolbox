/**
 * Use case PUR — Calcul d'amortissement par composant LMNP (FIS-04).
 *
 * AUCUN I/O, AUCUN side-effect — fonction pure au sens mathématique.
 * Les mêmes inputs produisent toujours les mêmes outputs (testable en isolation).
 *
 * Logique fiscale :
 *   1. Filtrer les composants ACTIFS pour l'exercice (estActifPourExercice).
 *   2. Calculer la dotation théorique par composant (joursDansExercice × annuité pleine).
 *   3. Consommer l'ARD en priorité absolue (CGI art. 39 B).
 *   4. Plafonner les dotations au plafond résultat restant (CGI art. 39, D-LOCK-1).
 *   5. Allouer les dotations appliquées proportionnellement (D-FIS-G1.7, V1 convention).
 *   6. Calculer l'ARD cumulé en sortie.
 *
 * Sources juridiques :
 *   - CGI art. 39 : plafond résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite, priorité absolue sur exercices futurs
 *   - BOFIP-BIC-AMT-20-10 : prorata temporis au jour près (D-FIS-G1.6)
 *   - BOFIP-BIC-AMT-20-40 : durées composants BOFIP (terrain = 0 ans non amortissable)
 *   - D-FIS-G1.6 : prorata jours = jourFin - jourDebut + 1 (inclusif)
 *   - D-FIS-G1.7 : allocation proportionnelle V1 (option utilisateur V1.1)
 *
 * Anti-patterns (D-FIS, CONTEXT.md §anti_patterns) :
 *   - JAMAIS de float pour les montants fiscaux — uniquement Money BigInt centimes
 *   - JAMAIS d'import technique (ORM, HTTP, fichier) dans ce fichier
 *
 * Analog : src/application/locatif/simuler-indexation-irl.ts (calcul + invariants)
 */

import { Temporal } from '@js-temporal/polyfill';
import type { Composant } from '../../domain/fiscalite/composant.js';
import { TableauAmortissementExercice } from '../../domain/fiscalite/tableau-amortissement.js';
import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import { Money } from '../../domain/_shared/money.js';

export interface OptionsCalculAmortissement {
  /** Résultat de l'exercice avant tout amortissement (CGI art. 39, D-LOCK-1). */
  resultatAvantAmortissement: Money;
  /** ARD cumulé reporté de l'exercice N-1 (CGI art. 39 B). */
  ardCumuleEnEntree: Money;
}

// ─── Helpers purs ─────────────────────────────────────────────────────────────

/**
 * Retourne true si le composant est actif pendant l'exercice donné.
 *
 * Un composant est ACTIF pour un exercice si :
 *   - dateAcquisition <= 31 décembre de l'exercice (composant acquis avant ou pendant)
 *   - dateSortie === null OU dateSortie >= 1 janvier de l'exercice
 *
 * Ainsi un composant sorti au 31/12/N est inclus dans l'exercice N.
 * Un composant sorti au 01/01/N+1 n'est PLUS actif pour N+1.
 *
 * Source : BOFIP-BIC-AMT-20-10 §100 — date d'entrée et de sortie du bien
 *   (prorata sur l'exercice d'acquisition ET de sortie).
 */
export function estActifPourExercice(composant: Composant, exercice: number): boolean {
  const debutExercice = Temporal.PlainDate.from(`${exercice}-01-01`);
  const finExercice = Temporal.PlainDate.from(`${exercice}-12-31`);

  // Composant acquis après la fin de l'exercice → pas actif
  if (Temporal.PlainDate.compare(composant.dateAcquisition, finExercice) > 0) {
    return false;
  }

  // Composant sorti avant le début de l'exercice → pas actif
  if (composant.dateSortie !== null) {
    if (Temporal.PlainDate.compare(composant.dateSortie, debutExercice) < 0) {
      return false;
    }
  }

  return true;
}

/**
 * Calcule le nombre de jours de détention du composant dans l'exercice.
 *
 * Formule (D-FIS-G1.6, BOFIP-BIC-AMT-20-10) :
 *   jourDebut = max(dateAcquisition, 1er janvier de l'exercice)
 *   jourFin   = min(dateSortie ?? 31 décembre, 31 décembre de l'exercice)
 *   jours     = jourFin - jourDebut + 1 (inclusif — 1 jour = 1 jour)
 *
 * @returns nombre de jours (bigint pour Money.multiplyByFraction)
 * @throws si jours <= 0 (invariant — le composant doit être actif)
 */
export function joursDansExercice(composant: Composant, exercice: number): bigint {
  const debutExercice = Temporal.PlainDate.from(`${exercice}-01-01`);
  const finExercice = Temporal.PlainDate.from(`${exercice}-12-31`);

  // jourDebut = max(dateAcquisition, 1er jan)
  const jourDebut = Temporal.PlainDate.compare(composant.dateAcquisition, debutExercice) >= 0
    ? composant.dateAcquisition
    : debutExercice;

  // jourFin = min(dateSortie ?? fin exercice, fin exercice)
  const dateSortieEffective = composant.dateSortie !== null
    ? (Temporal.PlainDate.compare(composant.dateSortie, finExercice) <= 0
      ? composant.dateSortie
      : finExercice)
    : finExercice;

  const jours = BigInt(jourDebut.until(dateSortieEffective).days) + 1n;

  return jours;
}

// ─── Use case ──────────────────────────────────────────────────────────────────

/**
 * Calcule le tableau d'amortissement pour un exercice donné.
 *
 * Logique d'allocation plafond + ARD (D-FIS-G1.7, CGI art. 39 B) :
 *   (1) Calculer dotationTheoriqueTotale = Σ dotationsTheoriques
 *   (2) Consommer ARD prioritairement :
 *       ardConsomme = min(ardCumuleEnEntree, resultatAvantAmortissement)
 *       plafondRestant = resultatAvantAmortissement − ardConsomme
 *   (3) Allouer dotations jusqu'au plafondRestant :
 *       si dotationTheoriqueTotale ≤ plafondRestant → toutes appliquées en plein
 *       sinon → allocation proportionnelle (dotTheo × plafond/total — banker's rounding)
 *   (4) ardCumuleEnSortie = (ardCumuleEnEntree − ardConsomme)
 *                          + (dotationTheoriqueTotale − dotationAppliqueeTotale)
 *
 * @param composants - liste des composants du bien (actifs et inactifs mélangés)
 * @param exercice   - année fiscale (ex : 2026)
 * @param regles     - règles fiscales versionnées (REGLES_2026)
 * @param options    - résultat avant amortissement + ARD cumulé en entrée
 * @returns TableauAmortissementExercice immutable
 */
export function calculerAmortissement(
  composants: Composant[],
  exercice: number,
  regles: RegleFiscale2026,
  options: OptionsCalculAmortissement,
): TableauAmortissementExercice {
  const { resultatAvantAmortissement, ardCumuleEnEntree } = options;

  // Étape 1 : filtrer les composants actifs + calculer les dotations théoriques
  const composantsActifs = composants.filter((c) => estActifPourExercice(c, exercice));

  const lignesTheoriques = composantsActifs.map((c) => {
    const dureeAns = regles.DUREES_AMORTISSEMENT_ANS[c.type];

    let dotationTheorique: Money;
    if (dureeAns === 0) {
      // Terrain non amortissable — CGI art. 39
      dotationTheorique = Money.zero();
    } else {
      // Prorata temporis au jour près (D-FIS-G1.6)
      // dotation = montantHt × (jours / 365) ÷ dureeAns
      // = montantHt.multiplyByFraction(jours, 365n).multiplyByRatio(1n, dureeAns) — banker's rounding
      const jours = joursDansExercice(c, exercice);
      dotationTheorique = c.montantHt
        .multiplyByFraction(jours, 365n)
        .multiplyByRatio(1n, BigInt(dureeAns));
    }

    return { composant: c, dotationTheorique };
  });

  // Étape 2 : Consommer ARD en priorité absolue (CGI art. 39 B)
  const ardConsomme = ardCumuleEnEntree.toCentimes() <= resultatAvantAmortissement.toCentimes()
    ? ardCumuleEnEntree
    : resultatAvantAmortissement;

  const plafondRestant = resultatAvantAmortissement.soustraire(ardConsomme);

  // Étape 3 : Calculer dotationTheoriqueTotale
  const dotationTheoriqueTotale = lignesTheoriques.reduce(
    (acc, l) => acc.additionner(l.dotationTheorique),
    Money.zero(),
  );

  // Étape 4 : Allouer proportionnellement jusqu'au plafond
  let dotationParComposant;
  let dotationAppliqueeTotale: Money;

  if (dotationTheoriqueTotale.egale(Money.zero()) || dotationTheoriqueTotale.toCentimes() <= plafondRestant.toCentimes()) {
    // Toutes les dotations s'appliquent en plein
    dotationParComposant = lignesTheoriques.map((l) => ({
      composantId: l.composant.id,
      dotationTheorique: l.dotationTheorique,
      dotationAppliquee: l.dotationTheorique,
      ardGenereComposant: Money.zero(),
    }));
    dotationAppliqueeTotale = dotationTheoriqueTotale;
  } else {
    // Allocation proportionnelle (D-FIS-G1.7)
    // chaque composant reçoit dotTheo × (plafondRestant / dotationTheoriqueTotale)
    // banker's rounding via multiplyByFraction — BigInt safe
    const plafondCentimes = plafondRestant.toCentimes();
    const totalCentimes = dotationTheoriqueTotale.toCentimes();

    dotationParComposant = lignesTheoriques.map((l) => {
      const dotTheo = l.dotationTheorique;
      // dotAppliquee = dotTheo × plafondCentimes / totalCentimes
      const dotAppliquee = dotTheo.multiplyByFraction(plafondCentimes, totalCentimes);
      const ardGenereComposant = dotTheo.soustraire(dotAppliquee);

      return {
        composantId: l.composant.id,
        dotationTheorique: dotTheo,
        dotationAppliquee: dotAppliquee,
        ardGenereComposant,
      };
    });

    dotationAppliqueeTotale = dotationParComposant.reduce(
      (acc, l) => acc.additionner(l.dotationAppliquee),
      Money.zero(),
    );
  }

  // Étape 5 : Calculer ardCumuleEnSortie
  // ardCumuleEnSortie = (ardCumuleEnEntree − ardConsomme) + (dotTheoTotale − dotApplTotale)
  const ardRestantReport = ardCumuleEnEntree.soustraire(ardConsomme);
  const nouvelArd = dotationTheoriqueTotale.soustraire(dotationAppliqueeTotale);
  const ardCumuleEnSortie = ardRestantReport.additionner(nouvelArd);

  return TableauAmortissementExercice.creer({
    exercice,
    dotationParComposant,
    ardConsomme,
    ardCumuleEnEntree,
    ardCumuleEnSortie,
    dotationAppliqueeTotale,
    dotationTheoriqueTotale,
  });
}
