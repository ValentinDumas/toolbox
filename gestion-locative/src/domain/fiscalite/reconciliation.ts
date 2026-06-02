/**
 * Fonction pure `reconcilier` — Phase 6 / FIS-05 / Plan 06-03 / D-T6.4 CRITIQUE.
 *
 * Compare la valeur figée d'un snapshot fiscal (DeclarationAnnuelle clôturée)
 * avec la somme des sources vivantes du moment, par identifiant de case cerfa.
 * Retourne un SIGNAL — JAMAIS une valeur corrigée.
 *
 * Le snapshot fait foi (D-T6.4 + anti-patterns Phase 5 §3 + §4) :
 *   - La vue affiche TOUJOURS la valeur du snapshot.
 *   - Si une source vivante a divergé (justificatif modifié, encaissement annulé,
 *     etc.), un bandeau S5 prévient l'utilisateur — il décide s'il rectifie.
 *
 * Fonction pure (aucun import infra/Clock/repo, ne mute pas les Maps en entrée).
 */

import type { Money } from '../_shared/money.js';
import { Money as MoneyClass } from '../_shared/money.js';

export interface EcartReconciliationParCase {
  readonly caseId: string;
  readonly valeurSnapshot: Money;
  readonly valeurVivante: Money;
  /** Écart signé (vivant - snapshot). Positif : vivant > snapshot. */
  readonly ecartCentimes: bigint;
}

export interface ResultatReconciliation {
  readonly cohérent: boolean;
  readonly nbPiecesModifiees: number;
  readonly ecartsParCase: ReadonlyArray<EcartReconciliationParCase>;
}

export function reconcilier(
  snapshot: ReadonlyMap<string, Money>,
  sourcesVivantes: ReadonlyMap<string, Money>,
): ResultatReconciliation {
  const ecarts: EcartReconciliationParCase[] = [];
  for (const [caseId, valeurSnapshot] of snapshot) {
    const valeurVivante = sourcesVivantes.get(caseId) ?? MoneyClass.zero();
    if (!valeurVivante.egale(valeurSnapshot)) {
      ecarts.push({
        caseId,
        valeurSnapshot,
        valeurVivante,
        ecartCentimes: valeurVivante.centimes - valeurSnapshot.centimes,
      });
    }
  }
  return {
    cohérent: ecarts.length === 0,
    nbPiecesModifiees: ecarts.length,
    ecartsParCase: ecarts,
  };
}
