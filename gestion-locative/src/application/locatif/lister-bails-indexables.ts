import { Temporal } from '@js-temporal/polyfill';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';

/**
 * Use case read-only : liste les bails dont l'anniversaire de révision IRL est atteint
 * (D-90, LOC-04 partie simulation).
 *
 * Critère 03-03 : bail actif (actifDepuis non null) ET today >= dateAnniversaire précédent
 *  — c'est-à-dire today >= dateAnniversaireProchaine(today).subtract({ years: 1 }).
 *
 * LIMITATION 03-03 : ne filtre PAS par "dernière indexation < 12 mois" (le BailIndexation
 * append-only sera créé en 03-04). En 03-04 : étendre pour appeler
 * `bailIndexationRepo.dernierePourBail(bail.id)` et exclure si récente.
 *
 * Consommé par : route GET /baux/:id (banner), 03-04 (apply), 03-05 (UI polish),
 * Phase 7 (dashboard cross-Bien).
 */
export async function listerBailsIndexables(
  repos: {
    bailRepo: BailRepository;
    /** Optional Phase 3-04 : exclut les bails déjà indexés dans les 12 derniers mois. */
    bailIndexationRepo?: BailIndexationRepository;
  },
  clock: Clock,
): Promise<BailId[]> {
  const today = clock.aujourdhui();
  const bails = await repos.bailRepo.listerTous();

  const candidats = bails
    .filter((b) => b.actifDepuis !== null)
    .filter((b) => {
      const premierAnniversaire = b.dateDebut.add({ years: 1 });
      return Temporal.PlainDate.compare(today, premierAnniversaire) >= 0;
    });

  if (!repos.bailIndexationRepo) {
    return candidats.map((b) => b.id);
  }

  const seuilDouze = today.subtract({ months: 12 });
  const indexables: BailId[] = [];
  for (const b of candidats) {
    const derniere = await repos.bailIndexationRepo.dernierePourBail(b.id);
    if (derniere && Temporal.PlainDate.compare(derniere.dateEffet, seuilDouze) > 0) {
      continue;
    }
    indexables.push(b.id);
  }
  return indexables;
}
