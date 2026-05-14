import { describe, it, expect, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { creerEncaissement } from '../../../src/application/encaissements/creer-encaissement.js';
import type { EcheanceLoyerId, BailId, EncaissementId } from '../../../src/domain/_shared/identifiants.js';
import { Encaissement } from '../../../src/domain/encaissements/encaissement.js';
import { Money as MoneyType } from '../../../src/domain/_shared/money.js';
import type { StatutEcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Bail } from '../../../src/domain/locatif/bail.js';
import { unBailValide } from '../../_builders/locatif.js';

const CLOCK = ClockFixe.du('2026-05-15');
const TODAY = CLOCK.aujourdhui();

// Repos stubs
function creerStubEcheanceLoyerRepo(echeance: EcheanceLoyer) {
  let statut = echeance.statut;
  let sommePaiee = Money.zero();

  return {
    trouverParId: async (_id: string) => echeance,
    mettreAJourStatut: async (_id: string, s: StatutEcheanceLoyer) => { statut = s; },
    listerParBail: async () => [],
    enregistrer: async () => {},
    enregistrerBatch: async () => {},
    listerNonPayees: async () => [],
    supprimerLot: async () => {},
    getSommePaiee: () => sommePaiee,
    setExtraSommePaiee: (m: MoneyType) => { sommePaiee = m; },
    getStatut: () => statut,
  };
}

function creerStubEncaissementRepo(encaissements: Encaissement[] = []) {
  const stored: Encaissement[] = [...encaissements];

  return {
    enregistrer: async (e: Encaissement) => { stored.push(e); },
    trouverParId: async (id: string) => stored.find((e) => e.id === id) ?? null,
    listerParEcheance: async (_id: string, opts?: { inclureAnnules?: boolean }) => {
      const inclureAnnules = opts?.inclureAnnules ?? true;
      if (inclureAnnules) return stored;
      return stored.filter((e) => !e.annuleLe);
    },
    listerTous: async (_opts?: { inclureAnnules?: boolean }) => stored,
    sommePaieeParEcheance: async (_id: string): Promise<MoneyType> => {
      const actifs = stored.filter((e) => !e.annuleLe);
      if (actifs.length === 0) return Money.zero();
      return actifs.reduce<MoneyType>((sum, e) => sum.additionner(e.montant), Money.zero());
    },
    getStored: () => stored,
  };
}

/**
 * IN-06 : stub typé sur Bail réel via builder unBailValide().
 * Auparavant le bail était un objet ad-hoc casté en `unknown`, ce qui
 * privait le test de type-checking lors d'un refactor de l'agrégat.
 */
function creerStubBailRepo(bail: Bail) {
  return {
    trouverParId: async (_id: string): Promise<Bail | null> => bail,
    enregistrer: async () => {},
    listerTous: async () => [],
  };
}

function creerEcheanceLoyer(opts: {
  bailId?: BailId;
  total?: MoneyType;
  annuleLe?: Temporal.PlainDate | null;
} = {}): EcheanceLoyer {
  const loyerHc = Money.fromEuros(620);
  const charges = Money.fromEuros(80);
  const total = opts.total ?? loyerHc.additionner(charges);
  return EcheanceLoyer.creer({
    bailId: opts.bailId ?? (crypto.randomUUID() as BailId),
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
    loyerHc,
    montantCharges: charges,
    modeCharges: 'forfait',
    total,
    statut: 'en_attente',
    annuleLe: opts.annuleLe !== undefined ? opts.annuleLe : null,
  });
}

describe('creerEncaissement', () => {
  const bailId = crypto.randomUUID() as BailId;

  /**
   * IN-06 : Bail réel construit via builder + .activer(...).
   * Le test type-check effectif l'API agrégat (e.g. si Bail.activer
   * change de signature, le test devient rouge).
   */
  function creerBailActif(): Bail {
    return unBailValide({
      id: bailId,
      dateDebut: Temporal.PlainDate.from('2026-01-01'),
    }).activer(Temporal.PlainDate.from('2026-01-01'), 1);
  }

  // T10 : paiement partiel (300€ < 700€) → partiellement_payee
  it('T10: montant 300€ → statut partiellement_payee', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(creerBailActif());

    const result = await creerEncaissement(
      {
        echeanceId: echeance.id,
        montantCentimesPositifs: 30_000n, // 300€
        signe: 'positif',
        date: TODAY,
        mode: 'virement',
      },
      echeanceLoyerRepo as never,
      encaissementRepo as never,
      bailRepo as never,
      CLOCK,
    );

    expect(result.statut).toBe('partiellement_payee');
    expect(result.surPaiement).toBeNull();
  });

  // T11 : paiement exact (700€) → payee
  it('T11: montant 700€ → statut payee', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(creerBailActif());

    const result = await creerEncaissement(
      {
        echeanceId: echeance.id,
        montantCentimesPositifs: 70_000n,
        signe: 'positif',
        date: TODAY,
        mode: 'virement',
      },
      echeanceLoyerRepo as never,
      encaissementRepo as never,
      bailRepo as never,
      CLOCK,
    );

    expect(result.statut).toBe('payee');
    expect(result.surPaiement).toBeNull();
  });

  // T12 : sur-paiement (800€ > 700€) → payee + surPaiement 100€
  it('T12: montant 800€ → statut payee + surPaiement = 100€', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(creerBailActif());

    const result = await creerEncaissement(
      {
        echeanceId: echeance.id,
        montantCentimesPositifs: 80_000n,
        signe: 'positif',
        date: TODAY,
        mode: 'virement',
      },
      echeanceLoyerRepo as never,
      encaissementRepo as never,
      bailRepo as never,
      CLOCK,
    );

    expect(result.statut).toBe('payee');
    expect(result.surPaiement).not.toBeNull();
    expect(result.surPaiement!.toCentimes()).toBe(10_000n); // 100€
  });

  // T13 : date < bail.dateDebut → warning
  it('T13: date < bail.dateDebut → warning antérieur', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(
      unBailValide({
        id: bailId,
        dateDebut: Temporal.PlainDate.from('2026-05-01'),
      }).activer(Temporal.PlainDate.from('2026-05-01'), 1),
    );

    const result = await creerEncaissement(
      {
        echeanceId: echeance.id,
        montantCentimesPositifs: 70_000n,
        signe: 'positif',
        date: Temporal.PlainDate.from('2026-04-01'), // avant dateDebut 2026-05-01
        mode: 'virement',
      },
      echeanceLoyerRepo as never,
      encaissementRepo as never,
      bailRepo as never,
      CLOCK,
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('antérieure'))).toBe(true);
  });

  // T14 : date > today + 90j → warning
  it('T14: date > today+90j → warning trop avancée', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(creerBailActif());

    const result = await creerEncaissement(
      {
        echeanceId: echeance.id,
        montantCentimesPositifs: 70_000n,
        signe: 'positif',
        date: TODAY.add({ days: 100 }), // > today + 90j
        mode: 'virement',
      },
      echeanceLoyerRepo as never,
      encaissementRepo as never,
      bailRepo as never,
      CLOCK,
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('avancée'))).toBe(true);
  });

  // T15 : echeance.annuleLe != null → throw EcheanceAnnulee
  it('T15: echeance annulée → throw InvariantViolated', async () => {
    const echeance = creerEcheanceLoyer({ bailId, annuleLe: Temporal.PlainDate.from('2026-04-01') });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    const bailRepo = creerStubBailRepo(creerBailActif());

    await expect(
      creerEncaissement(
        {
          echeanceId: echeance.id,
          montantCentimesPositifs: 70_000n,
          signe: 'positif',
          date: TODAY,
          mode: 'virement',
        },
        echeanceLoyerRepo as never,
        encaissementRepo as never,
        bailRepo as never,
        CLOCK,
      ),
    ).rejects.toThrow("annulée");
  });

  // T16 : bail.actifDepuis === null → throw BailNonActif
  it('T16: bail non actif → throw', async () => {
    const echeance = creerEcheanceLoyer({ bailId });
    const echeanceLoyerRepo = creerStubEcheanceLoyerRepo(echeance);
    const encaissementRepo = creerStubEncaissementRepo();
    // Bail valide mais jamais activé (actifDepuis === null par défaut)
    const bailRepo = creerStubBailRepo(
      unBailValide({
        id: bailId,
        dateDebut: Temporal.PlainDate.from('2026-01-01'),
      }),
    );

    await expect(
      creerEncaissement(
        {
          echeanceId: echeance.id,
          montantCentimesPositifs: 70_000n,
          signe: 'positif',
          date: TODAY,
          mode: 'virement',
        },
        echeanceLoyerRepo as never,
        encaissementRepo as never,
        bailRepo as never,
        CLOCK,
      ),
    ).rejects.toThrow("activé");
  });
});
