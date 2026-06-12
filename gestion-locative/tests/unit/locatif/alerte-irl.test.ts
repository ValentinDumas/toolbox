/**
 * Tests unitaires — Alertes IRL J-30 (Phase 7 / DAS-02 / Plan 07-02 / D-SRC-03).
 *
 * Couvre :
 *   - estAlerteIrlActive : filtre actifDepuis (D-SRC-03), gel DPE F/G (D-92),
 *     exercice courant (D-SRC-03 IRL), fenêtre [0, +30] (D-SRC-02).
 *   - calculerAlertesIrl : forme Alerte unifiée (D-AL-01), tri ASC, bail orphelin,
 *     liste vide.
 *
 * Note fenêtre : bail.dateAnniversaireProchaine(today) retourne TOUJOURS une date
 * strictement future (j > 0). La borne basse j >= -30 est défensive et testée via
 * fast-check property ; la borne haute j <= 30 est testée aux limites J-30/J-31.
 *
 * Pattern miroir : tests/unit/fiscalite/alerte-cfe-j30.test.ts
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Temporal } from '@js-temporal/polyfill';

import {
  estAlerteIrlActive,
  calculerAlertesIrl,
} from '../../../src/domain/locatif/alerte-irl.js';
import type { BailId, BienId } from '../../../src/domain/_shared/identifiants.js';
import { unBailValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { unBienValide, unBienAvecDpeF } from '../../_builders/patrimoine.js';

const MAINTENANT = Temporal.PlainDate.from('2026-06-12');
const BAIL_ID = '33333333-3333-4333-8333-333333333333' as BailId;
const BIEN_ID = '11111111-1111-4111-8111-111111111111' as BienId;

const MAP_VIDE = new Map<BailId, boolean>();

/**
 * Crée un bail actif avec un anniversaire dans exactement N jours à partir de MAINTENANT.
 * Stratégie : dateDebut = MAINTENANT + N jours - 1 an, ainsi
 *   dateAnniversaireProchaine(MAINTENANT) = dateDebut + 1 an = MAINTENANT + N jours.
 * Valide pour N > 0 (anniversaire dans le futur).
 */
function bailActifAvecAnniversaireDans(jours: number) {
  const dateAnniversaire = MAINTENANT.add({ days: jours });
  const dateDebut = dateAnniversaire.subtract({ years: 1 });
  return unBailIndexableValide({
    id: BAIL_ID,
    bienId: BIEN_ID,
    dateDebut,
    dureeMois: 12,
  });
}

