/**
 * Use case impure : enregistrer les revenus actifs annuels du foyer.
 *
 * Étapes :
 *   1. Lookup bailleur singleton → throw BailleurAbsent si null.
 *   2. Créer revenusActifs = Money.fromEuros(input).
 *   3. Modifier le bailleur :
 *      - revenusActifsAnnuelsCourant toujours mis à jour.
 *      - fiscalitePremierAcces posé si null (premier accès — D-FIS-G5.4).
 *   4. Enregistrer le bailleur modifié.
 *
 * Sources :
 *   D-FIS-G3.1 — champ revenusActifsAnnuelsCourant sur Bailleur (pré-remplissage wizard clôture).
 *   D-FIS-G5.4 — fiscalitePremierAcces (DateTime?) trace UNIQUEMENT le premier accès.
 *     Les accès subséquents NE modifient PAS fiscalitePremierAcces.
 *   BOFIP-BIC-CHAMP-40-20 — périmètre des revenus actifs du foyer.
 */

import { Temporal } from '@js-temporal/polyfill';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { Money } from '../../domain/_shared/money.js';
import type { Clock } from '../../domain/_shared/clock.js';

export interface SaisirRevenusFoyerCommande {
  /** Revenus actifs annuels du foyer en euros (BOFIP-BIC-CHAMP-40-20). */
  revenusActifsAnnuelsCourantEuros: number;
}

/**
 * Enregistre les revenus actifs annuels du foyer sur le profil bailleur.
 *
 * @param commande - données saisies par l'utilisateur (revenus en euros)
 * @param repos - dépendances injectées (bailleurRepo)
 * @param clock - port Clock pour la trace fiscalitePremierAcces
 *
 * @throws BailleurAbsent si aucun bailleur n'est configuré
 *
 * @see D-FIS-G3.1 — pré-remplissage wizard clôture
 * @see D-FIS-G5.4 — trace premier accès Fiscalité (immuable après le premier set)
 * @see BOFIP-BIC-CHAMP-40-20 — périmètre revenus actifs foyer (inclus/exclus)
 */
export async function saisirRevenusFoyer(
  commande: SaisirRevenusFoyerCommande,
  repos: { bailleurRepo: BailleurRepository },
  clock: Clock,
): Promise<void> {
  // 1. Lookup bailleur singleton
  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) {
    throw new BailleurAbsent();
  }

  // 2. Construire le montant revenus actifs
  const revenusActifs = Money.fromEuros(commande.revenusActifsAnnuelsCourantEuros);

  // 3. Préparer le patch — modification copy-on-write
  const patch: Parameters<typeof bailleur.modifier>[0] = {
    revenusActifsAnnuelsCourant: revenusActifs,
  };

  // fiscalitePremierAcces : posé UNIQUEMENT si c'est le premier accès (D-FIS-G5.4)
  if (bailleur.fiscalitePremierAcces === null) {
    const today = clock.aujourdhui();
    patch.fiscalitePremierAcces = Temporal.PlainDateTime.from(
      `${today.year.toString().padStart(4, '0')}-${today.month.toString().padStart(2, '0')}-${today.day.toString().padStart(2, '0')}T00:00:00`,
    );
  }

  // 4. Modifier (copy-on-write) et enregistrer
  const bailleurModifie = bailleur.modifier(patch);
  await repos.bailleurRepo.enregistrer(bailleurModifie);
}
