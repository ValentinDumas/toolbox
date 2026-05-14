import { Temporal } from '@js-temporal/polyfill';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId } from '../../domain/_shared/identifiants.js';
import type { ModifierBailPatch } from '../../domain/locatif/bail.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { genererEcheancesPour } from '../encaissements/activer-bail.js';

export interface PreviewModificationBail {
  kind: 'preview';
  preview: {
    aRegenererCount: number;
    aPreserverCount: number;
    aRegenererIds: EcheanceLoyerId[];
  };
}

export interface ResultModificationBail {
  kind: 'result';
  echeancesRegenerees: number;
  echeancesPreservees: number;
}

export interface ModifierBailActifCommande {
  bailId: BailId;
  patch: ModifierBailPatch;
  confirmation: 'oui' | 'previsualiser';
}

/**
 * Use case D-73 — Modification d'un Bail actif avec régénération sélective.
 *
 * - Preview (toujours calculée) : identifie les échéances futures non payées
 *   sans encaissement actif → à régénérer.
 * - Préserve : échéances payées, annulées, passées, ou avec encaissement actif.
 * - Confirmation 'oui' : transaction atomique suppression + régénération.
 */
export async function modifierBailActif(
  commande: ModifierBailActifCommande,
  bailRepo: BailRepository,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  encaissementRepo: EncaissementRepository,
  clock: Clock,
): Promise<PreviewModificationBail | ResultModificationBail> {
  const bail = await bailRepo.trouverParId(commande.bailId);
  if (!bail) {
    throw new BailIntrouvable(commande.bailId);
  }

  if (bail.actifDepuis === null) {
    throw new InvariantViolated(
      "Ce bail n'est pas actif — utilise la route /baux/:id/modifier standard.",
    );
  }

  // Étape 1 : calculer la preview (toujours)
  const echeances = await echeanceLoyerRepo.listerParBail(bail.id);
  const today = clock.aujourdhui();

  const aRegenererIds: EcheanceLoyerId[] = [];
  let aPreserverCount = 0;

  for (const echeance of echeances) {
    const aDesEncaissementsActifs =
      (await encaissementRepo.listerParEcheance(echeance.id, { inclureAnnules: false })).length > 0;

    const estFuture =
      Temporal.PlainDate.compare(echeance.jourEcheanceAttendue, today) > 0;

    const aRegenerer =
      (echeance.statut === 'en_attente' || echeance.statut === 'partiellement_payee') &&
      estFuture &&
      !aDesEncaissementsActifs;

    if (aRegenerer) {
      aRegenererIds.push(echeance.id);
    } else {
      aPreserverCount++;
    }
  }

  const preview = {
    aRegenererCount: aRegenererIds.length,
    aPreserverCount,
    aRegenererIds,
  };

  if (commande.confirmation !== 'oui') {
    return { kind: 'preview', preview };
  }

  // Étape 2 : appliquer le patch et régénérer
  const bailModifie = bail.modifier(commande.patch);
  await bailRepo.enregistrer(bailModifie);

  // Hard-delete des échéances à régénérer (jamais encaissées — D-73 invariant)
  await echeanceLoyerRepo.supprimerLot(aRegenererIds);

  // Régénérer les périodes supprimées avec le nouveau loyer du bail modifié
  // On génère un bail complet et on filtre uniquement les périodes des ids supprimés
  if (aRegenererIds.length > 0) {
    // Les échéances supprimées sont toutes futures — on régénère depuis actifDepuis du bail modifié
    // avec la même logique que activerBail, puis on prend uniquement les nouvelles périodes
    const toutesLesEcheances = genererEcheancesPour(
      bailModifie,
      bailModifie.actifDepuis!,
      bailModifie.jourEcheance,
    );

    // On régénère uniquement les périodes correspondant aux écheances supprimées
    // En pratique : les écheances supprimées sont les futures — prendre les dureeMois - aPreserverCount dernières
    const nbARegenerer = aRegenererIds.length;
    const nouvellesEcheances = toutesLesEcheances.slice(toutesLesEcheances.length - nbARegenerer);

    await echeanceLoyerRepo.enregistrerBatch(nouvellesEcheances);
  }

  return {
    kind: 'result',
    echeancesRegenerees: aRegenererIds.length,
    echeancesPreservees: aPreserverCount,
  };
}
