import type { Temporal } from '@js-temporal/polyfill';

import type { Clock } from '../../domain/_shared/clock.js';
import type { TicketTravauxId } from '../../domain/_shared/identifiants.js';
import type { Money } from '../../domain/_shared/money.js';
import { TicketIntrouvable } from '../../domain/travaux/erreurs.js';
import type { TicketTravaux } from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface CloreTicketTravauxCommande {
  id: TicketTravauxId | string;
  dateCloture: Temporal.PlainDate;
  coutReelTtc: Money;
}

export interface CloreTicketTravauxDeps {
  ticketRepo: TicketTravauxRepository;
  clock: Clock;
}

/**
 * Use case `cloreTicketTravaux` (D-114 transition ouvert/en_cours → clos).
 *
 * Lookup le ticket (throw TicketIntrouvable si null), appelle `.clore` qui
 * propage TransitionInvalide (depuis 'clos' ou 'annule') ou InvariantViolated
 * (dateCloture < dateOuverture). Upsert.
 */
export async function cloreTicketTravaux(
  cmd: CloreTicketTravauxCommande,
  deps: CloreTicketTravauxDeps,
): Promise<{ ticket: TicketTravaux }> {
  const ticket = await deps.ticketRepo.trouverParId(cmd.id);
  if (!ticket) {
    throw new TicketIntrouvable(String(cmd.id));
  }
  const today = deps.clock.aujourdhui();
  const clos = ticket.clore(cmd.coutReelTtc, cmd.dateCloture, today);
  await deps.ticketRepo.enregistrer(clos);
  return { ticket: clos };
}
