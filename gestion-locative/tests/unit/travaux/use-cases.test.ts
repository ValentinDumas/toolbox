import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it, vi } from 'vitest';

import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type {
  BienId,
  JustificatifId,
  TicketTravauxId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../../src/domain/documents/justificatif-repository.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import { BienIntrouvable } from '../../../src/domain/patrimoine/erreurs.js';
import {
  PJIncoherenteBien,
  TicketIntrouvable,
} from '../../../src/domain/travaux/erreurs.js';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import type { TicketTravauxRepository } from '../../../src/domain/travaux/ticket-travaux-repository.js';
import { ajouterPJTicket } from '../../../src/application/travaux/ajouter-pj-ticket.js';
import { annulerTicketTravaux } from '../../../src/application/travaux/annuler-ticket-travaux.js';
import { cloreTicketTravaux } from '../../../src/application/travaux/clore-ticket-travaux.js';
import { creerTicketTravaux } from '../../../src/application/travaux/creer-ticket-travaux.js';
import { delierPJTicket } from '../../../src/application/travaux/delier-pj-ticket.js';
import { lireTicket } from '../../../src/application/travaux/lire-ticket.js';
import { listerTicketsParBien } from '../../../src/application/travaux/lister-tickets-par-bien.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import {
  unTicketTravauxClos,
  unTicketTravauxValide,
} from '../../_builders/travaux.js';
import { unJustificatifEnCorbeille, unJustificatifValide } from '../../_builders/documents.js';

const CLOCK = ClockFixe.du('2026-05-18');

/** Mock TicketTravauxRepository en mémoire. */
function mockTicketRepo() {
  const tickets = new Map<string, TicketTravaux>();
  const pivot = new Set<string>();
  return {
    tickets,
    pivot,
    repo: {
      enregistrer: vi.fn(async (t: TicketTravaux) => {
        tickets.set(t.id, t);
      }),
      trouverParId: vi.fn(async (id: TicketTravauxId | string) =>
        tickets.get(String(id)) ?? null,
      ),
      listerParBien: vi.fn(async () => [...tickets.values()]),
      lierJustificatif: vi.fn(
        async (ticketId: TicketTravauxId, jId: JustificatifId) => {
          pivot.add(`${ticketId}::${jId}`);
        },
      ),
      delierJustificatif: vi.fn(
        async (ticketId: TicketTravauxId, jId: JustificatifId) => {
          pivot.delete(`${ticketId}::${jId}`);
        },
      ),
      listerJustificatifsLies: vi.fn(async (ticketId: TicketTravauxId) => {
        const ids: JustificatifId[] = [];
        for (const key of pivot) {
          const [tid, jid] = key.split('::');
          if (tid === ticketId) ids.push(jid as JustificatifId);
        }
        return ids;
      }),
    } satisfies TicketTravauxRepository,
  };
}

function mockBienRepo() {
  return {
    enregistrer: vi.fn(),
    trouverParId: vi.fn(async (id: BienId) => {
      const bien = unBienValide();
      return { ...bien, id } as ReturnType<typeof unBienValide>;
    }),
    listerTous: vi.fn(),
    supprimer: vi.fn(),
  } satisfies BienRepository;
}

function mockJustificatifRepo() {
  const docs = new Map<string, Justificatif>();
  return {
    docs,
    repo: {
      enregistrer: vi.fn(async (j: Justificatif) => {
        docs.set(j.id, j);
      }),
      trouverParId: vi.fn(async (id: JustificatifId | string) =>
        docs.get(String(id)) ?? null,
      ),
      rechercher: vi.fn(),
      listerCorbeille: vi.fn(),
      supprimerDefinitivement: vi.fn(),
    } satisfies JustificatifRepository,
  };
}

describe('creerTicketTravaux', () => {
  it('throw BienIntrouvable si le Bien n\'existe pas', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    const bienRepo = {
      ...mockBienRepo(),
      trouverParId: vi.fn(async () => null),
    } satisfies BienRepository;
    await expect(
      creerTicketTravaux(
        {
          bienId: 'inconnu',
          titre: 'T',
          description: 'D',
          dateOuverture: Temporal.PlainDate.from('2026-05-18'),
        },
        { ticketRepo, bienRepo, clock: CLOCK },
      ),
    ).rejects.toThrow(BienIntrouvable);
  });

  it('crée un ticket statut=ouvert avec coût estimé', async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const bienRepo = mockBienRepo();
    const result = await creerTicketTravaux(
      {
        bienId: 'fake-id' as BienId,
        titre: 'Remplacement chauffe-eau',
        description: 'Fuite à réparer.',
        dateOuverture: Temporal.PlainDate.from('2026-05-18'),
        coutEstimeTtc: Money.fromEuros(1200),
        notes: 'Note 1',
      },
      { ticketRepo, bienRepo, clock: CLOCK },
    );
    expect(result.ticketId).toBeTruthy();
    const ticket = tickets.get(result.ticketId);
    expect(ticket?.statut).toBe('ouvert');
    expect(ticket?.coutEstimeTtc?.toCentimes()).toBe(120000n);
  });
});

