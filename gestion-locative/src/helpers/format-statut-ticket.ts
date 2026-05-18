import type { StatutTicket } from '../domain/travaux/ticket-travaux.js';

/**
 * Formate le statut d'un ticket de travaux en libellé français.
 * DP-18 — helper injectable dans les locals EJS via preHandler.
 */
const LABELS_STATUT_TICKET: Record<StatutTicket, string> = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  clos: 'Clos',
  annule: 'Annulé',
};

export function formaterStatutTicket(statut: StatutTicket): string {
  return LABELS_STATUT_TICKET[statut];
}
