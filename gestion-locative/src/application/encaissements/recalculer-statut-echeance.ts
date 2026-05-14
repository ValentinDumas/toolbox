import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import { Money } from '../../domain/_shared/money.js';
import type { EcheanceLoyerId } from '../../domain/_shared/identifiants.js';

export interface ResultatRecalcul {
  statut: StatutEcheanceLoyer;
  sommePaiee: Money;
  surPaiement: Money | null;
}

/**
 * Use case interne : recalcule et persiste le statut d'une EcheanceLoyer.
 *
 * Algorithme :
 *   - somme = sommePaieeParEcheance (encaissements actifs, compensateurs inclus)
 *   - si somme <= 0 → en_attente
 *   - si 0 < somme < total → partiellement_payee
 *   - si somme == total → payee
 *   - si somme > total → payee + surPaiement = somme - total (D-59)
 *
 * NOTE : somme peut être négative si compensateurs > paiements (cas hypothétique).
 * Dans ce cas on traite comme en_attente.
 */
export async function recalculerStatutEcheance(
  echeanceId: EcheanceLoyerId | string,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  encaissementRepo: EncaissementRepository,
): Promise<ResultatRecalcul> {
  const [sommePaiee, echeance] = await Promise.all([
    encaissementRepo.sommePaieeParEcheance(echeanceId as EcheanceLoyerId),
    echeanceLoyerRepo.trouverParId(echeanceId),
  ]);

  if (!echeance) {
    throw new Error(`Échéance introuvable : ${echeanceId}`);
  }

  const total = echeance.total;

  let statut: StatutEcheanceLoyer;
  let surPaiement: Money | null = null;

  if (sommePaiee.estNegatif() || sommePaiee.egale(Money.zero())) {
    // somme <= 0 → en_attente
    statut = 'en_attente';
  } else if (sommePaiee.lt(total)) {
    statut = 'partiellement_payee';
  } else if (sommePaiee.egale(total)) {
    statut = 'payee';
  } else {
    // somme > total → payee + sur-paiement
    statut = 'payee';
    surPaiement = sommePaiee.soustraire(total);
  }

  await echeanceLoyerRepo.mettreAJourStatut(echeanceId as EcheanceLoyerId, statut);

  return { statut, sommePaiee, surPaiement };
}
