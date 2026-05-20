/**
 * VO TableauAmortissementExercice — collection immutable de lignes d'amortissement.
 *
 * Retourné par le use case pur calculerAmortissement (Plan 04 Task 1).
 * Utilisé par recalculerTableauAmortissement (Task 2) pour pré-affichage S4.
 * Persisté en batch par cloturer-exercice (Plan 06).
 *
 * Expose les helpers d'agrégation :
 *   - dotationAppliqueeTotale : Σ dotationsAppliquees (colonnes du tableau S4)
 *   - ardGenereTotal() : Σ ardGenereComposant
 *   - ardCumuleEnEntree, ardCumuleEnSortie, ardConsomme : flux ARD de l'exercice
 *
 * Sources juridiques :
 *   - CGI art. 39 : calcul dotation théorique par composant
 *   - CGI art. 39 B : flux ARD exercice — report sans limite
 *   - BOFIP-BIC-AMT-20-40 : composants BOFIP et durées
 *   - D-FIS-G1.6 : prorata temporis au jour près
 *   - D-FIS-G1.7 : convention allocation proportionnelle (V1 — option utilisateur V1.1)
 *
 * Analog : src/domain/_shared/money.ts (VO multi-méthodes, jamais muté)
 */

import { Money } from '../_shared/money.js';
import type { ComposantId } from '../_shared/identifiants.js';

/**
 * Ligne de dotation par composant (élément du tableau S4).
 *
 * ardGenereComposant = max(0, dotationTheorique - dotationAppliquee)
 * La somme de tous ardGenereComposant + ardConsomme forme ardCumuleEnSortie.
 */
export interface LigneDotationComposant {
  composantId: ComposantId;
  dotationTheorique: Money;
  dotationAppliquee: Money;
  ardGenereComposant: Money;
}

export interface TableauAmortissementExerciceProps {
  exercice: number;
  dotationParComposant: ReadonlyArray<LigneDotationComposant>;
  ardConsomme: Money;
  ardCumuleEnEntree: Money;
  ardCumuleEnSortie: Money;
  dotationAppliqueeTotale: Money;
  dotationTheoriqueTotale: Money;
}

/**
 * VO collection immutable du tableau d'amortissement pour un exercice.
 *
 * Produit par calculerAmortissement (use case pur — Plan 04 Task 1).
 * Rendu par recalculerTableauAmortissement pour l'affichage S4 avant clôture.
 */
export class TableauAmortissementExercice {
  readonly exercice: number;
  readonly dotationParComposant: ReadonlyArray<LigneDotationComposant>;
  readonly ardConsomme: Money;
  readonly ardCumuleEnEntree: Money;
  readonly ardCumuleEnSortie: Money;
  readonly dotationAppliqueeTotale: Money;
  readonly dotationTheoriqueTotale: Money;

  private constructor(props: TableauAmortissementExerciceProps) {
    this.exercice = props.exercice;
    this.dotationParComposant = props.dotationParComposant;
    this.ardConsomme = props.ardConsomme;
    this.ardCumuleEnEntree = props.ardCumuleEnEntree;
    this.ardCumuleEnSortie = props.ardCumuleEnSortie;
    this.dotationAppliqueeTotale = props.dotationAppliqueeTotale;
    this.dotationTheoriqueTotale = props.dotationTheoriqueTotale;
  }

  /**
   * Factory — crée un tableau immutable.
   * dotationParComposant est freezé (ReadonlyArray).
   */
  static creer(props: TableauAmortissementExerciceProps): TableauAmortissementExercice {
    return new TableauAmortissementExercice({
      ...props,
      dotationParComposant: Object.freeze([...props.dotationParComposant]),
    });
  }

  /**
   * Somme des ARD générés par composant sur cet exercice.
   * = Σ ardGenereComposant de chaque ligne.
   * Différent de ardCumuleEnSortie qui inclut le report précédent non consommé.
   *
   * Source : CGI art. 39 B — ARD reportable sans limite.
   */
  ardGenereTotal(): Money {
    return this.dotationParComposant.reduce(
      (acc, ligne) => acc.additionner(ligne.ardGenereComposant),
      Money.zero(),
    );
  }
}
