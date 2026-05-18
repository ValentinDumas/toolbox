import type {
  BienId,
  JustificatifId,
  TicketTravauxId,
} from '../_shared/identifiants.js';

import type { StatutTicket, TicketTravaux } from './ticket-travaux.js';

/**
 * Port repository TicketTravaux (D-112).
 *
 * Pas de méthode `supprimer` — annulation = soft-delete via `annule_le`.
 *
 * Méthodes N:N (D-113) :
 *   - `lierJustificatif` / `delierJustificatif` / `listerJustificatifsLies`.
 *   - Le pivot `ticket_justificatifs` a CASCADE asymétrique (D-113) :
 *     DELETE ticket → DELETE rows pivot ; DELETE justificatif jamais (rétention 10 ans D-109).
 */
export interface TicketTravauxRepository {
  enregistrer(ticket: TicketTravaux, trx?: unknown): Promise<void>;

  trouverParId(
    id: TicketTravauxId | string,
  ): Promise<TicketTravaux | null>;

  /**
   * Lister les tickets d'un Bien.
   *
   * - Par défaut, exclut les tickets annulés (annule_le NOT NULL).
   * - `inclureAnnules=true` retourne tous les tickets.
   * - `statuts` filtre par statuts spécifiques (ex: ['ouvert', 'en_cours']
   *   pour la section "Travaux" sur la fiche Bien).
   */
  listerParBien(
    bienId: BienId | string,
    opts?: { inclureAnnules?: boolean; statuts?: StatutTicket[] },
  ): Promise<TicketTravaux[]>;

  // ─── N:N pivot ticket_justificatifs (D-113) ────────────────────────────────

  /**
   * Lier un Justificatif à un Ticket. Idempotent (onConflict.doNothing) —
   * deuxième appel sur même paire ne duplique pas la ligne.
   */
  lierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trx?: unknown,
  ): Promise<void>;

  /**
   * Délier un Justificatif d'un Ticket. DELETE pivot uniquement —
   * la row `justificatifs` reste intacte (D-113 cascade asymétrique).
   */
  delierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trx?: unknown,
  ): Promise<void>;

  /**
   * Lister les IDs des Justificatifs liés à un Ticket.
   * Triés par `date_document DESC` (les plus récents en premier).
   */
  listerJustificatifsLies(
    ticketId: TicketTravauxId | string,
  ): Promise<JustificatifId[]>;
}
