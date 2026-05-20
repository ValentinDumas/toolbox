/**
 * Tests unitaires — Composant sub-aggregate (D-FIS-G1.1, G1.5, G5.2).
 *
 * BDD outside-in : tests RED avant implémentation.
 * Sources : BOFIP-BIC-AMT-20-40, CGI art. 39, D-FIS-G1.1 à G1.8.
 * Analog : tests/unit/encaissements/encaissement.test.ts
 */
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId, TicketTravauxId } from '../../../src/domain/_shared/identifiants.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';

const BIEN_ID = crypto.randomUUID() as BienId;
const DATE_ACQ = Temporal.PlainDate.from('2026-03-15');

describe('Composant.creer — invariants (D-FIS-G1.1, G1.5)', () => {
  it('Test 1 : crée un Composant gros_oeuvre valide avec id brand ComposantId', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    expect(c.id).toBeTruthy();
    expect(typeof c.id).toBe('string');
    expect(c.type).toBe('gros_oeuvre');
    expect(c.bienId).toBe(BIEN_ID);
    expect(c.montantHt.egale(Money.fromEuros(200_000))).toBe(true);
    expect(c.dateAcquisition.toString()).toBe('2026-03-15');
    expect(c.origineKind).toBe('initial');
    expect(c.dateSortie).toBeNull();
    expect(c.motifSortie).toBeNull();
    expect(c.ticketId).toBeNull();
  });

  it('Test 2 : montantHt zéro throw pour type amortissable (D-FIS-G1.1)', () => {
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'gros_oeuvre',
        montantHt: Money.zero(),
        dateAcquisition: DATE_ACQ,
        origineKind: 'initial',
      }),
    ).toThrow(/strictement positif/i);
  });

  it('Test 3 : terrain accepte montantHt = 0 (non amortissable — D-FIS-G1.1)', () => {
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'terrain',
        montantHt: Money.zero(),
        dateAcquisition: DATE_ACQ,
        origineKind: 'initial',
      }),
    ).not.toThrow();
  });

  it('Test 4 : type invalide throw InvariantViolated (D-FIS-G1.1)', () => {
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'invalide' as never,
        montantHt: Money.fromEuros(100_000),
        dateAcquisition: DATE_ACQ,
        origineKind: 'initial',
      }),
    ).toThrow(/type.*invalide|invalide.*type/i);
  });

  it('Test 5 : origineKind amelioration sans ticketId throw (D-FIS-G1.5)', () => {
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'gros_oeuvre',
        montantHt: Money.fromEuros(50_000),
        dateAcquisition: DATE_ACQ,
        origineKind: 'amelioration',
        ticketId: null,
      }),
    ).toThrow(/ticketId.*null|ticketId.*obligatoire/i);
  });

  it('Test 6 : origineKind initial avec ticketId — accepté (ticketId optionnel pour initial)', () => {
    const ticketId = crypto.randomUUID() as TicketTravauxId;
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'gros_oeuvre',
        montantHt: Money.fromEuros(50_000),
        dateAcquisition: DATE_ACQ,
        origineKind: 'initial',
        ticketId,
      }),
    ).not.toThrow();
  });

  it('Test 7 : dateSortie avant dateAcquisition throw (D-FIS-G5.2)', () => {
    expect(() =>
      Composant.creer({
        bienId: BIEN_ID,
        type: 'gros_oeuvre',
        montantHt: Money.fromEuros(50_000),
        dateAcquisition: Temporal.PlainDate.from('2026-03-15'),
        origineKind: 'initial',
        dateSortie: Temporal.PlainDate.from('2026-01-01'),
        motifSortie: 'vente',
      }),
    ).toThrow(/dateSortie.*dateAcquisition|sortie.*acquisition/i);
  });
});

describe('Composant.dureeAmortissementAns (D-FIS-G1.1, BOFIP-BIC-AMT-20-40)', () => {
  it('Test 8 : gros_oeuvre → 40 ans', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    expect(c.dureeAmortissementAns(REGLES_2026)).toBe(40);
  });

  it('Test 8b : terrain → 0 an (non amortissable)', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'terrain',
      montantHt: Money.zero(),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    expect(c.dureeAmortissementAns(REGLES_2026)).toBe(0);
  });

  it('Test 8c : durées correctes pour tous les types BOFIP', () => {
    const types = [
      { type: 'toiture_facade', duree: 25 },
      { type: 'installations_techniques', duree: 20 },
      { type: 'agencements_interieurs', duree: 15 },
      { type: 'mobilier', duree: 7 },
    ] as const;

    for (const { type, duree } of types) {
      const c = Composant.creer({
        bienId: BIEN_ID,
        type,
        montantHt: Money.fromEuros(10_000),
        dateAcquisition: DATE_ACQ,
        origineKind: 'initial',
      });
      expect(c.dureeAmortissementAns(REGLES_2026), `durée ${type}`).toBe(duree);
    }
  });
});

describe('Composant.sortir (D-FIS-G5.2)', () => {
  it('Test 9 : sortir retourne nouveau composant avec dateSortie et motifSortie', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
      origineKind: 'initial',
    });
    const sorti = c.sortir('vente', Temporal.PlainDate.from('2026-12-31'));
    expect(sorti.dateSortie?.toString()).toBe('2026-12-31');
    expect(sorti.motifSortie).toBe('vente');
    expect(sorti.id).toBe(c.id); // même id
    // original inchangé
    expect(c.dateSortie).toBeNull();
  });

  it('Test 9b : sortir un composant déjà sorti throw (D-FIS-G5.2)', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
      origineKind: 'initial',
    });
    const sorti = c.sortir('vente', Temporal.PlainDate.from('2026-12-31'));
    expect(() => sorti.sortir('vente', Temporal.PlainDate.from('2027-01-01'))).toThrow(
      /déjà sorti|already exited/i,
    );
  });
});

describe('Composant.estAmortissable (D-FIS-G1.1)', () => {
  it('terrain non actif → non amortissable', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'terrain',
      montantHt: Money.zero(),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    expect(c.estAmortissable()).toBe(false);
  });

  it('gros_oeuvre sans dateSortie → amortissable', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    expect(c.estAmortissable()).toBe(true);
  });

  it('gros_oeuvre sorti → non amortissable', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
      origineKind: 'initial',
    });
    const sorti = c.sortir('vente', Temporal.PlainDate.from('2026-06-30'));
    expect(sorti.estAmortissable()).toBe(false);
  });
});

describe('Composant.toProps — round-trip', () => {
  it('toProps retourne tous les champs pour reconstruction', () => {
    const c = Composant.creer({
      bienId: BIEN_ID,
      type: 'mobilier',
      montantHt: Money.fromEuros(5_000),
      dateAcquisition: DATE_ACQ,
      origineKind: 'initial',
    });
    const props = c.toProps();
    expect(props.id).toBe(c.id);
    expect(props.type).toBe('mobilier');
    expect(props.montantHt.egale(Money.fromEuros(5_000))).toBe(true);
    expect(props.origineKind).toBe('initial');
    expect(props.ticketId).toBeNull();
    expect(props.dateSortie).toBeNull();
  });
});
