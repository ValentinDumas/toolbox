import { Temporal } from '@js-temporal/polyfill';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BailId } from '../../domain/_shared/identifiants.js';

export interface ActiverBailCommande {
  bailId: BailId;
  actifDepuis: Temporal.PlainDate;
  jourEcheance: number;
}

export interface ActiverBailResultat {
  echeancesCreees: number;
  warnings: string[];
}

/**
 * Use case : activer un Bail brouillon.
 *
 * - Valide que le bail existe et n'est pas déjà actif.
 * - Active le bail (actifDepuis, jourEcheance).
 * - Génère N = bail.dureeMois EcheanceLoyer en calculant le prorata
 *   pour la 1ère et la dernière échéance si actifDepuis.day != 1.
 * - Warning D-72 si actifDepuis < today - 2 ans.
 * - Persiste les N échéances en batch transactionnel.
 */
export async function activerBail(
  commande: ActiverBailCommande,
  bailRepo: BailRepository,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  clock: Clock,
): Promise<ActiverBailResultat> {
  const bail = await bailRepo.trouverParId(commande.bailId);
  if (!bail) {
    throw new BailIntrouvable(commande.bailId);
  }

  if (bail.actifDepuis !== null) {
    throw new InvariantViolated('Ce bail est déjà activé');
  }

  // Activer le bail (méthode copy-on-write avec validation jourEcheance D-53)
  const bailActif = bail.activer(commande.actifDepuis, commande.jourEcheance);
  await bailRepo.enregistrer(bailActif);

  const warnings: string[] = [];

  // D-72 : warning si activation > 2 ans en arrière
  const deuxAnsAvant = clock.aujourdhui().subtract({ years: 2 });
  if (Temporal.PlainDate.compare(commande.actifDepuis, deuxAnsAvant) < 0) {
    warnings.push(
      'Activation rétrospective : plus de 2 ans en arrière. Vérifie les exercices fiscaux concernés.',
    );
  }

  // Générer les N échéances
  const echeances = genererEcheancesPour(bail, commande.actifDepuis, commande.jourEcheance);

  await echeanceLoyerRepo.enregistrerBatch(echeances);

  return { echeancesCreees: echeances.length, warnings };
}

/**
 * Génère les N = dureeMois EcheanceLoyer pour un bail.
 * Helper réutilisable par activerBail et modifierBailActif (D-73).
 *
 * Algorithme : itération mois par mois à partir de actifDepuis.
 *
 * - Période 0 (i=0) : commence le actifDepuis.
 *   Si actifDepuis.day != 1 → prorata sur joursRestants/daysInMonth.
 *   Sinon → mois plein.
 *
 * - Périodes intermédiaires (i=1 à N-2) : début = 1er du mois, mois plein.
 *   La date de début pour le mois i = actifDepuis.with({day:1}).add({months: i})
 *   (mais si actifDepuis.day != 1, le mois i=1 commence le mois suivant le mois partiel).
 *
 * - Période N-1 (dernière) : date de fin inclusive = actifDepuis.add({months: N}) - 1 jour.
 *   Si ce jour n'est pas le dernier du mois → prorata sur jourFin.day/daysInMonth.
 *   Sinon → mois plein.
 *
 * Note : si actifDepuis.day == 1, le numéro du mois calendaire est identique pour
 * toutes les périodes (i=0 → mois 0, i=1 → mois 1, etc.).
 * Si actifDepuis.day != 1, la période i=0 couvre la fin du mois 0, et les périodes
 * i=1..N-1 couvrent les mois 1..N-1. La "dernière" période (i=N-1) couvre alors
 * partiellement le mois N-1 (de actifDepuis) = mois actifDepuis.month + N - 1.
 */
