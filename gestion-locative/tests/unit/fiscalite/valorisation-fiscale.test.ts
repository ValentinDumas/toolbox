/**
 * Tests unitaires — ValorisationFiscale VO (D-FIS-G1.4, G1.8).
 *
 * BDD outside-in : tests RED avant implémentation.
 * Sources : BOFIP-BIC-AMT-10-20 §110, D-FIS-G1.8 (quote-part terrain [0, 30 %]).
 * Analog : tests/unit/encaissements/encaissement.test.ts
 */
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import { ValorisationFiscale } from '../../../src/domain/fiscalite/valorisation-fiscale.js';

const BIEN_ID = crypto.randomUUID() as BienId;
const DATE_ACQ = Temporal.PlainDate.from('2026-03-15');
const ACTIVE_LE = Temporal.PlainDateTime.from('2026-03-15T10:00:00');

describe('ValorisationFiscale.creer (D-FIS-G1.4, G1.8)', () => {
  it('Test 10 : crée une ValorisationFiscale valide avec fraisAcquisitionTotal correct', () => {
    const vf = ValorisationFiscale.creer({
      bienId: BIEN_ID,
      prixAcquisition: Money.fromEuros(216_000),
      dateAcquisition: DATE_ACQ,
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.fromEuros(8_000),
      quotePartTerrainRatio: 0.10,
      activeLe: ACTIVE_LE,
    });

    expect(vf.id).toBeTruthy();
    expect(vf.bienId).toBe(BIEN_ID);
    expect(vf.prixAcquisition.egale(Money.fromEuros(216_000))).toBe(true);
    expect(vf.fraisNotaire.egale(Money.fromEuros(16_000))).toBe(true);
    expect(vf.fraisAgence.egale(Money.fromEuros(8_000))).toBe(true);
    expect(vf.quotePartTerrainRatio).toBe(0.10);
    // fraisAcquisitionTotal = 16_000 + 8_000 = 24_000
    expect(vf.fraisAcquisitionTotal().egale(Money.fromEuros(24_000))).toBe(true);
  });

  it('Test 11 : quotePartTerrainRatio = 0.30 accepté (borne max D-FIS-G1.8)', () => {
    expect(() =>
      ValorisationFiscale.creer({
        bienId: BIEN_ID,
        prixAcquisition: Money.fromEuros(200_000),
        dateAcquisition: DATE_ACQ,
        fraisNotaire: Money.fromEuros(10_000),
        fraisAgence: Money.zero(),
        quotePartTerrainRatio: 0.30,
        activeLe: ACTIVE_LE,
      }),
    ).not.toThrow();
  });

  it('Test 12 : quotePartTerrainRatio > 0.30 throw InvariantViolated (D-FIS-G1.8)', () => {
    expect(() =>
      ValorisationFiscale.creer({
        bienId: BIEN_ID,
        prixAcquisition: Money.fromEuros(200_000),
        dateAcquisition: DATE_ACQ,
        fraisNotaire: Money.fromEuros(10_000),
        fraisAgence: Money.zero(),
        quotePartTerrainRatio: 0.31,
        activeLe: ACTIVE_LE,
      }),
    ).toThrow(/quotePartTerrainRatio|quote.*part.*terrain/i);
  });

  it('Test 13 : quotePartTerrainRatio négatif throw (D-FIS-G1.8)', () => {
    expect(() =>
      ValorisationFiscale.creer({
        bienId: BIEN_ID,
        prixAcquisition: Money.fromEuros(200_000),
        dateAcquisition: DATE_ACQ,
        fraisNotaire: Money.fromEuros(10_000),
        fraisAgence: Money.zero(),
        quotePartTerrainRatio: -0.01,
        activeLe: ACTIVE_LE,
      }),
    ).toThrow(/quotePartTerrainRatio|quote.*part.*terrain/i);
  });

  it('quotePartTerrainRatio = 0 accepté (terrain inexistant ou negligeable)', () => {
    expect(() =>
      ValorisationFiscale.creer({
        bienId: BIEN_ID,
        prixAcquisition: Money.fromEuros(200_000),
        dateAcquisition: DATE_ACQ,
        fraisNotaire: Money.fromEuros(10_000),
        fraisAgence: Money.zero(),
        quotePartTerrainRatio: 0,
        activeLe: ACTIVE_LE,
      }),
    ).not.toThrow();
  });

  it('prixAcquisition zéro throw (prix doit être > 0)', () => {
    expect(() =>
      ValorisationFiscale.creer({
        bienId: BIEN_ID,
        prixAcquisition: Money.zero(),
        dateAcquisition: DATE_ACQ,
        fraisNotaire: Money.zero(),
        fraisAgence: Money.zero(),
        quotePartTerrainRatio: 0.10,
        activeLe: ACTIVE_LE,
      }),
    ).toThrow(/prixAcquisition|prix.*acquisition/i);
  });

  it('fraisAcquisitionTotal retourne 0 si frais tous à zéro', () => {
    const vf = ValorisationFiscale.creer({
      bienId: BIEN_ID,
      prixAcquisition: Money.fromEuros(200_000),
      dateAcquisition: DATE_ACQ,
      fraisNotaire: Money.zero(),
      fraisAgence: Money.zero(),
      quotePartTerrainRatio: 0.10,
      activeLe: ACTIVE_LE,
    });
    expect(vf.fraisAcquisitionTotal().egale(Money.zero())).toBe(true);
  });

  it('toProps() retourne toutes les propriétés pour persistance SQLite (lignes 117-128)', () => {
    const vf = ValorisationFiscale.creer({
      bienId: BIEN_ID,
      prixAcquisition: Money.fromEuros(216_000),
      dateAcquisition: DATE_ACQ,
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.fromEuros(8_000),
      quotePartTerrainRatio: 0.10,
      activeLe: ACTIVE_LE,
    });

    const props = vf.toProps();
    expect(props.id).toBe(vf.id);
    expect(props.bienId).toBe(BIEN_ID);
    expect(props.prixAcquisition.egale(Money.fromEuros(216_000))).toBe(true);
    expect(props.dateAcquisition).toBe(DATE_ACQ);
    expect(props.fraisNotaire.egale(Money.fromEuros(16_000))).toBe(true);
    expect(props.fraisAgence.egale(Money.fromEuros(8_000))).toBe(true);
    expect(props.quotePartTerrainRatio).toBe(0.10);
    expect(props.activeLe).toBe(ACTIVE_LE);
  });
});
