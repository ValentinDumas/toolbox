import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Encaissement } from '../../../src/domain/encaissements/encaissement.js';
import { annulerEncaissement } from '../../../src/application/encaissements/annuler-encaissement.js';
import type { EcheanceLoyerId, BailId, EncaissementId } from '../../../src/domain/_shared/identifiants.js';
import type { StatutEcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';

const CLOCK = ClockFixe.du('2026-05-15');

function creerEcheanceAvecStatut(statut: StatutEcheanceLoyer): EcheanceLoyer {
  const loyerHc = Money.fromEuros(620);
  const charges = Money.fromEuros(80);
  return EcheanceLoyer.creer({
    bailId: crypto.randomUUID() as BailId,
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
    loyerHc,
    montantCharges: charges,
    modeCharges: 'forfait',
    total: loyerHc.additionner(charges),
    statut,
    annuleLe: null,
  });
}

function creerEncaissement(echeanceId: EcheanceLoyerId, montant: Money, id?: EncaissementId): Encaissement {
  return Encaissement.creer({
    id,
    echeanceId,
    montant,
    date: Temporal.PlainDate.from('2026-05-05'),
    mode: 'virement',
  });
}

describe('annulerEncaissement', () => {
  // T17 : 2 encaissements (700€+100€, statut payee), annuler 1er → partiellement_payee, rebasculee=true
  it('T17: 2 encaissements, annuler le plus gros → partiellement_payee + rebasculee=true', async () => {
    const echeance = creerEcheanceAvecStatut('payee');
    const enc1 = creerEncaissement(echeance.id, Money.fromEuros(700));
    const enc2 = creerEncaissement(echeance.id, Money.fromEuros(100));

    let statut = echeance.statut;
    const stored = [enc1, enc2];

    const encaissementRepo = {
      enregistrer: async (e: Encaissement) => {
        const idx = stored.findIndex((x) => x.id === e.id);
        if (idx >= 0) stored[idx] = e;
        else stored.push(e);
      },
      trouverParId: async (id: string) => stored.find((e) => e.id === id) ?? null,
      listerParEcheance: async (_id: string, opts?: { inclureAnnules?: boolean }) => {
        if (opts?.inclureAnnules === false) return stored.filter((e) => !e.annuleLe);
        return stored;
      },
      listerTous: async () => stored,
      sommePaieeParEcheance: async (_id: string) => {
        const actifs = stored.filter((e) => !e.annuleLe);
        if (actifs.length === 0) return Money.zero();
        return actifs.reduce((sum, e) => sum.additionner(e.montant), Money.zero());
      },
    };

    const echeanceLoyerRepo = {
      trouverParId: async (_id: string) => ({ ...echeance, statut } as EcheanceLoyer),
      mettreAJourStatut: async (_id: string, s: StatutEcheanceLoyer) => { statut = s; },
      enregistrer: async () => {},
      enregistrerBatch: async () => {},
      listerParBail: async () => [],
      listerNonPayees: async () => [],
      supprimerLot: async () => {},
    };

    const result = await annulerEncaissement(
      { id: enc1.id, raison: 'Erreur saisie' },
      encaissementRepo as never,
      echeanceLoyerRepo as never,
      CLOCK,
    );

    expect(result.ancienStatut).toBe('payee');
    expect(result.nouveauStatut).toBe('partiellement_payee');
    expect(result.rebasculee).toBe(true);
  });

  // T18 : annuler le seul encaissement → en_attente
  it('T18: annuler le seul encaissement → en_attente', async () => {
    const echeance = creerEcheanceAvecStatut('payee');
    const enc1 = creerEncaissement(echeance.id, Money.fromEuros(700));

    let statut = echeance.statut;
    const stored = [enc1];

    const encaissementRepo = {
      enregistrer: async (e: Encaissement) => {
        const idx = stored.findIndex((x) => x.id === e.id);
        if (idx >= 0) stored[idx] = e;
        else stored.push(e);
      },
      trouverParId: async (id: string) => stored.find((e) => e.id === id) ?? null,
      listerParEcheance: async () => stored,
      listerTous: async () => stored,
      sommePaieeParEcheance: async (_id: string) => {
        const actifs = stored.filter((e) => !e.annuleLe);
        if (actifs.length === 0) return Money.zero();
        return actifs.reduce((sum, e) => sum.additionner(e.montant), Money.zero());
      },
    };

    const echeanceLoyerRepo = {
      trouverParId: async (_id: string) => ({ ...echeance, statut } as EcheanceLoyer),
      mettreAJourStatut: async (_id: string, s: StatutEcheanceLoyer) => { statut = s; },
      enregistrer: async () => {},
      enregistrerBatch: async () => {},
      listerParBail: async () => [],
      listerNonPayees: async () => [],
      supprimerLot: async () => {},
    };

    const result = await annulerEncaissement(
      { id: enc1.id, raison: 'Erreur saisie' },
      encaissementRepo as never,
      echeanceLoyerRepo as never,
      CLOCK,
    );

    expect(result.ancienStatut).toBe('payee');
    expect(result.nouveauStatut).toBe('en_attente');
    expect(result.rebasculee).toBe(true);
  });
});
