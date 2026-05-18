import type { Temporal } from '@js-temporal/polyfill';

import type { Clock } from '../../domain/_shared/clock.js';
import type {
  BienId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import type { Money } from '../../domain/_shared/money.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { TicketTravaux } from '../../domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';

export interface CreerTicketTravauxCommande {
  bienId: BienId | string;
  titre: string;
  description: string;
  dateOuverture: Temporal.PlainDate;
  coutEstimeTtc?: Money | null;
  notes?: string | null;
}

export interface CreerTicketTravauxDeps {
  ticketRepo: TicketTravauxRepository;
  bienRepo: BienRepository;
  clock: Clock;
}

export interface CreerTicketTravauxResultat {
  ticketId: TicketTravauxId;
}

/**
 * Use case `creerTicketTravaux` (INC-01 — D-112, D-114).
 *
 * Lookup le Bien (404 si absent) puis crée le TicketTravaux statut='ouvert'.
 * Toutes les invariants (titre/description vides, date future) sont validés
 * dans `TicketTravaux.creer`.
 */
export async function creerTicketTravaux(
  cmd: CreerTicketTravauxCommande,
  deps: CreerTicketTravauxDeps,
): Promise<CreerTicketTravauxResultat> {
  const bien = await deps.bienRepo.trouverParId(cmd.bienId as BienId);
  if (!bien) {
    throw new BienIntrouvable(String(cmd.bienId));
  }
  const today = deps.clock.aujourdhui();
  const ticket = TicketTravaux.creer(
    {
      bienId: bien.id,
      titre: cmd.titre,
      description: cmd.description,
      dateOuverture: cmd.dateOuverture,
      dateCloture: null,
      statut: 'ouvert',
      coutEstimeTtc: cmd.coutEstimeTtc ?? null,
      coutReelTtc: null,
      notes: cmd.notes ?? null,
      creeLe: today,
      annuleLe: null,
      raisonAnnulation: null,
    },
    today,
  );
  await deps.ticketRepo.enregistrer(ticket);
  return { ticketId: ticket.id };
}
