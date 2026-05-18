import type { BienId } from '../../domain/_shared/identifiants.js';
import type {
  StatutTicket,
  TicketTravaux,
} from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface ListerTicketsParBienCommande {
  bienId: BienId | string;
  statuts?: StatutTicket[];
  inclureAnnules?: boolean;
}

export interface ListerTicketsParBienDeps {
  ticketRepo: TicketTravauxRepository;
}

/**
 * Use case `listerTicketsParBien` (UI-5.4 — section "Travaux" fiche Bien).
 *
 * Délègue au repo `listerParBien` avec les options de filtrage par défaut
 * (exclut les annulés sauf inclureAnnules=true).
 */
export async function listerTicketsParBien(
  cmd: ListerTicketsParBienCommande,
  deps: ListerTicketsParBienDeps,
): Promise<TicketTravaux[]> {
  return deps.ticketRepo.listerParBien(cmd.bienId, {
    statuts: cmd.statuts,
    inclureAnnules: cmd.inclureAnnules,
  });
}
