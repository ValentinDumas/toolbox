import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import type {
  EcheanceLoyerId,
  BailId,
  LocataireId,
  BailleurId,
  QuittanceId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

// NOTE: Ces imports n'existent pas encore — tests RED intentionnellement
import { genererQuittance } from '../../../src/application/encaissements/generer-quittance.js';
import { EcheanceLoyerNonPayee, QuittanceDejaEmise } from '../../../src/domain/encaissements/erreurs.js';
import { BailleurAbsent } from '../../../src/domain/identite/erreurs.js';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeEcheance(statut: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee', overrides: Record<string, unknown> = {}): object {
  return {
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId: crypto.randomUUID() as BailId,
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
    loyerHc: Money.fromEuros(620),
    montantCharges: Money.fromEuros(80),
    modeCharges: 'forfait',
    total: Money.fromEuros(700),
    statut,
    annuleLe: null,
    ...overrides,
  };
}

function makeBailleur(): object {
  return {
    id: crypto.randomUUID() as BailleurId,
    nomComplet: 'Jean Bailleur',
    adresse: { rue: '1 rue Test', codePostal: '75001', ville: 'Paris' },
  };
}

function makeBail(bailId: string): object {
  return {
    id: bailId as BailId,
    locataireId: crypto.randomUUID() as LocataireId,
    bienId: crypto.randomUUID() as string,
    modeCharges: 'forfait' as const,
    dateDebut: Temporal.PlainDate.from('2026-01-01'),
    dureeMois: 12,
  };
}

function makeLocataire(locataireId: string): object {
  return {
    id: locataireId as LocataireId,
    nom: 'Dupont',
    prenom: 'Jean',
  };
}

function makeBien(): object {
  return {
    id: crypto.randomUUID(),
    adresse: { rue: '10 rue du Bail', codePostal: '75010', ville: 'Paris' },
  };
}

function makeRepos(overrides: Record<string, unknown> = {}) {
  return {
    echeanceLoyerRepo: {
      trouverParId: vi.fn(),
    },
    quittanceRepo: {
      trouverActiveParEcheance: vi.fn().mockResolvedValue(null),
      enregistrer: vi.fn().mockResolvedValue(undefined),
      prochainNumero: vi.fn(),
    },
    bailleurRepo: {
      trouver: vi.fn(),
    },
    bailRepo: {
      trouverParId: vi.fn(),
    },
    locataireRepo: {
      trouverParId: vi.fn(),
    },
    bienRepo: {
      trouverParId: vi.fn(),
    },
    ...overrides,
  };
}

const fakePdfRenderer = {
  genererBuffer: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
};

const fakeStockage = {
  ecrireQuittance: vi.fn().mockResolvedValue('quittances/2026/quittance-2026-001-mai-2026-dupont.pdf'),
};

const clock = ClockFixe.du('2026-05-31');

// fake db with transaction support
function makeDb(transactionFn: (trx: unknown) => Promise<unknown>): object {
  return {
    transaction: () => ({
      execute: (fn: (trx: unknown) => Promise<unknown>) => fn({
        insertInto: () => ({ values: () => ({ execute: vi.fn().mockResolvedValue(undefined) }) }),
      }),
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('genererQuittance', () => {
  it('T8: throw EcheanceLoyerNonPayee si statut est "en_attente"', async () => {
    const echeance = makeEcheance('en_attente');
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
    });
    const db = makeDb(async () => {});

    await expect(
      genererQuittance(
        { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
        repos as unknown as Parameters<typeof genererQuittance>[1],
        fakePdfRenderer,
        fakeStockage,
        clock,
        db as Parameters<typeof genererQuittance>[5],
      ),
    ).rejects.toThrow(EcheanceLoyerNonPayee);
  });

  it('T8b: throw EcheanceLoyerNonPayee si statut est "partiellement_payee"', async () => {
    const echeance = makeEcheance('partiellement_payee');
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
    });
    const db = makeDb(async () => {});

    await expect(
      genererQuittance(
        { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
        repos as unknown as Parameters<typeof genererQuittance>[1],
        fakePdfRenderer,
        fakeStockage,
        clock,
        db as Parameters<typeof genererQuittance>[5],
      ),
    ).rejects.toThrow("Cette période n'est pas entièrement réglée");
  });

  it('T9: throw BailleurAbsent si bailleur est null', async () => {
    const echeance = makeEcheance('payee');
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
      quittanceRepo: { trouverActiveParEcheance: vi.fn().mockResolvedValue(null) },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(null) },
    });
    const db = makeDb(async () => {});

    await expect(
      genererQuittance(
        { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
        repos as unknown as Parameters<typeof genererQuittance>[1],
        fakePdfRenderer,
        fakeStockage,
        clock,
        db as Parameters<typeof genererQuittance>[5],
      ),
    ).rejects.toThrow(BailleurAbsent);
  });

  it('T10: throw QuittanceDejaEmise si une quittance active existe déjà', async () => {
    const echeance = makeEcheance('payee');
    const quittanceExistante = {
      id: crypto.randomUUID() as QuittanceId,
      echeanceId: (echeance as { id: EcheanceLoyerId }).id,
      numero: '2026-001',
      annuleeLe: null,
    };
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
      quittanceRepo: { trouverActiveParEcheance: vi.fn().mockResolvedValue(quittanceExistante) },
    });
    const db = makeDb(async () => {});

    await expect(
      genererQuittance(
        { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
        repos as unknown as Parameters<typeof genererQuittance>[1],
        fakePdfRenderer,
        fakeStockage,
        clock,
        db as Parameters<typeof genererQuittance>[5],
      ),
    ).rejects.toThrow(QuittanceDejaEmise);
  });

  it('T11: happy path — numéro "2026-001", quittance enregistrée, PDF généré, stockage appelé', async () => {
    const echeance = makeEcheance('payee');
    const bail = makeBail((echeance as { bailId: string }).bailId);
    const locataire = makeLocataire((bail as { locataireId: string }).locataireId);
    const bien = makeBien();
    const bailleur = makeBailleur();

    const enregistrer = vi.fn().mockResolvedValue(undefined);
    const prochainNumero = vi.fn().mockResolvedValue('2026-001');

    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
      quittanceRepo: {
        trouverActiveParEcheance: vi.fn().mockResolvedValue(null),
        enregistrer,
        prochainNumero,
      },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
      bailRepo: { trouverParId: vi.fn().mockResolvedValue(bail) },
      locataireRepo: { trouverParId: vi.fn().mockResolvedValue(locataire) },
      bienRepo: { trouverParId: vi.fn().mockResolvedValue(bien) },
    });

    const ecrireQuittance = vi.fn().mockResolvedValue('quittances/2026/quittance-2026-001-mai-2026-dupont.pdf');
    const stockage = { ecrireQuittance, slugify: (s: string) => s };

    // Build a fake db that captures transaction callback
    const db = {
      transaction: () => ({
        execute: async (fn: (trx: unknown) => Promise<unknown>) => {
          const fakeTrx = {
            insertInto: () => ({ values: () => ({ execute: vi.fn().mockResolvedValue(undefined) }) }),
          };
          return fn(fakeTrx);
        },
      }),
    };

    const resultat = await genererQuittance(
      { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
      repos as unknown as Parameters<typeof genererQuittance>[1],
      fakePdfRenderer,
      stockage as Parameters<typeof genererQuittance>[3],
      clock,
      db as Parameters<typeof genererQuittance>[5],
    );

    expect(resultat.numero).toBe('2026-001');
    expect(resultat.quittanceId).toBeDefined();
    expect(fakePdfRenderer.genererBuffer).toHaveBeenCalled();
    expect(ecrireQuittance).toHaveBeenCalled();
  });

  it('T12: 2ème émission même année → "2026-002" (compteur incrémente)', async () => {
    const echeance = makeEcheance('payee');
    const bail = makeBail((echeance as { bailId: string }).bailId);
    const locataire = makeLocataire((bail as { locataireId: string }).locataireId);
    const bien = makeBien();
    const bailleur = makeBailleur();

    const prochainNumero = vi.fn().mockResolvedValue('2026-002');
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
      quittanceRepo: {
        trouverActiveParEcheance: vi.fn().mockResolvedValue(null),
        enregistrer: vi.fn().mockResolvedValue(undefined),
        prochainNumero,
      },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
      bailRepo: { trouverParId: vi.fn().mockResolvedValue(bail) },
      locataireRepo: { trouverParId: vi.fn().mockResolvedValue(locataire) },
      bienRepo: { trouverParId: vi.fn().mockResolvedValue(bien) },
    });

    const db = {
      transaction: () => ({
        execute: async (fn: (trx: unknown) => Promise<unknown>) => fn({}),
      }),
    };

    const resultat = await genererQuittance(
      { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
      repos as unknown as Parameters<typeof genererQuittance>[1],
      fakePdfRenderer,
      fakeStockage as Parameters<typeof genererQuittance>[3],
      clock,
      db as Parameters<typeof genererQuittance>[5],
    );

    expect(resultat.numero).toBe('2026-002');
  });

  it('T13: 1ère émission en 2027 → "2027-001" (reset compteur annuel)', async () => {
    const echeance = makeEcheance('payee', {
      periodeDebut: Temporal.PlainDate.from('2027-01-01'),
      periodeFin: Temporal.PlainDate.from('2027-01-31'),
    });
    const bail = makeBail((echeance as { bailId: string }).bailId);
    const locataire = makeLocataire((bail as { locataireId: string }).locataireId);
    const bien = makeBien();
    const bailleur = makeBailleur();

    const prochainNumero = vi.fn().mockResolvedValue('2027-001');
    const repos = makeRepos({
      echeanceLoyerRepo: { trouverParId: vi.fn().mockResolvedValue(echeance) },
      quittanceRepo: {
        trouverActiveParEcheance: vi.fn().mockResolvedValue(null),
        enregistrer: vi.fn().mockResolvedValue(undefined),
        prochainNumero,
      },
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
      bailRepo: { trouverParId: vi.fn().mockResolvedValue(bail) },
      locataireRepo: { trouverParId: vi.fn().mockResolvedValue(locataire) },
      bienRepo: { trouverParId: vi.fn().mockResolvedValue(bien) },
    });

    const clock2027 = ClockFixe.du('2027-01-31');
    const db = {
      transaction: () => ({
        execute: async (fn: (trx: unknown) => Promise<unknown>) => fn({}),
      }),
    };

    const resultat = await genererQuittance(
      { echeanceId: (echeance as { id: EcheanceLoyerId }).id },
      repos as unknown as Parameters<typeof genererQuittance>[1],
      fakePdfRenderer,
      fakeStockage as Parameters<typeof genererQuittance>[3],
      clock2027,
      db as Parameters<typeof genererQuittance>[5],
    );

    expect(resultat.numero).toBe('2027-001');
  });
});
