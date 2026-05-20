/**
 * Port RegleFiscaleProvider — injection versionnable des règles fiscales par année.
 *
 * Pattern : analog exact à src/domain/_shared/clock.ts (port d'injection sans état).
 * L'interface est dans le domaine, l'implémentation par défaut y est aussi
 * (pas de dépendance infra — données purement en mémoire).
 *
 * Evolution : à la révision triennale 2028, créer regles-2029.ts et
 * ajouter l'entrée dans RegleFiscaleProviderEnMemoire.
 * Aucun use case n'a besoin d'être modifié — le port est la frontière.
 */

import { REGLES_2026, type RegleFiscale2026 } from './regles-2026.js';
import { RegleFiscaleAbsente } from '../erreurs.js';

/**
 * Port domaine RegleFiscaleProvider.
 * Exposé par injection dans tous les use cases qui calculent des montants fiscaux.
 * Signature : regleFiscale.pour(annee) — fail-fast si année hors plage.
 */
export interface RegleFiscaleProvider {
  /**
   * Retourne les règles fiscales pour une année donnée.
   * @throws {RegleFiscaleAbsente} si l'année n'est pas couverte par une révision triennale connue.
   */
  pour(annee: number): RegleFiscale2026;
}

/**
 * Implémentation par défaut — données en mémoire (révision triennale 2026-2028).
 *
 * Plage couverte : 2026, 2027, 2028 → REGLES_2026 (seuil micro-BIC 83 600 €).
 * Source : BOFIP-BIC-50-0 — révision triennale 2026-2028 confirmée.
 *
 * Note : BOFIP-BIC-DECLA-10-30 — option régime réel renouvelable tacitement 1 an.
 * La révision triennale du seuil micro-BIC n'affecte pas la logique de renouvellement.
 *
 * @see https://www.monmeublesaisonnier.com/blog/micro-bic-lmnp-seuils-abattements-fiscal
 */
export class RegleFiscaleProviderEnMemoire implements RegleFiscaleProvider {
  private readonly _regles: Map<number, RegleFiscale2026>;

  constructor() {
    this._regles = new Map<number, RegleFiscale2026>([
      [2026, REGLES_2026],
      [2027, REGLES_2026], // même révision triennale 2026-2028
      [2028, REGLES_2026], // même révision triennale 2026-2028
    ]);
  }

  /**
   * Retourne les règles fiscales pour l'année demandée.
   * @throws {RegleFiscaleAbsente} si l'année est hors plage versionnée (< 2026 ou > 2028).
   * Note JSDoc : "à étendre avec regles-2029.ts à la révision triennale fin 2028."
   */
  pour(annee: number): RegleFiscale2026 {
    const regles = this._regles.get(annee);
    if (!regles) {
      throw new RegleFiscaleAbsente(annee);
    }
    return regles;
  }
}
