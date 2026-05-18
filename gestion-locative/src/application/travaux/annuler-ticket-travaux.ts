import type { Clock } from '../../domain/_shared/clock.js';
import type { TicketTravauxId } from '../../domain/_shared/identifiants.js';
import { TicketIntrouvable } from '../../domain/travaux/erreurs.js';
import type { TicketTravaux } from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface AnnulerTicketTravauxCommande {
  id: TicketTravauxId | string;
  raison: string;
}

export interface AnnulerTicketTravauxDeps {
  ticketRepo: TicketTravauxRepository;
  clock: Clock;
}

/**
 * Use case `annulerTicketTravaux` (D-114 — soft-delete via annule_le).
 *
 * Lookup le ticket, appelle `.annuler` (propage TicketDejaAnnule si déjà
 * annulé), upsert. annule_le et raison_annulation persistés en base.
 */
export async function annulerTicketTravaux(
  cmd: AnnulerTicketTravauxCommande,
  deps: AnnulerTicketTravauxDeps,
): Promise<{ ticket: TicketTravaux }> {
  const ticket = await deps.ticketRepo.trouverParId(cmd.id);
  if (!ticket) {
    throw new TicketIntrouvable(String(cmd.id));
  }
  const today = deps.clock.aujourdhui();
  const annule = ticket.annuler(cmd.raison, today, today);
  await deps.ticketRepo.enregistrer(annule);
  return { ticket: annule };
}
