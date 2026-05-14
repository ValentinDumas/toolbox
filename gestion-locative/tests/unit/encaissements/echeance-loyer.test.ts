import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

// NOTE: EcheanceLoyer n'existe pas encore — ces tests sont RED intentionnellement
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

function propsValides() {
  return {
    bailId: crypto.randomUUID() as BailId,
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue: Temporal.PlainDate.from('2026-05-05'),
    loyerHc: Money.fromEuros(620),
    montantCharges: Money.fromEuros(80),
    modeCharges: 'forfait' as const,
    total: Money.fromEuros(700),
    statut: 'en_attente' as const,
    annuleLe: null,
  };
}

describe('EcheanceLoyer', () => {
  // Test 8 : creer avec props valides retourne agrégat avec statut 'en_attente'
  it('EcheanceLoyer.creer(propsValide) retourne agrégat avec statut en_attente', () => {
    const echeance = EcheanceLoyer.creer(propsValides());
    expect(echeance.statut).toBe('en_attente');
    expect(echeance.loyerHc.toCentimes()).toBe(Money.fromEuros(620).toCentimes());
    expect(echeance.total.toCentimes()).toBe(Money.fromEuros(700).toCentimes());
  });

  // Test 9 : statut invalide throw InvariantViolated
  it("statut invalide ('foo') throw InvariantViolated", () => {
    expect(() =>
      EcheanceLoyer.creer({
        ...propsValides(),
        statut: 'foo' as 'en_attente',
      }),
    ).toThrow(InvariantViolated);
  });

  // Test 10 : total != loyerHc + montantCharges throw InvariantViolated
  it('total != loyerHc + montantCharges throw InvariantViolated', () => {
    expect(() =>
      EcheanceLoyer.creer({
        ...propsValides(),
        total: Money.fromEuros(999), // total incorrect
      }),
    ).toThrow(InvariantViolated);
    expect(() =>
      EcheanceLoyer.creer({
        ...propsValides(),
        total: Money.fromEuros(999),
      }),
    ).toThrow("Le total de l'échéance doit être égal à loyerHc + montantCharges");
  });

  // Test 11 : avecStatut copy-on-write avec id préservé
  it("echeance.avecStatut('payee') retourne nouveau EcheanceLoyer copy-on-write, id préservé", () => {
    const echeance = EcheanceLoyer.creer(propsValides());
    const payee = echeance.avecStatut('payee');
    expect(payee.statut).toBe('payee');
    expect(payee.id).toBe(echeance.id);
    expect(payee.loyerHc.egale(echeance.loyerHc)).toBe(true);
  });
});
