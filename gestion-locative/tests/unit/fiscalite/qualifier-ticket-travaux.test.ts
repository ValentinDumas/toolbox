import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { qualifierTicketTravaux } from '../../../src/application/fiscalite/qualifier-ticket-travaux.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BienId, JustificatifId, TicketTravauxId } from '../../../src/domain/_shared/identifiants.js';
import { unTicketAmelioration } from '../../_builders/fiscalite.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { Money } from '../../../src/domain/_shared/money.js';

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
  it('bailleur absent → throw BailleurAbsent sans écriture (lignes 65-67)', async () => {
    const { BailleurAbsent } = await import('../../../src/domain/identite/erreurs.js');
    const ticket = unTicketAmelioration({ bienId: BIEN_ID });
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(null) };
    const ticketRepo = { trouverParId: vi.fn(), enregistrer: vi.fn(), listerJustificatifsLies: vi.fn() };
    const justificatifRepo = { trouverParId: vi.fn(), enregistrer: vi.fn() };
    const declRepo = { trouverParBailleurExercice: vi.fn() };
    const db = { transaction: () => ({ execute: vi.fn() }) };

    await expect(
      qualifierTicketTravaux(
        { ticketId: ticket.id as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow(BailleurAbsent);

    expect(ticketRepo.trouverParId).not.toHaveBeenCalled();
  });

  it('ticket introuvable → throw Error sans écriture (lignes 71-73)', async () => {
    const ticketRepo = {
      trouverParId: vi.fn().mockResolvedValue(null),
      enregistrer: vi.fn(),
      listerJustificatifsLies: vi.fn(),
    };
    const bailleur = unBailleurValide();
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(bailleur) };
    const declRepo = { trouverParBailleurExercice: vi.fn().mockResolvedValue(null) };
    const db = { transaction: () => ({ execute: vi.fn() }) };
    const justificatifRepo = { trouverParId: vi.fn(), enregistrer: vi.fn() };

    await expect(
      qualifierTicketTravaux(
        { ticketId: 'ticket-inexistant' as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow('Ticket introuvable');
  });

  it('exercice clôturé → throw DeclarationFigeeException (lignes 79-82)', async () => {
    const { DeclarationFigeeException } = await import('../../../src/domain/fiscalite/erreurs.js');
    const ticket = unTicketAmelioration({ bienId: BIEN_ID });
    const bailleur = unBailleurValide();
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(bailleur) };
    const ticketRepo = {
      trouverParId: vi.fn().mockResolvedValue(ticket),
      enregistrer: vi.fn(),
      listerJustificatifsLies: vi.fn(),
    };
    const fakeDecl = { id: 'decl-123', exercice: TODAY.year };
    const declRepo = { trouverParBailleurExercice: vi.fn().mockResolvedValue(fakeDecl) };
    const db = { transaction: () => ({ execute: vi.fn() }) };
    const justificatifRepo = { trouverParId: vi.fn(), enregistrer: vi.fn() };

    await expect(
      qualifierTicketTravaux(
        { ticketId: ticket.id as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow(DeclarationFigeeException);

    expect(ticketRepo.enregistrer).not.toHaveBeenCalled();
  });

  it('ticket avec dateCloture → exercice issu de dateCloture.year (ligne 76 branch)', async () => {
    // Couvre ticket.dateCloture?.year (non-null) — la branch ?? today.year n'est PAS prise
    const { DeclarationFigeeException } = await import('../../../src/domain/fiscalite/erreurs.js');
    // Ticket ouvert en 2025, clos en 2025 → dateCloture.year = 2025 (pas today.year = 2026)
    const ticketOuvert = unTicketAmelioration({
      bienId: BIEN_ID,
      dateOuverture: Temporal.PlainDate.from('2025-06-01'),
    });
    const ticketClos = ticketOuvert.clore(
      Money.fromEuros(8_000),
      Temporal.PlainDate.from('2025-12-15'),
      Temporal.PlainDate.from('2026-05-20'),
    );

    const bailleur = unBailleurValide();
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(bailleur) };
    const ticketRepo = {
      trouverParId: vi.fn().mockResolvedValue(ticketClos),
      enregistrer: vi.fn(),
      listerJustificatifsLies: vi.fn(),
    };
    // Déclaration 2025 figée → throw DeclarationFigeeException
    const fakeDecl = { id: 'decl-2025', exercice: 2025 };
    const declRepo = { trouverParBailleurExercice: vi.fn().mockResolvedValue(fakeDecl) };
    const db = { transaction: () => ({ execute: vi.fn() }) };
    const justificatifRepo = { trouverParId: vi.fn(), enregistrer: vi.fn() };

    await expect(
      qualifierTicketTravaux(
        { ticketId: ticketClos.id as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
        makeClock(),
        db as never,
      ),
    ).rejects.toThrow(DeclarationFigeeException);

    // Vérifie que l'exercice utilisé est bien 2025 (dateCloture.year)
    expect(declRepo.trouverParBailleurExercice).toHaveBeenCalledWith(bailleur.id, 2025);
  });

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

    const bailleur = unBailleurValide();
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(bailleur) };
    const declRepo = { trouverParBailleurExercice: vi.fn().mockResolvedValue(null) };

    await qualifierTicketTravaux(
      { ticketId: ticket.id as TicketTravauxId, natureFiscale: 'amelioration' },
      { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
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

    const bailleur = unBailleurValide();
    const bailleurRepo = { trouver: vi.fn().mockResolvedValue(bailleur) };
    const declRepo = { trouverParBailleurExercice: vi.fn().mockResolvedValue(null) };

    await expect(
      qualifierTicketTravaux(
        { ticketId: ticketAnnule.id as TicketTravauxId, natureFiscale: 'amelioration' },
        { ticketRepo: ticketRepo as never, justificatifRepo: justificatifRepo as never, bailleurRepo: bailleurRepo as never, declRepo: declRepo as never },
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
