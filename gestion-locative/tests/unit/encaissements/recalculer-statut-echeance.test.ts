import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { recalculerStatutEcheance } from '../../../src/application/encaissements/recalculer-statut-echeance.js';
import type { EcheanceLoyerId, BailId } from '../../../src/domain/_shared/identifiants.js';
import type { StatutEcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';

function creerEcheance(total: Money): EcheanceLoyer {
  const loyerHc = total;
  const charges = Money.zero();
  return EcheanceLoyer.creer({
    bailId: crypto.randomUUID() as BailId,
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
    loyerHc,
    montantCharges: charges,
    modeCharges: 'forfait',
    total: loyerHc.additionner(charges),
    statut: 'en_attente',
    annuleLe: null,
  });
}

function creerRepos(echeance: EcheanceLoyer, sommePaiee: Money) {
  let statut = echeance.statut;

  const echeanceLoyerRepo = {
    trouverParId: async (_id: string): Promise<EcheanceLoyer> => {
      return { ...echeance, statut } as EcheanceLoyer;
    },
    mettreAJourStatut: async (_id: string, s: StatutEcheanceLoyer) => { statut = s; },
    enregistrer: async () => {},
    enregistrerBatch: async () => {},
    listerParBail: async () => [],
    listerNonPayees: async () => [],
    compterParBail: async () => 0,
    supprimerLot: async () => {},
    getStatut: () => statut,
  };

  const encaissementRepo = {
    sommePaieeParEcheance: async (_id: string) => sommePaiee,
    enregistrer: async () => {},
    trouverParId: async () => null,
    listerParEcheance: async () => [],
    listerTous: async () => [],
  };

  return { echeanceLoyerRepo, encaissementRepo };
}

describe('recalculerStatutEcheance', () => {
  const TOTAL = Money.fromEuros(700);

  // T19 : plusieurs cas de statut
  it('T19: somme=0 → en_attente', async () => {
    const echeance = creerEcheance(TOTAL);
    const { echeanceLoyerRepo, encaissementRepo } = creerRepos(echeance, Money.zero());
    const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
    expect(result.statut).toBe('en_attente');
    expect(result.surPaiement).toBeNull();
  });

  it('T19: somme < total → partiellement_payee', async () => {
    const echeance = creerEcheance(TOTAL);
    const { echeanceLoyerRepo, encaissementRepo } = creerRepos(echeance, Money.fromEuros(300));
    const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
    expect(result.statut).toBe('partiellement_payee');
    expect(result.surPaiement).toBeNull();
  });

  it('T19: somme == total → payee', async () => {
    const echeance = creerEcheance(TOTAL);
    const { echeanceLoyerRepo, encaissementRepo } = creerRepos(echeance, Money.fromEuros(700));
    const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
    expect(result.statut).toBe('payee');
    expect(result.surPaiement).toBeNull();
  });

  it('T19: somme > total → payee + surPaiement', async () => {
    const echeance = creerEcheance(TOTAL);
    const { echeanceLoyerRepo, encaissementRepo } = creerRepos(echeance, Money.fromEuros(800));
    const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
    expect(result.statut).toBe('payee');
    expect(result.surPaiement).not.toBeNull();
    expect(result.surPaiement!.toCentimes()).toBe(10_000n); // 100€
  });

  // T20 : compensateur réduit la somme
  it('T20: compensateur — enc1=800€, enc2=-200€ → somme 600€ → partiellement_payee', async () => {
    const echeance = creerEcheance(TOTAL);
    // Simule sommePaieeParEcheance = 800 + (-200) = 600
    const sommePaiee = Money.fromEuros(800).additionner(Money.compensateur(Money.fromEuros(200)));
    // sommePaiee.toCentimes() = 60_000n (600€)
    const { echeanceLoyerRepo, encaissementRepo } = creerRepos(echeance, sommePaiee);
    const result = await recalculerStatutEcheance(echeance.id, echeanceLoyerRepo as never, encaissementRepo as never);
    expect(result.statut).toBe('partiellement_payee');
    expect(result.surPaiement).toBeNull();
  });
});
