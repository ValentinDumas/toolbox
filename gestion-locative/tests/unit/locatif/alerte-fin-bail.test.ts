/**
 * Tests unitaires — Alertes fin de bail (Phase 7 / DAS-02 / Plan 07-02 / D-SRC-05).
 *
 * Couvre :
 *   - dateFinBail : dateDebut + dureeMois (D-29).
 *   - estAlerteFinBailActive : filtre actifDepuis (D-SRC-03), fenêtre [-30, +60] (D-SRC-05).
 *   - calculerAlertesFinBail : forme Alerte unifiée (D-AL-01), tri ASC, liste vide.
 *
 * Pattern miroir : tests/unit/fiscalite/alerte-cfe-j30.test.ts
 */

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import {
  dateFinBail,
  estAlerteFinBailActive,
  calculerAlertesFinBail,
} from '../../../src/domain/locatif/alerte-fin-bail.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';
import { unBailValide, unBailIndexableValide } from '../../_builders/locatif.js';

const MAINTENANT = Temporal.PlainDate.from('2026-06-12');
const BAIL_ID = '33333333-3333-4333-8333-333333333333' as BailId;

/**
 * Crée un bail actif avec une fin dans exactement N jours à partir de MAINTENANT.
 * fin = dateDebut + dureeMois = MAINTENANT + N jours
 * Donc dateDebut = MAINTENANT + N jours - dureeMois mois.
 */
function bailActifAvecFinDans(jours: number, dureeMois: number = 12) {
  const dateFin = MAINTENANT.add({ days: jours });
  const dateDebut = dateFin.subtract({ months: dureeMois });
  return unBailIndexableValide({
    id: BAIL_ID,
    dateDebut,
    dureeMois,
  });
}

describe('dateFinBail', () => {
  it('Test 2 (dateFinBail) : dateDebut 2025-01-15 + 12 mois → 2026-01-15', () => {
    const bail = unBailValide({
      dateDebut: Temporal.PlainDate.from('2025-01-15'),
      dureeMois: 12,
    });
    expect(dateFinBail(bail).toString()).toBe('2026-01-15');
  });
});

describe('estAlerteFinBailActive — filtre actif + fenêtre [-30, +60]', () => {
  it('Test 1 (actif requis) : bail avec actifDepuis === null → false (D-SRC-03)', () => {
    const bail = unBailValide({ id: BAIL_ID });
    expect(estAlerteFinBailActive(bail, MAINTENANT)).toBe(false);
  });

  it('Test 3 (fenêtre J-30 incluse) : fin dans 30 jours → true, joursRestants === 30', () => {
    const bail = bailActifAvecFinDans(30);
    expect(estAlerteFinBailActive(bail, MAINTENANT)).toBe(true);
  });

  it('Test 4a (fenêtre J+60 incluse) : fin il y a 60 jours → true (D-SRC-05)', () => {
    const bail = bailActifAvecFinDans(-60);
    expect(estAlerteFinBailActive(bail, MAINTENANT)).toBe(true);
  });

  it('Test 4b (J+61 exclue) : fin il y a 61 jours → false (au-delà de J+60, D-SRC-05)', () => {
    const bail = bailActifAvecFinDans(-61);
    expect(estAlerteFinBailActive(bail, MAINTENANT)).toBe(false);
  });

  it('Test 5 (borne haute exclue) : fin dans 31 jours → false (avant J-30 pas d\'alerte)', () => {
    const bail = bailActifAvecFinDans(31);
    expect(estAlerteFinBailActive(bail, MAINTENANT)).toBe(false);
  });
});

describe('calculerAlertesFinBail — forme Alerte + tri ASC', () => {
  it('Test 6 (forme Alerte) : 1 bail actif à 15 jours de la fin → 1 Alerte type=fin_bail', () => {
    const bail = bailActifAvecFinDans(15);
    const alertes = calculerAlertesFinBail([bail], MAINTENANT);
    expect(alertes).toHaveLength(1);
    const alerte = alertes[0]!;
    expect(alerte.type).toBe('fin_bail');
    expect(alerte.joursRestants).toBe(15);
    expect(alerte.source.type).toBe('fin_bail');
    expect(alerte.source.refId).toBe(bail.id);
    expect(alerte.source.bienId).toBe(bail.bienId);
    expect(alerte.dateEcheance.toString()).toBe(dateFinBail(bail).toString());
    expect(alerte.urlAction).toBe(`/baux/${bail.id}`);
    expect(alerte.libelle.toLowerCase()).toContain('bail');
  });

  it('Test 7a (tri ASC) : liste mixte → tri joursRestants ASC', () => {
    const bail1 = bailActifAvecFinDans(20);
    const bail2 = bailActifAvecFinDans(5);
    const bail3 = bailActifAvecFinDans(10);
    const alertes = calculerAlertesFinBail([bail1, bail2, bail3], MAINTENANT);
    const joursTriees = alertes.map((a) => a.joursRestants);
    expect(joursTriees).toEqual([...joursTriees].sort((a, b) => a - b));
    expect(alertes[0]!.joursRestants).toBeLessThanOrEqual(alertes[1]!.joursRestants);
    expect(alertes[1]!.joursRestants).toBeLessThanOrEqual(alertes[2]!.joursRestants);
  });

  it('Test 7b (liste vide) : calculerAlertesFinBail([], maintenant) → []', () => {
    expect(calculerAlertesFinBail([], MAINTENANT)).toEqual([]);
  });
});