describe('estAlerteIrlActive — filtres + fenêtre [-30, +30]', () => {
  it('Test 1 (actif requis) : bail avec actifDepuis === null → false', () => {
    // unBailValide ne passe pas actifDepuis → null par défaut
    const bail = unBailValide({ id: BAIL_ID, bienId: BIEN_ID });
    const bien = unBienValide({ id: BIEN_ID });
    expect(estAlerteIrlActive(bail, bien, false, MAINTENANT)).toBe(false);
  });

  it('Test 2 (gel DPE) : bail actif sur Bien DPE F → false (gel Climat D-92)', () => {
    const bail = bailActifAvecAnniversaireDans(15);
    const bien = unBienAvecDpeF({ id: BIEN_ID });
    expect(estAlerteIrlActive(bail, bien, false, MAINTENANT)).toBe(false);
  });

  it('Test 3 (exercice courant) : indexation déjà présente → false (D-SRC-03)', () => {
    const bail = bailActifAvecAnniversaireDans(15);
    const bien = unBienValide({ id: BIEN_ID });
    expect(estAlerteIrlActive(bail, bien, true, MAINTENANT)).toBe(false);
  });

  it('Test 4 (fenêtre J-30 incluse) : anniversaire dans exactement 30 jours → true', () => {
    const bail = bailActifAvecAnniversaireDans(30);
    const bien = unBienValide({ id: BIEN_ID });
    expect(estAlerteIrlActive(bail, bien, false, MAINTENANT)).toBe(true);
  });

  it('Test 5 (fenêtre J-31 exclue) : anniversaire dans 31 jours → false (hors fenêtre haute)', () => {
    const bail = bailActifAvecAnniversaireDans(31);
    const bien = unBienValide({ id: BIEN_ID });
    expect(estAlerteIrlActive(bail, bien, false, MAINTENANT)).toBe(false);
  });

  it('Test 6a (jour J) : anniversaire exactement aujourd\'hui → false (dateAnniversaireProchaine est strictement future)', () => {
    // Quand aujourd'hui EST l'anniversaire, dateAnniversaireProchaine retourne l'anniversaire
    // de l'année suivante (strictement > today), donc j > 0 mais > 30 → false.
    // Cela vérifie la sémantique "atteint dès aujourd'hui → prochain est dans 1 an".
    const dateDebut = MAINTENANT.subtract({ years: 1 });
    const bail = unBailIndexableValide({ id: BAIL_ID, bienId: BIEN_ID, dateDebut, dureeMois: 12 });
    const bien = unBienValide({ id: BIEN_ID });
    // anniversaire = dateDebut + 1 an = MAINTENANT → prochain = MAINTENANT + 1 an (j ≈ 365 > 30)
    expect(estAlerteIrlActive(bail, bien, false, MAINTENANT)).toBe(false);
  });

  it('Test 6b (borne basse) : propriété fast-check — bail actif Bien C, j ∈ [1,30] → toujours true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 30 }),
        (jours) => {
          const bail = bailActifAvecAnniversaireDans(jours);
          const bien = unBienValide({ id: BIEN_ID });
          return estAlerteIrlActive(bail, bien, false, MAINTENANT) === true;
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe('calculerAlertesIrl — forme Alerte + tri ASC', () => {
  it('Test 7 (forme Alerte) : 1 bail actif DPE C, J-15 → 1 Alerte type=irl correctement formée', () => {
    const bail = bailActifAvecAnniversaireDans(15);
    const bien = unBienValide({ id: BIEN_ID, rue: '5 allée des Pins' });
    const alertes = calculerAlertesIrl([bail], [bien], MAP_VIDE, MAINTENANT);
    expect(alertes).toHaveLength(1);
    const alerte = alertes[0]!;
    expect(alerte.type).toBe('irl');
    expect(alerte.joursRestants).toBe(15);
    expect(alerte.source.type).toBe('irl');
    expect(alerte.source.refId).toBe(bail.id);
    expect(alerte.source.bienId).toBe(bien.id);
    expect(alerte.dateEcheance.toString()).toBe(bail.dateAnniversaireProchaine(MAINTENANT).toString());
    expect(alerte.urlAction).toBe(`/baux/${bail.id}/indexer`);
    expect(alerte.libelle).toContain('IRL');
  });

  it('Test 8a (tri ASC) : liste mixte → tri joursRestants ASC', () => {
    const bienId2 = '44444444-4444-4444-8444-444444444444' as BienId;
    const bienId3 = '55555555-5555-4555-8555-555555555555' as BienId;
    const bail1 = unBailIndexableValide({
      bienId: BIEN_ID,
      dateDebut: MAINTENANT.add({ days: 20 }).subtract({ years: 1 }),
      dureeMois: 12,
    });
    const bail2 = unBailIndexableValide({
      bienId: bienId2,
      dateDebut: MAINTENANT.add({ days: 5 }).subtract({ years: 1 }),
      dureeMois: 12,
    });
    const bail3 = unBailIndexableValide({
      bienId: bienId3,
      dateDebut: MAINTENANT.add({ days: 10 }).subtract({ years: 1 }),
      dureeMois: 12,
    });
    const bien1 = unBienValide({ id: BIEN_ID });
    const bien2 = unBienValide({ id: bienId2 });
    const bien3 = unBienValide({ id: bienId3 });
    const alertes = calculerAlertesIrl([bail1, bail2, bail3], [bien1, bien2, bien3], MAP_VIDE, MAINTENANT);
    const joursTriees = alertes.map((a) => a.joursRestants);
    expect(joursTriees).toEqual([...joursTriees].sort((a, b) => a - b));
    // Vérifier ordre exact
    expect(alertes[0]!.joursRestants).toBeLessThanOrEqual(alertes[1]!.joursRestants);
    expect(alertes[1]!.joursRestants).toBeLessThanOrEqual(alertes[2]!.joursRestants);
  });

  it('Test 8b (liste vide) : calculerAlertesIrl([], [], mapVide, maintenant) → []', () => {
    expect(calculerAlertesIrl([], [], MAP_VIDE, MAINTENANT)).toEqual([]);
  });

  it("Test 9 (bail orphelin) : bail dont bienId n'est dans aucun Bien → ignoré silencieusement", () => {
    const bail = bailActifAvecAnniversaireDans(15);
    // On ne passe aucun bien
    const alertes = calculerAlertesIrl([bail], [], MAP_VIDE, MAINTENANT);
    expect(alertes).toHaveLength(0);
  });
});
