import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyerId, RelanceId } from '../../../src/domain/_shared/identifiants.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

// Tests RED — calculerRelanceDisponible fonction pure
// NOTE: Ces modules n'existent pas encore — tests RED intentionnellement
import { calculerRelanceDisponible } from '../../../src/application/encaissements/calculer-relance-disponible.js';
import { Relance } from '../../../src/domain/encaissements/relance.js';

const bailId = crypto.randomUUID() as BailId;
const jourEcheanceAttendue = Temporal.PlainDate.from('2026-05-05');
const loyerHc = Money.fromEuros(700);

function creerEcheance(statut: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee') {
  return EcheanceLoyer.creer({
    bailId,
    periodeDebut: Temporal.PlainDate.from('2026-05-01'),
    periodeFin: Temporal.PlainDate.from('2026-05-31'),
    jourEcheanceAttendue,
    loyerHc,
    montantCharges: Money.zero(),
    modeCharges: 'forfait',
    total: loyerHc,
    statut,
    annuleLe: null,
  });
}

function creerRelance(niveau: 1 | 2 | 3, annuleLe: Temporal.PlainDate | null = null) {
  return Relance.creer({
    echeanceId: crypto.randomUUID() as EcheanceLoyerId,
    niveau,
    canal: niveau === 3 ? 'pdf' : 'email',
    envoyeeLe: Temporal.PlainDate.from('2026-05-15'),
    contenuSnapshot: '{"version":"v1"}',
    annuleLe,
  });
}

describe('calculerRelanceDisponible', () => {
  it('T5 : echeance.statut="payee" → null (pas de relance sur échéance payée)', () => {
    const echeance = creerEcheance('payee');
    const today = Temporal.PlainDate.from('2026-05-20');
    expect(calculerRelanceDisponible(echeance, [], today)).toBeNull();
  });

  it('T6 : echeance.statut="annulee" → null', () => {
    const echeance = creerEcheance('annulee');
    const today = Temporal.PlainDate.from('2026-05-20');
    expect(calculerRelanceDisponible(echeance, [], today)).toBeNull();
  });

  it('T7 : statut="en_attente", today = jourEcheanceAttendue + 5j, aucune relance → null (J+10 pas atteint)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +5 = 2026-05-10
    const today = Temporal.PlainDate.from('2026-05-10');
    expect(calculerRelanceDisponible(echeance, [], today)).toBeNull();
  });

  it('T8 : statut="en_attente", today = +10j, aucune relance → 1 (niveau 1 disponible)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +10 = 2026-05-15
    const today = Temporal.PlainDate.from('2026-05-15');
    expect(calculerRelanceDisponible(echeance, [], today)).toBe(1);
  });

  it('T9 : statut="en_attente", today = +29j, relance 1 envoyée → null (J+30 pas atteint pour niveau 2)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +29 = 2026-06-03
    const today = Temporal.PlainDate.from('2026-06-03');
    const relances = [creerRelance(1)];
    expect(calculerRelanceDisponible(echeance, relances, today)).toBeNull();
  });

  it('T10 : statut="en_attente", today = +30j, relance 1 envoyée → 2 (niveau 2 disponible)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +30 = 2026-06-04
    const today = Temporal.PlainDate.from('2026-06-04');
    const relances = [creerRelance(1)];
    expect(calculerRelanceDisponible(echeance, relances, today)).toBe(2);
  });

  it('T11 : today = +60j, relance 1 envoyée mais PAS 2 → 2 (chaînage strict — saut interdit)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +60 = 2026-07-04
    const today = Temporal.PlainDate.from('2026-07-04');
    const relances = [creerRelance(1)]; // relance 2 non envoyée
    expect(calculerRelanceDisponible(echeance, relances, today)).toBe(2);
  });

  it('T12 : today = +60j, relances 1 ET 2 envoyées → 3', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +60 = 2026-07-04
    const today = Temporal.PlainDate.from('2026-07-04');
    const relances = [creerRelance(1), creerRelance(2)];
    expect(calculerRelanceDisponible(echeance, relances, today)).toBe(3);
  });

  it('T13 : today = +100j, relances 1, 2, 3 toutes envoyées → null (tous niveaux épuisés)', () => {
    const echeance = creerEcheance('en_attente');
    const today = Temporal.PlainDate.from('2026-08-13');
    const relances = [creerRelance(1), creerRelance(2), creerRelance(3)];
    expect(calculerRelanceDisponible(echeance, relances, today)).toBeNull();
  });

  it('T14 : today = +30j, relance 1 envoyée PUIS annulée → 1 (la relance 1 annulée ne compte pas)', () => {
    const echeance = creerEcheance('en_attente');
    // jourEcheanceAttendue = 2026-05-05, +30 = 2026-06-04
    const today = Temporal.PlainDate.from('2026-06-04');
    const annuleLe = Temporal.PlainDate.from('2026-05-20');
    const relances = [creerRelance(1, annuleLe)]; // niveau 1 annulé
    expect(calculerRelanceDisponible(echeance, relances, today)).toBe(1);
  });
});
