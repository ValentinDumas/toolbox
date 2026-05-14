import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import { EncaissementIntrouvable } from '../../domain/encaissements/erreurs.js';
import { recalculerStatutEcheance } from './recalculer-statut-echeance.js';
import type { StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { EncaissementId } from '../../domain/_shared/identifiants.js';

export interface AnnulerEncaissementCommande {
  id: EncaissementId | string;
  raison: string;
}

export interface AnnulerEncaissementResultat {
  ancienStatut: StatutEcheanceLoyer;
  nouveauStatut: StatutEcheanceLoyer;
  rebasculee: boolean;
}

/**
 * Use case : annuler un Encaissement (D-60 soft-delete).
 *
 * - Lookup l'encaissement (throw EncaissementIntrouvable si absent).
 * - Lookup l'échéance pour l'ancien statut.
 * - Appelle encaissement.annuler() (throw si déjà annulé — InvariantViolated).
 * - Persiste (upsert).
 * - Recalcule le statut de l'échéance.
 * - Retourne ancienStatut, nouveauStatut, rebasculee (true si statut changé).
 */
export async function annulerEncaissement(
  commande: AnnulerEncaissementCommande,
  encaissementRepo: EncaissementRepository,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  clock: Clock,
): Promise<AnnulerEncaissementResultat> {
  const encaissement = await encaissementRepo.trouverParId(commande.id as EncaissementId);
  if (!encaissement) {
    throw new EncaissementIntrouvable(String(commande.id));
  }

  const echeance = await echeanceLoyerRepo.trouverParId(encaissement.echeanceId);
  const ancienStatut: StatutEcheanceLoyer = echeance?.statut ?? 'en_attente';

  // Appliquer soft-delete (throw InvariantViolated si déjà annulé)
  const encaissementAnnule = encaissement.annuler(commande.raison, clock.aujourdhui());
  await encaissementRepo.enregistrer(encaissementAnnule);

  // Recalculer le statut
  const { statut: nouveauStatut } = await recalculerStatutEcheance(
    encaissement.echeanceId,
    echeanceLoyerRepo,
    encaissementRepo,
  );

  return {
    ancienStatut,
    nouveauStatut,
    rebasculee: ancienStatut !== nouveauStatut,
  };
}
