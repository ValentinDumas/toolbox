import type {
  BienId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import type { Justificatif } from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { Bien } from '../../domain/patrimoine/bien.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { TicketIntrouvable } from '../../domain/travaux/erreurs.js';
import type { TicketTravaux } from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface LireTicketCommande {
  id: TicketTravauxId | string;
}

export interface LireTicketDeps {
  ticketRepo: TicketTravauxRepository;
  bienRepo: BienRepository;
  justificatifRepo: JustificatifRepository;
}

export interface LireTicketResultat {
  ticket: TicketTravaux;
  bien: Bien | null;
  justificatifs: Justificatif[];
}

/**
 * Use case `lireTicket` (UI-5.3 — fiche ticket).
 *
 * Charge le ticket + le Bien rattaché + les Justificatifs liés (via pivot N:N).
 * Throw TicketIntrouvable si le ticket n'existe pas.
 */
export async function lireTicket(
  cmd: LireTicketCommande,
  deps: LireTicketDeps,
): Promise<LireTicketResultat> {
  const ticket = await deps.ticketRepo.trouverParId(cmd.id);
  if (!ticket) {
    throw new TicketIntrouvable(String(cmd.id));
  }
  const bien = await deps.bienRepo.trouverParId(ticket.bienId as BienId);
  const justificatifIds = await deps.ticketRepo.listerJustificatifsLies(
    ticket.id,
  );
  const justificatifs: Justificatif[] = [];
  for (const jid of justificatifIds) {
    const j = await deps.justificatifRepo.trouverParId(jid);
    if (j && j.corbeilleLe === null) justificatifs.push(j);
  }
  return { ticket, bien, justificatifs };
}
