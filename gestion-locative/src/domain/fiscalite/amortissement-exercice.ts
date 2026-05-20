/**
 * VO AmortissementExercice — 1 ligne du read-model matérialisé append-only.
 *
 * Représente soit :
 *   - 1 ligne COMPOSANT (1 par composant actif cet exercice)
 *   - 1 ligne SYNTHESE_BIEN (agrégation par bien + exercice avec ARD cumulé)
 *
 * Le read-model est produit par le use case recalculerTableauAmortissement
 * (pré-affichage lecture-seule) puis persisté définitivement à la clôture
 * par cloturer-exercice (Plan 06).
 *
 * Append-only strict (D-FIS-G1.7) : JAMAIS de UPDATE ni de onConflict.
 * UNIQUE (bien_id, composant_id, exercice) protège contre la double insertion.
 *
 * Sources juridiques :
 *   - CGI art. 39 : dotation théorique / appliquée / plafond résultat
 *   - CGI art. 39 B : ARD cumulé disponible reportable sans limite
 *   - BOFIP-BIC-AMT-20-10 : prorata temporis exercice d'acquisition
 *   - D-FIS-G1.7 : read-model matérialisé — décision Phase 5
 *
 * Analog : src/domain/encaissements/echeance-loyer.ts (snapshot complet)
 */

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauAmortissementExerciceId,
  type AmortissementExerciceId,
  type BienId,
  type ComposantId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';

export type TypeLigneAmortissement = 'COMPOSANT' | 'SYNTHESE_BIEN';

export interface AmortissementExerciceProps {
  id?: AmortissementExerciceId;
  bienId: BienId;
  composantId: ComposantId | null; // null si type_ligne = 'SYNTHESE_BIEN'
  exercice: number;
  typeLigne: TypeLigneAmortissement;
  dotationTheorique: Money;
  dotationAppliquee: Money;
  ardGenere: Money;
  ardCumuleDisponible?: Money | null; // non null si SYNTHESE_BIEN
  ardConsomme?: Money | null;         // non null si SYNTHESE_BIEN
}

/**
 * VO AmortissementExercice (read-model 1 ligne).
 *
 * Immutable — pas de méthode de mutation.
 */
export class AmortissementExercice {
  readonly id: AmortissementExerciceId;
  readonly bienId: BienId;
  readonly composantId: ComposantId | null;
  readonly exercice: number;
  readonly typeLigne: TypeLigneAmortissement;
  readonly dotationTheorique: Money;
  readonly dotationAppliquee: Money;
  readonly ardGenere: Money;
  readonly ardCumuleDisponible: Money | null;
  readonly ardConsomme: Money | null;

  private constructor(id: AmortissementExerciceId, props: Omit<AmortissementExerciceProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.composantId = props.composantId;
    this.exercice = props.exercice;
    this.typeLigne = props.typeLigne;
    this.dotationTheorique = props.dotationTheorique;
    this.dotationAppliquee = props.dotationAppliquee;
    this.ardGenere = props.ardGenere;
    this.ardCumuleDisponible = props.ardCumuleDisponible ?? null;
    this.ardConsomme = props.ardConsomme ?? null;
  }

  /**
   * Factory AmortissementExercice avec validation des invariants.
   *
   * @throws InvariantViolated si les invariants ne sont pas respectés
   */
  static creer(props: AmortissementExerciceProps): AmortissementExercice {
    if (props.exercice <= 0) {
      throw new InvariantViolated(`exercice doit être > 0 (reçu : ${props.exercice})`);
    }

    // SYNTHESE_BIEN : composantId null obligatoire + ardCumuleDisponible non null
    if (props.typeLigne === 'SYNTHESE_BIEN' && props.composantId !== null) {
      throw new InvariantViolated('composantId doit être null pour une ligne SYNTHESE_BIEN (D-FIS-G1.7)');
    }

    // COMPOSANT : composantId obligatoire
    if (props.typeLigne === 'COMPOSANT' && props.composantId === null) {
      throw new InvariantViolated('composantId est obligatoire pour une ligne COMPOSANT (D-FIS-G1.7)');
    }

    const id = props.id ?? nouveauAmortissementExerciceId();
    return new AmortissementExercice(id, {
      bienId: props.bienId,
      composantId: props.composantId,
      exercice: props.exercice,
      typeLigne: props.typeLigne,
      dotationTheorique: props.dotationTheorique,
      dotationAppliquee: props.dotationAppliquee,
      ardGenere: props.ardGenere,
      ardCumuleDisponible: props.ardCumuleDisponible ?? null,
      ardConsomme: props.ardConsomme ?? null,
    });
  }
}
