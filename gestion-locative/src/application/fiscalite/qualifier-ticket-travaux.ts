import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { TicketTravauxId, JustificatifId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';

export interface QualifierTicketCommande {
  ticketId: TicketTravauxId;
  natureFiscale: QualificationFiscale;
}

interface Repos {
  ticketRepo: Pick<TicketTravauxRepository, 'trouverParId' | 'enregistrer' | 'listerJustificatifsLies'>;
  justificatifRepo: Pick<JustificatifRepository, 'trouverParId' | 'enregistrer'>;
}

/** Minimal abstraction d'un fournisseur de transaction (hexagonal — pas d'import infra). */
interface TransactionProvider {
  transaction(): { execute(fn: (trx: unknown) => Promise<void>): Promise<void> };
}

/**
 * Use case — qualifier un TicketTravaux entier + propagation aux Justificatifs liés (D-FIS-G2.3).
 *
 * "Un ensemble de travaux concourant à une même opération se qualifie comme un tout" — BOFIP.
 *
 * Atomicité garantie par transaction Kysely (D-FIS-G2.3 + T-05-02-02).
 *
 * Stub Plan 02 — Plan 06 ajoutera : vérification DeclarationAnnuelle non clôturée (D-FIS-G2.5).
 * // TODO Plan 06 : vérifier que DeclarationAnnuelle de l'exercice n'est pas clôturée
 */
export async function qualifierTicketTravaux(
  cmd: QualifierTicketCommande,
  repos: Repos,
  clock: Clock,
  db: TransactionProvider,
): Promise<void> {
  const today = clock.aujourdhui();

  // 1. Lookup ticket
  const ticket = await repos.ticketRepo.trouverParId(cmd.ticketId);
  if (!ticket) {
    throw new Error(`Ticket introuvable : ${cmd.ticketId}`);
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