describe('listerTicketsParBien', () => {
  it('délègue au repo avec les options', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    await listerTicketsParBien(
      { bienId: 'b', statuts: ['ouvert', 'en_cours'] },
      { ticketRepo },
    );
    expect(ticketRepo.listerParBien).toHaveBeenCalledWith('b', {
      statuts: ['ouvert', 'en_cours'],
      inclureAnnules: undefined,
    });
  });
});

describe('lireTicket', () => {
  it('throw TicketIntrouvable si le ticket n\'existe pas', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    const bienRepo = mockBienRepo();
    const { repo: justifRepo } = mockJustificatifRepo();
    await expect(
      lireTicket(
        { id: 'inconnu' },
        { ticketRepo, bienRepo, justificatifRepo: justifRepo },
      ),
    ).rejects.toThrow(TicketIntrouvable);
  });

  it('retourne le ticket + bien + justificatifs liés', async () => {
    const { repo: ticketRepo, tickets, pivot } = mockTicketRepo();
    const bienRepo = mockBienRepo();
    const { repo: justifRepo, docs } = mockJustificatifRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    const j = Justificatif.creer(
      unJustificatifValide({ bienId: ticket.bienId }),
    );
    docs.set(j.id, j);
    pivot.add(`${ticket.id}::${j.id}`);

    const result = await lireTicket(
      { id: ticket.id },
      { ticketRepo, bienRepo, justificatifRepo: justifRepo },
    );
    expect(result.ticket.id).toBe(ticket.id);
    expect(result.bien).not.toBeNull();
    expect(result.justificatifs).toHaveLength(1);
    expect(result.justificatifs[0]?.id).toBe(j.id);
  });

  it('filtre les Justificatifs en corbeille (CR-03)', async () => {
    const { repo: ticketRepo, tickets, pivot } = mockTicketRepo();
    const bienRepo = mockBienRepo();
    const { repo: justifRepo, docs } = mockJustificatifRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);

    const jActif = Justificatif.creer(
      unJustificatifValide({ bienId: ticket.bienId, titre: 'PJ active' }),
    );
    const jCorbeille = Justificatif.creer(
      unJustificatifEnCorbeille({ bienId: ticket.bienId, titre: 'PJ corbeille' }),
    );
    docs.set(jActif.id, jActif);
    docs.set(jCorbeille.id, jCorbeille);
    pivot.add(`${ticket.id}::${jActif.id}`);
    pivot.add(`${ticket.id}::${jCorbeille.id}`);

    const result = await lireTicket(
      { id: ticket.id },
      { ticketRepo, bienRepo, justificatifRepo: justifRepo },
    );
    expect(result.justificatifs).toHaveLength(1);
    expect(result.justificatifs[0]?.id).toBe(jActif.id);
  });
});

describe('cloreTicketTravaux', () => {
  it('throw TicketIntrouvable si ticket absent', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    await expect(
      cloreTicketTravaux(
        {
          id: 'inconnu',
          dateCloture: Temporal.PlainDate.from('2026-06-01'),
          coutReelTtc: Money.fromEuros(100),
        },
        { ticketRepo, clock: CLOCK },
      ),
    ).rejects.toThrow(TicketIntrouvable);
  });

  it('clos un ticket ouvert avec coutReelTtc', async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    const result = await cloreTicketTravaux(
      {
        id: ticket.id,
        dateCloture: Temporal.PlainDate.from('2026-06-01'),
        coutReelTtc: Money.fromEuros(1250),
      },
      { ticketRepo, clock: CLOCK },
    );
    expect(result.ticket.statut).toBe('clos');
    expect(result.ticket.coutReelTtc?.toCentimes()).toBe(125000n);
  });
});

describe('annulerTicketTravaux', () => {
  it('throw TicketIntrouvable si ticket absent', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    await expect(
      annulerTicketTravaux(
        { id: 'inconnu', raison: 'R' },
        { ticketRepo, clock: CLOCK },
      ),
    ).rejects.toThrow(TicketIntrouvable);
  });

  it('annule un ticket ouvert avec raison persistée', async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    const result = await annulerTicketTravaux(
      { id: ticket.id, raison: 'Plus pertinent' },
      { ticketRepo, clock: CLOCK },
    );
    expect(result.ticket.statut).toBe('annule');
    expect(result.ticket.raisonAnnulation).toBe('Plus pertinent');
    expect(result.ticket.annuleLe).not.toBeNull();
  });
});

