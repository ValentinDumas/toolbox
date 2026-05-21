/**
 * Use case — qualifier un TicketTravaux entier + propagation aux Justificatifs liés.
 *
 * RETROFIT Plan 06 D-FIS-G2.5 : vérification figée AVANT toute écriture.
 * Si DeclarationAnnuelle existe pour l'exercice du ticket → throw DeclarationFigeeException.
 *
 * "Un ensemble de travaux concourant à une même opération se qualifie comme un tout" — BOFIP.
 *
 * Atomicité garantie par transaction Kysely (D-FIS-G2.3 + T-05-02-02).
 *
 * Sources juridiques :
 *   - D-FIS-G2.3 : qualification ticket = tout (atomique)
 *   - D-FIS-G2.5 : exercice clôturé → qualification gelée (retrofit Plan 06)
 *   - T-05-06-10 : Qualification post-clôture contournement — mitigé par ce check
 */

import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { TicketTravauxId, JustificatifId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { DeclarationFigeeException } from '../../domain/fiscalite/erreurs.js';

export interface QualifierTicketCommande {
  ticketId: TicketTravauxId;
  natureFiscale: QualificationFiscale;
}

interface Repos {
  ticketRepo: Pick<TicketTravauxRepository, 'trouverParId' | 'enregistrer' | 'listerJustificatifsLies'>;
  justificatifRepo: Pick<JustificatifRepository, 'trouverParId' | 'enregistrer'>;
  bailleurRepo: Pick<BailleurRepository, 'trouver'>;
  declRepo: Pick<DeclarationAnnuelleRepository, 'trouverParBailleurExercice'>;
}

/** Minimal abstraction d'un fournisseur de transaction (hexagonal — pas d'import infra). */
interface TransactionProvider {
  transaction(): { execute(fn: (trx: unknown) => Promise<void>): Promise<void> };
}

/**
 * Use case — qualifier un TicketTravaux entier + propagation aux Justificatifs liés (D-FIS-G2.3).
 *
 * Plan 06 retrofit D-FIS-G2.5 : vérification figée AVANT écriture.
 * L'exercice du ticket = dateCloture?.year ?? clock.aujourdhui().year.
 *
 * @throws Error si ticket introuvable
 * @throws BailleurAbsent si bailleur non configuré
 * @throws DeclarationFigeeException si exercice clôturé (D-FIS-G2.5)
 */
export async function qualifierTicketTravaux(
  cmd: QualifierTicketCommande,
  repos: Repos,
  clock: Clock,
  db: TransactionProvider,
): Promise<void> {
  const today = clock.aujourdhui();

  // 0. Lookup bailleur + figée check D-FIS-G2.5 (RETROFIT Plan 06)
  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) {
    throw new BailleurAbsent();
  }

  // 1. Lookup ticket (avant figée check pour obtenir l'exercice du ticket)
  const ticket = await repos.ticketRepo.trouverParId(cmd.ticketId);
  if (!ticket) {
    throw new Error(`Ticket introuvable : ${cmd.ticketId}`);
  }

  // Exercice du ticket = dateCloture.year si clôturé, sinon année courante
  const exercice = ticket.dateCloture?.year ?? today.year;

  // Figée check D-FIS-G2.5 : exercice déjà clôturé → qualification gelée
  const declExistante = await repos.declRepo.trouverParBailleurExercice(bailleur.id, exercice);
  if (declExistante !== null) {
    throw new DeclarationFigeeException();
  }

  // 2. Qualifier le ticket (domaine — throw si annulé, qualification invalide)
  const ticketQualifie = ticket.qualifier(cmd.natureFiscale, today, today);

  // 3. Lookup justificatifs liés
  const justificatifIds = await repos.ticketRepo.listerJustificatifsLies(cmd.ticketId);

  const justificatifs: Justificatif[] = [];
  for (const jId of justificatifIds as JustificatifId[]) {
    const j = await repos.justificatifRepo.trouverParId(jId);
    if (j !== null) {
      justificatifs.push(j);
    }
  }

  // 4. Transaction atomique : ticket + N justificatifs qualifiés
  await db.transaction().execute(async (trx) => {
    await repos.ticketRepo.enregistrer(ticketQualifie, trx);
    for (const j of justificatifs) {
      const jQualifie = j.qualifier(cmd.natureFiscale, today);
      await repos.justificatifRepo.enregistrer(jQualifie, trx);
    }
  });
}
