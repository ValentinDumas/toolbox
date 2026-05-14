import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Encaissement } from '../../../src/domain/encaissements/encaissement.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const echeanceId = crypto.randomUUID() as EcheanceLoyerId;

function propsValide() {
  return {
    echeanceId,
    montant: Money.fromEuros(700),
    date: Temporal.PlainDate.from('2026-05-05'),
    mode: 'virement' as const,
  };
}

describe('Encaissement', () => {
  // T6 : creer retourne un agrégat valide
  it('T6: Encaissement.creer(propsValide) retourne agrégat', () => {
    const e = Encaissement.creer(propsValide());
    expect(e).toBeDefined();
    expect(e.montant.toCentimes()).toBe(70_000n);
    expect(e.mode).toBe('virement');
    expect(e.annuleLe).toBeNull();
    expect(e.raisonAnnulation).toBeNull();
  });

  // T7 : mode invalide throw
  it('T7: mode invalide ("bitcoin") throw InvariantViolated', () => {
    expect(() =>
      Encaissement.creer({ ...propsValide(), mode: 'bitcoin' as unknown as 'virement' }),
    ).toThrow(InvariantViolated);
  });

  // WR-08 : Encaissement de 0 € doit être refusé (cohérence inter-couches
  // avec Zod côté web). Test régression pour prévenir un refactor qui
  // retirerait silencieusement l'invariant.
  it('WR-08: rejette montant = 0 €', () => {
    expect(() =>
      Encaissement.creer({ ...propsValide(), montant: Money.zero() }),
    ).toThrow(InvariantViolated);
    expect(() =>
      Encaissement.creer({ ...propsValide(), montant: Money.zero() }),
    ).toThrow('Un Encaissement ne peut pas être de 0 €');
  });

  // T8 : annuler retourne nouveau Encaissement annulé
  it('T8: e.annuler("raison", PlainDate) retourne nouveau Encaissement annulé', () => {
    const e = Encaissement.creer(propsValide());
    const annule = e.annuler('Erreur saisie', Temporal.PlainDate.from('2026-05-10'));
    expect(annule.annuleLe).not.toBeNull();
    expect(annule.annuleLe?.toString()).toBe('2026-05-10');
    expect(annule.raisonAnnulation).toBe('Erreur saisie');
    // Original inchangé
    expect(e.annuleLe).toBeNull();
  });

  // T9 : annuler un déjà annulé throw
  it('T9: annuler un déjà annulé throw InvariantViolated', () => {
    const e = Encaissement.creer(propsValide());
    const annule = e.annuler('Raison 1', Temporal.PlainDate.from('2026-05-10'));
    expect(() =>
      annule.annuler('Raison 2', Temporal.PlainDate.from('2026-05-11')),
    ).toThrow(InvariantViolated);
    expect(() =>
      annule.annuler('Raison 2', Temporal.PlainDate.from('2026-05-11')),
    ).toThrow('Cet encaissement est déjà annulé');
  });

  // estCompensateur helper
  it('estCompensateur: compensateur → true, positif → false', () => {
    const positif = Encaissement.creer(propsValide());
    const comp = Encaissement.creer({ ...propsValide(), montant: Money.compensateur(Money.fromEuros(700)) });
    expect(positif.estCompensateur()).toBe(false);
    expect(comp.estCompensateur()).toBe(true);
  });
});
