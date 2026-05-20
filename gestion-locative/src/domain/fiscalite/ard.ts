/**
 * VO ARD — Amortissement Réputé Différé.
 *
 * L'ARD naît quand la dotation théorique d'amortissement dépasse le plafond
 * autorisé (résultat avant amortissement — CGI art. 39). Il est reportable
 * sans limite de durée (CGI art. 39 B) et consommé en priorité absolue
 * sur les exercices futurs avant toute nouvelle dotation.
 *
 * Pattern : VO immutable avec factory creer() + méthode pure consommer().
 * Analog : src/domain/_shared/money.ts (VO multi-méthodes, jamais muté).
 *
 * Sources juridiques :
 *   - CGI art. 39 : plafond résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite de durée
 *   - BOFIP-BIC-AMT-20-10 : prorata temporis et traitement ARD exercice de sortie
 *   - D-FIS-G1.7 : read-model matérialisé AmortissementExercice
 */

import { InvariantViolated } from '../_shared/erreurs.js';
import { Money } from '../_shared/money.js';

/**
 * VO ARD (Amortissement Réputé Différé).
 *
 * Immutable — consommer() retourne un nouvel ARD + Money consommé.
 * Tracé pour audit-trail (SIM-02 V1.1) via exerciceGeneration.
 *
 * Invariants :
 *   - montant >= 0 (Money refuse les négatifs)
 *   - exerciceGeneration > 0 (exercice fiscal valide)
 */
export class ARD {
  readonly montant: Money;
  readonly exerciceGeneration: number;

  private constructor(montant: Money, exerciceGeneration: number) {
    this.montant = montant;
    this.exerciceGeneration = exerciceGeneration;
  }

  /**
   * Factory ARD — valide les invariants.
   *
   * @param montant - montant ARD (>= 0, Money refuse les négatifs)
   * @param exerciceGeneration - exercice fiscal de génération (> 0)
   * @throws InvariantViolated si exerciceGeneration <= 0
   */
  static creer(montant: Money, exerciceGeneration: number): ARD {
    if (exerciceGeneration <= 0) {
      throw new InvariantViolated(
        `exerciceGeneration doit être > 0 (reçu : ${exerciceGeneration}) — CGI art. 39 B`,
      );
    }
    return new ARD(montant, exerciceGeneration);
  }

  /**
   * Consomme une partie de cet ARD (immutable).
   *
   * Priorité absolue de consommation ARD avant nouvelle dotation (CGI art. 39 B).
   * L'exerciceGeneration est conservé sur le reste pour la traçabilité.
   *
   * @param montantConsomme - montant à imputer sur cet ARD
   * @returns { reste: ARD, consomme: Money } — reste inchangé si montantConsomme = 0
   * @throws InvariantViolated si montantConsomme > this.montant (soustraction négative)
   */
  consommer(montantConsomme: Money): { reste: ARD; consomme: Money } {
    const resteVal = this.montant.soustraire(montantConsomme); // throw si négatif
    return {
      reste: new ARD(resteVal, this.exerciceGeneration),
      consomme: montantConsomme,
    };
  }
}