export function genererEcheancesPour(
  bail: { id: string; dureeMois: number; loyerHc: import('../../domain/_shared/money.js').Money; montantCharges: import('../../domain/_shared/money.js').Money; modeCharges: 'forfait' | 'provisions'; bienId: string; locataireId: string },
  actifDepuis: Temporal.PlainDate,
  jourEcheance: number,
): EcheanceLoyer[] {
  const { dureeMois, loyerHc, montantCharges, modeCharges } = bail;
  const bailId = bail.id as import('../../domain/_shared/identifiants.js').BailId;

  const echeances: EcheanceLoyer[] = [];

  // Date de fin inclusive = actifDepuis + dureeMois mois - 1 jour
  // Ex : actifDepuis=2026-02-15, dureeMois=12 → 2027-02-15 - 1 = 2027-02-14
  const dateFinInclusive = actifDepuis.add({ months: dureeMois }).subtract({ days: 1 });

  for (let i = 0; i < dureeMois; i++) {
    let periodeDebut: Temporal.PlainDate;
    let periodeFin: Temporal.PlainDate;
    let loyerPeriode: import('../../domain/_shared/money.js').Money;
    let chargesPeriode: import('../../domain/_shared/money.js').Money;

    if (i === 0) {
      // Première période : commence le actifDepuis
      periodeDebut = actifDepuis;

      if (actifDepuis.day === 1 && i === dureeMois - 1) {
        // Bail d'1 mois entier commençant le 1er
        periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
        loyerPeriode = loyerHc;
        chargesPeriode = montantCharges;
      } else if (actifDepuis.day === 1) {
        // 1er du mois → mois plein (mais on vérifie si c'est aussi le dernier mois plus tard)
        periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
        loyerPeriode = loyerHc;
        chargesPeriode = montantCharges;
      } else {
        // Milieu de mois → prorata 1ère période
        periodeFin = actifDepuis.with({ day: actifDepuis.daysInMonth });
        const joursInMois = BigInt(actifDepuis.daysInMonth);
        const joursOccupes = joursInMois - BigInt(actifDepuis.day) + 1n;
        loyerPeriode = loyerHc.multiplyByFraction(joursOccupes, joursInMois);
        chargesPeriode = montantCharges.multiplyByFraction(joursOccupes, joursInMois);
      }
    } else if (i === dureeMois - 1) {
      // Dernière période : se termine le dateFinInclusive
      // Début = 1er du mois de dateFinInclusive
      periodeDebut = dateFinInclusive.with({ day: 1 });
      periodeFin = dateFinInclusive;

      const joursInMois = BigInt(dateFinInclusive.daysInMonth);
      const jourFin = BigInt(dateFinInclusive.day);

      if (jourFin === joursInMois) {
        // Dernier jour du mois → mois plein
        loyerPeriode = loyerHc;
        chargesPeriode = montantCharges;
      } else {
        // Prorata dernière période : du 1er au dateFinInclusive.day
        loyerPeriode = loyerHc.multiplyByFraction(jourFin, joursInMois);
        chargesPeriode = montantCharges.multiplyByFraction(jourFin, joursInMois);
      }
    } else {
      // Périodes intermédiaires : mois pleins
      // Le mois i commence exactement i mois après le 1er du mois de actifDepuis
      const debutMoisRef = actifDepuis.with({ day: 1 });
      const debutMois = debutMoisRef.add({ months: i });
      periodeDebut = debutMois;
      periodeFin = debutMois.with({ day: debutMois.daysInMonth });
      loyerPeriode = loyerHc;
      chargesPeriode = montantCharges;
    }

    const totalPeriode = loyerPeriode.additionner(chargesPeriode);

    echeances.push(EcheanceLoyer.creer({
      bailId,
      periodeDebut,
      periodeFin,
      jourEcheanceAttendue: calculerJourEcheance(periodeDebut, jourEcheance),
      loyerHc: loyerPeriode,
      montantCharges: chargesPeriode,
      modeCharges,
      total: totalPeriode,
      statut: 'en_attente',
      annuleLe: null,
    }));
  }

  return echeances;
}

/**
 * Calcule la date de l'échéance attendue dans le mois de periodeDebut.
 * Si jourEcheance > periodeDebut.daysInMonth → clamp au dernier jour du mois.
 */
function calculerJourEcheance(periodeDebut: Temporal.PlainDate, jourEcheance: number): Temporal.PlainDate {
  const jourEffectif = Math.min(jourEcheance, periodeDebut.daysInMonth);
  return periodeDebut.with({ day: jourEffectif });
}
