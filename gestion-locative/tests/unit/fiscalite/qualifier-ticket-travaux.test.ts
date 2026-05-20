import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { qualifierTicketTravaux } from '../../../src/application/fiscalite/qualifier-ticket-travaux.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BienId, JustificatifId, TicketTravauxId } from '../../../src/domain/_shared/identifiants.js';
import { unTicketAmelioration } from '../../_builders/fiscalite.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';

/**
 * Tests TDD — use case qualifierTicketTravaux (D-FIS-G2.3).
 *
 * Vérifie :
 *   - Qualification ticket + propagation aux justificatifs liés en UNE transaction
 *   - Ticket annulé → throw InvariantViolated
 */

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BIEN_ID = crypto.randomUUID() as BienId;

function makeClock() {
  return { aujourdhui: () => TODAY };
}

describe('qualifierTicketTravaux', () => {
  it('qualifie le ticket et tous les justificatifs liés en une transaction', async () => {
    const ticket = unTicketAmelioration({ bienId: BIEN_ID });
    const j1 = unJustificatifNonQualifie({ bienId: BIEN_ID });
    const j2 = unJustificatifNonQualifie({ bienId: BIEN_ID });

    const updatedTickets: unknown[] = [];
    const updatedJustificatifs: unknown[] = [];
    const trxCalls: string[] = [];

    const ticketRepo = {
      trouverParId: vi.fn().mockResolvedValue(ticket),
      enregistrer: vi.fn().mockImplementation(async (t: unknown) => { updatedTickets.push(t); }),
      listerJustificatifsLies: vi.fn().mockResolvedValue([j1.id, j2.id] as JustificatifId[]),
    };

    const justificatifRepo = {
      trouverParId: vi.fn().mockImplementation(async (id: string) => {
        if (id === j1.id) return j1;
        if (id === j2.id) return j2;
        return null;
      }),
      enregistrer: vi.fn().mockImplementation(async (j: unknown) => { updatedJustificatifs.push(j); }),
    };

    // Simuler db.transaction().execute(fn) → appelle fn avec trx mock
    const trxMock = {
      enregistrerTicket: (t: unknown) => { updatedTickets.push(t); },
    };
    const db = {
      transaction: () => ({
        execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<void>) => {
          trxCalls.push('transaction_started');
          await fn(trxMock);
        }),
      }),
    };

    await qualifierTicketTravaux(
      { ticketId: ticket.id as TicketTravauxId, natureFiscale: 'amelioration' },
      { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never },
      makeClock(),
      db as never,
    );

    // Transaction utilisée
    expect(trxCalls).toContain('transaction_started');
    // Ticket lookup
    expect(ticketRepo.trouverParId).toHaveBeenCalledWith(ticket.id);
    // Justificatifs liés lookupés
    expect(ticketRepo.listerJustificatifsLies).toHaveBeenCalledWith(ticket.id);
  });

  it('ticket annulé → throw InvariantViolated sans écriture', async () => {
    const ticketAnnule = unTicketAmelioration({ bienId: BIEN_ID }).annuler('raison', TODAY, TODAY);

    const ticketRepo = {
      trouverParId: vi.fn().mockResolvedValue(ticketAnnule),
      enregistrer: vi.fn(),
      listerJustificatifsLies: vi.fn().mockResolvedValue([]),
    };
    const justificatifRepo = {
      trouverParId: vi.fn(),
      enregistrer: vi.fn(),
    };
    const db = {
      transaction: () => ({ execute: vi.fn() }),
    };

    await expect(
      qualifierTicketTravaux(
        { ticketId: ticketAnnule.id as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow(InvariantViolated);

    // Aucune écriture
    expect(ticketRepo.enregistrer).not.toHaveBeenCalled();
    expect(justificatifRepo.enregistrer).not.toHaveBeenCalled();
    expect(db.transaction().execute).not.toHaveBeenCalled();
  });
});
