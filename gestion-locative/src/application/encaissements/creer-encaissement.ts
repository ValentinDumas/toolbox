import { Temporal } from '@js-temporal/polyfill';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import { Encaissement, type ModeEncaissement } from '../../domain/encaissements/encaissement.js';
import { Money } from '../../domain/_shared/money.js';
import { EcheanceLoyerIntrouvable, EcheanceAnnulee, BailNonActif } from '../../domain/encaissements/erreurs.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { recalculerStatutEcheance } from './recalculer-statut-echeance.js';
import type { StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { EcheanceLoyerId, EncaissementId } from '../../domain/_shared/identifiants.js';

export interface CreerEncaissementCommande {
  echeanceId: EcheanceLoyerId | string;
  montantCentimesPositifs: bigint;
  signe: 'positif' | 'compensateur';
  date: Temporal.PlainDate;
  mode: ModeEncaissement;
}

export interface CreerEncaissementResultat {
  encaissementId: EncaissementId;
  warnings: string[];
  statut: StatutEcheanceLoyer;
  surPaiement: Money | null;
}

/**
 * Use case : enregistrer un Encaissement (ENC-03, D-57, D-59, D-61).
 *
 * Cross-aggregate : vérifie que l'échéance n'est pas annulée et que le bail est actif.
 * Recalcule automatiquement le statut de l'échéance après persistance.
 * Warnings non-bloquants (D-61) : date antérieure au bail, date trop avancée.
 */
export async function creerEncaissement(
  commande: CreerEncaissementCommande,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  encaissementRepo: EncaissementRepository,
  bailRepo: BailRepository,
  clock: Clock,
): Promise<CreerEncaissementResultat> {
  // Lookup échéance
  const echeance = await echeanceLoyerRepo.trouverParId(commande.echeanceId);
  if (!echeance) {
    throw new EcheanceLoyerIntrouvable(String(commande.echeanceId));
  }

  // Vérifier que l'échéance n'est pas annulée
  if (echeance.annuleLe !== null) {
    throw new EcheanceAnnulee(String(commande.echeanceId));
  }

  // Lookup bail
  const bail = await bailRepo.trouverParId(echeance.bailId);
  if (!bail) {
    throw new BailIntrouvable(echeance.bailId);
  }

  // Vérifier que le bail est actif
  // WR-01 : Bail expose déjà actifDepuis typé — pas de cast nécessaire.
  if (bail.actifDepuis === null) {
    throw new BailNonActif(bail.id);
  }

  // Construire le montant
  const positif = Money.fromCentimes(commande.montantCentimesPositifs);
  const montant = commande.signe === 'compensateur' ? Money.compensateur(positif) : positif;

  // Warnings D-61 (non-bloquants)
  const warnings: string[] = [];
  const today = clock.aujourdhui();
  // WR-01 : Bail expose déjà dateDebut typé — pas de cast nécessaire.
  const bailDateDebut = bail.dateDebut;

  if (Temporal.PlainDate.compare(commande.date, bailDateDebut) < 0) {
    warnings.push('La date de paiement est antérieure à la date de début du bail');
  }

  const dateLimite = today.add({ days: 90 });
  if (Temporal.PlainDate.compare(commande.date, dateLimite) > 0) {
    warnings.push('Cette date semble trop avancée (plus de 90 jours dans le futur)');
  }

  // Créer et persister l'encaissement
  const encaissement = Encaissement.creer({
    echeanceId: commande.echeanceId as EcheanceLoyerId,
    montant,
    date: commande.date,
    mode: commande.mode,
  });
  await encaissementRepo.enregistrer(encaissement);

  // Recalculer le statut de l'échéance
  const { statut, surPaiement } = await recalculerStatutEcheance(
    commande.echeanceId as EcheanceLoyerId,
    echeanceLoyerRepo,
    encaissementRepo,
  );

  return { encaissementId: encaissement.id, warnings, statut, surPaiement };
}
