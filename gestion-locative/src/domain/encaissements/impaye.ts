import { Temporal } from '@js-temporal/polyfill';

import type { EcheanceLoyerId, BailId, LocataireId } from '../_shared/identifiants.js';
import type { Clock } from '../_shared/clock.js';
import { Money } from '../_shared/money.js';
import type { StatutEcheanceLoyer } from './echeance-loyer.js';
import type { EcheanceLoyer } from './echeance-loyer.js';
import type { EcheanceLoyerRepository } from './echeance-loyer-repository.js';
import type { EncaissementRepository } from './encaissement-repository.js';
import type { Locataire } from '../locatif/locataire.js';
import type { Bail } from '../locatif/bail.js';
import type { BailRepository } from '../locatif/bail-repository.js';
import type { LocataireRepository } from '../locatif/locataire-repository.js';

/**
 * DTO de lecture — représente une EcheanceLoyer non entièrement payée.
 * Pas un agrégat persisté — calcul dérivé pur (D-55 : "en_retard" non stocké).
 */
export interface Impaye {
  echeanceId: EcheanceLoyerId;
  bailId: BailId;
  locataireId: LocataireId;
  locataireNomComplet: string;
  periodeDebut: Temporal.PlainDate;
  periodeFin: Temporal.PlainDate;
  jourEcheanceAttendue: Temporal.PlainDate;
  total: Money;
  sommePaiee: Money;
  resteDu: Money;
  statut: StatutEcheanceLoyer;
  joursDeRetard: number;
  estEnRetard: boolean;
}

/**
 * Fonction pure — calcule un Impaye DTO à partir d'une EcheanceLoyer et de ses données agrégées.
 * Testable sans I/O.
 */
export function calculerImpaye(
  echeance: EcheanceLoyer,
  sommePaiee: Money,
  locataire: Locataire,
  bail: Bail,
  today: Temporal.PlainDate,
): Impaye {
  // resteDu : si sur-paiement → 0 (D-59)
  const resteDu = sommePaiee.lte(echeance.total)
    ? echeance.total.soustraire(sommePaiee)
    : Money.zero();

  // estEnRetard : dérivé non stocké (D-55)
  const estEnRetard =
    echeance.statut !== 'payee' &&
    echeance.statut !== 'annulee' &&
    Temporal.PlainDate.compare(today, echeance.jourEcheanceAttendue) > 0;

  // joursDeRetard : 0 si pas en retard
  const joursDeRetard = estEnRetard
    ? Math.floor(
        echeance.jourEcheanceAttendue
          .until(today, { largestUnit: 'day' })
          .total({ unit: 'day' }),
      )
    : 0;

  return {
    echeanceId: echeance.id,
    bailId: bail.id,
    locataireId: locataire.id,
    locataireNomComplet: `${locataire.prenom} ${locataire.nom}`,
    periodeDebut: echeance.periodeDebut,
    periodeFin: echeance.periodeFin,
    jourEcheanceAttendue: echeance.jourEcheanceAttendue,
    total: echeance.total,
    sommePaiee,
    resteDu,
    statut: echeance.statut,
    joursDeRetard,
    estEnRetard,
  };
}

/**
 * Use case — agrège les EcheanceLoyer non payées avec leurs montants encaissés.
 * Filtres optionnels. Tri par jour_echeance_attendue ASC (plus anciens en premier).
 */
export async function listerImpayes(
  filtres: { locataireId?: LocataireId },
  repos: {
    echeanceLoyerRepo: EcheanceLoyerRepository;
    encaissementRepo: EncaissementRepository;
    bailRepo: BailRepository;
    locataireRepo: LocataireRepository;
  },
  clock: Clock,
): Promise<Impaye[]> {
  const today = clock.aujourdhui();

  const echeancesNonPayees = await repos.echeanceLoyerRepo.listerNonPayees();

  // Agrégation en parallèle
  const impayes = await Promise.all(
    echeancesNonPayees.map(async (e) => {
      const bail = await repos.bailRepo.trouverParId(e.bailId);
      if (!bail) return null;

      const locataire = await repos.locataireRepo.trouverParId(bail.locataireId);
      if (!locataire) return null;

      const sommePaiee = await repos.encaissementRepo.sommePaieeParEcheance(e.id);
      return calculerImpaye(e, sommePaiee, locataire, bail, today);
    }),
  );

  // Filtrer les nulls (bail ou locataire introuvable)
  let result = impayes.filter((i): i is Impaye => i !== null);

  // Filtre optionnel par locataire
  if (filtres.locataireId) {
    result = result.filter((i) => i.locataireId === filtres.locataireId);
  }

  // Tri par jour_echeance_attendue ASC
  result.sort((a, b) =>
    Temporal.PlainDate.compare(a.jourEcheanceAttendue, b.jourEcheanceAttendue),
  );

  return result;
}
