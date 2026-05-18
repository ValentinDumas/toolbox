import type {
  JustificatifId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import { TicketIntrouvable } from '../../domain/travaux/erreurs.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface DelierPJTicketCommande {
  ticketId: TicketTravauxId | string;
  justificatifId: JustificatifId | string;
}

export interface DelierPJTicketDeps {
  ticketRepo: TicketTravauxRepository;
}

/**
 * Use case `delierPJTicket` — DELETE row pivot uniquement (D-113 cascade
 * asymétrique : la row dans `justificatifs` reste intacte, rétention 10 ans
 * D-109 prime).
 *
 * Throw TicketIntrouvable si le ticket n'existe pas.
 */
export async function delierPJTicket(
  cmd: DelierPJTicketCommande,
  deps: DelierPJTicketDeps,
): Promise<void> {
  const ticket = await deps.ticketRepo.trouverParId(cmd.ticketId);
  if (!ticket) {
    throw new TicketIntrouvable(String(cmd.ticketId));
  }
  await deps.ticketRepo.delierJustificatif(
    ticket.id,
    cmd.justificatifId as JustificatifId,
  );
}