describe('ajouterPJTicket — Mode attach', () => {
  it('throw TicketIntrouvable si ticket absent', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    const bienRepo = mockBienRepo();
    const { repo: justifRepo } = mockJustificatifRepo();
    await expect(
      ajouterPJTicket(
        { ticketId: 'inconnu', justificatifId: 'jid' },
        {
          ticketRepo,
          justificatifRepo: justifRepo,
          bienRepo,
          locataireRepo: {
            enregistrer: vi.fn(),
            trouverParId: vi.fn(),
            listerTous: vi.fn(),
          } as never,
          stockage: {} as never,
          convertisseurImage: {} as never,
          clock: CLOCK,
          db: {} as never,
        },
      ),
    ).rejects.toThrow(TicketIntrouvable);
  });

  it('throw InvariantViolated si ni fichier ni justificatifId', async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    const bienRepo = mockBienRepo();
    const { repo: justifRepo } = mockJustificatifRepo();
    await expect(
      ajouterPJTicket(
        { ticketId: ticket.id },
        {
          ticketRepo,
          justificatifRepo: justifRepo,
          bienRepo,
          locataireRepo: {
            enregistrer: vi.fn(),
            trouverParId: vi.fn(),
            listerTous: vi.fn(),
          } as never,
          stockage: {} as never,
          convertisseurImage: {} as never,
          clock: CLOCK,
          db: {} as never,
        },
      ),
    ).rejects.toThrow(InvariantViolated);
  });

  it('throw PJIncoherenteBien si justificatif.bienId !== ticket.bienId', async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const ticket = TicketTravaux.creer(
      unTicketTravauxValide({ bienId: 'bien-A' as BienId }),
      CLOCK.aujourdhui(),
    );
    tickets.set(ticket.id, ticket);
    const bienRepo = mockBienRepo();
    const { repo: justifRepo, docs } = mockJustificatifRepo();
    const j = Justificatif.creer(
      unJustificatifValide({ bienId: 'bien-B' as BienId }),
    );
    docs.set(j.id, j);

    await expect(
      ajouterPJTicket(
        { ticketId: ticket.id, justificatifId: j.id },
        {
          ticketRepo,
          justificatifRepo: justifRepo,
          bienRepo,
          locataireRepo: {
            enregistrer: vi.fn(),
            trouverParId: vi.fn(),
            listerTous: vi.fn(),
          } as never,
          stockage: {} as never,
          convertisseurImage: {} as never,
          clock: CLOCK,
          db: {} as never,
        },
      ),
    ).rejects.toThrow(PJIncoherenteBien);
  });

  it('attach OK si justificatif.bienId === ticket.bienId — lie via pivot (idempotent)', async () => {
    const { repo: ticketRepo, tickets, pivot } = mockTicketRepo();
    const sameBienId = 'bien-X' as BienId;
    const ticket = TicketTravaux.creer(
      unTicketTravauxValide({ bienId: sameBienId }),
      CLOCK.aujourdhui(),
    );
    tickets.set(ticket.id, ticket);
    const bienRepo = mockBienRepo();
    const { repo: justifRepo, docs } = mockJustificatifRepo();
    const j = Justificatif.creer(unJustificatifValide({ bienId: sameBienId }));
    docs.set(j.id, j);

    const result = await ajouterPJTicket(
      { ticketId: ticket.id, justificatifId: j.id },
      {
        ticketRepo,
        justificatifRepo: justifRepo,
        bienRepo,
        locataireRepo: {
          enregistrer: vi.fn(),
          trouverParId: vi.fn(),
          listerTous: vi.fn(),
        } as never,
        stockage: {} as never,
        convertisseurImage: {} as never,
        clock: CLOCK,
        db: {} as never,
      },
    );
    expect(result.justificatifId).toBe(j.id);
    expect(pivot.has(`${ticket.id}::${j.id}`)).toBe(true);
  });
});

describe('delierPJTicket', () => {
  it('throw TicketIntrouvable si ticket absent', async () => {
    const { repo: ticketRepo } = mockTicketRepo();
    await expect(
      delierPJTicket(
        { ticketId: 'inconnu', justificatifId: 'jid' },
        { ticketRepo },
      ),
    ).rejects.toThrow(TicketIntrouvable);
  });

  it('DELETE row pivot — appelle delierJustificatif sur le repo', async () => {
    const { repo: ticketRepo, tickets, pivot } = mockTicketRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxValide(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    pivot.add(`${ticket.id}::jid-1`);
    await delierPJTicket(
      { ticketId: ticket.id, justificatifId: 'jid-1' },
      { ticketRepo },
    );
    expect(pivot.has(`${ticket.id}::jid-1`)).toBe(false);
  });
});

describe('cloreTicketTravaux — propage TransitionInvalide depuis ticket clos', () => {
  it("clos → clore() throw TransitionInvalide('Ticket déjà clos.')", async () => {
    const { repo: ticketRepo, tickets } = mockTicketRepo();
    const ticket = TicketTravaux.creer(unTicketTravauxClos(), CLOCK.aujourdhui());
    tickets.set(ticket.id, ticket);
    await expect(
      cloreTicketTravaux(
        {
          id: ticket.id,
          dateCloture: Temporal.PlainDate.from('2026-06-02'),
          coutReelTtc: Money.fromEuros(100),
        },
        { ticketRepo, clock: CLOCK },
      ),
    ).rejects.toThrow('Ticket déjà clos.');
  });
});
