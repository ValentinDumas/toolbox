/**
 * Tests unitaires — calculerAlertesDiagnostic (Phase 7 / DAS-02 / D-AL-02).
 *
 * Couvre :
 *   - ERP exclu (dateExpiration === null — D-77 / D-SRC-03)
 *   - Fenêtre [-30, +30] (bornes incluses)
 *   - Borne haute J+30 incluse / J+31 exclue
 *   - Borne basse déjà expiré J-30 inclus / J-31 exclu (miroir D-80)
 *   - Granularité D-SRC-04 : 1 alerte par diagnostic actif par type (DPE / gaz / élec)
 *   - Diagnostic actif uniquement D-79 (le plus récent par dateEmission)
 *   - Tri ASC par joursRestants
 *   - Liste vide
 *   - Invariant fast-check : tout diagnostic non-ERP dans fenêtre → exactement 1 alerte
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Temporal } from '@js-temporal/polyfill';

import { calculerAlertesDiagnostic } from '../../../src/domain/patrimoine/alerte-diagnostic.js';
import { joursAvantEcheance } from '../../../src/domain/_shared/alerte.js';
import {
  unBienValide,
  unDiagnosticDpeValide,
  unDiagnosticGazValide,
  unDiagnosticElecValide,
  unDiagnosticErpValide,
} from '../../_builders/patrimoine.js';

// maintenant fixe pour déterminisme
const MAINTENANT = Temporal.PlainDate.from('2035-12-01');

describe('calculerAlertesDiagnostic — ERP exclu (D-77 / D-SRC-03)', () => {
  it('Bien avec uniquement un ERP → 0 alerte (validité illimitée)', () => {
    const diag = unDiagnosticErpValide({ dateEmission: Temporal.PlainDate.from('2025-01-15') });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(0);
  });
});

describe('calculerAlertesDiagnostic — DPE dans fenêtre J-15', () => {
  it('DPE expirant dans 14 jours → 1 alerte avec joursRestants=14', () => {
    // DPE durée 10 ans : dateEmission = 2025-12-15, dateExpiration = 2035-12-15
    // maintenant = 2035-12-01 → joursRestants = 14
    const diag = unDiagnosticDpeValide({ dateEmission: Temporal.PlainDate.from('2025-12-15') });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(1);
    const alerte = alertes[0]!;
    expect(alerte.type).toBe('diagnostic');
    expect(alerte.joursRestants).toBe(14);
    expect(alerte.dateEcheance.toString()).toBe('2035-12-15');
    expect(alerte.source.type).toBe('diagnostic');
    expect(alerte.source.refId).toBe(diag.id);
    expect(alerte.source.bienId).toBe(bien.id);
    expect(alerte.source.extra?.['typeDiagnostic']).toBe('dpe');
    expect(alerte.urlAction).toBe(`/biens/${bien.id}/diagnostics#diag-dpe`);
  });
});

describe('calculerAlertesDiagnostic — bornes fenêtre haute', () => {
  it('diagnostic expirant exactement à J+30 → 1 alerte (incluse)', () => {
    // DPE durée 10 ans : expire dans 30 jours exactement
    // dateExpiration = 2035-12-31, dateEmission = 2025-12-31
    const dateExpiration = MAINTENANT.add({ days: 30 }); // 2035-12-31
    const dateEmission = dateExpiration.subtract({ years: 10 }); // 2025-12-31
    const diag = unDiagnosticDpeValide({ dateEmission });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.joursRestants).toBe(30);
  });

  it('diagnostic expirant à J+31 → 0 alerte (exclue)', () => {
    const dateExpiration = MAINTENANT.add({ days: 31 });
    const dateEmission = dateExpiration.subtract({ years: 10 });
    const diag = unDiagnosticDpeValide({ dateEmission });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(0);
  });
});

describe('calculerAlertesDiagnostic — bornes fenêtre basse (déjà expiré D-80)', () => {
  it('diagnostic expiré depuis 30 jours (joursRestants=-30) → 1 alerte visible (miroir D-80)', () => {
    // gaz durée 6 ans : expire depuis 30 jours
    // dateExpiration = MAINTENANT - 30 jours
    const dateExpiration = MAINTENANT.subtract({ days: 30 });
    const dateEmission = dateExpiration.subtract({ years: 6 });
    const diag = unDiagnosticGazValide({ dateEmission });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.joursRestants).toBe(-30);
    expect(alertes[0]!.source.extra?.['typeDiagnostic']).toBe('gaz');
  });

  it('diagnostic expiré depuis 31 jours → 0 alerte (hors fenêtre)', () => {
    const dateExpiration = MAINTENANT.subtract({ days: 31 });
    const dateEmission = dateExpiration.subtract({ years: 6 });
    const diag = unDiagnosticGazValide({ dateEmission });
    const bien = unBienValide({ diagnostics: [diag] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(0);
  });
});

describe('calculerAlertesDiagnostic — granularité D-SRC-04', () => {
  it('Bien avec DPE + gaz + élec actifs dans la fenêtre → 3 alertes distinctes', () => {
    // DPE : expire dans 10 jours (dateEmission = dateExpiration - 10 ans)
    const expDpe = MAINTENANT.add({ days: 10 });
    const dpe = unDiagnosticDpeValide({ dateEmission: expDpe.subtract({ years: 10 }) });

    // gaz : expire dans 5 jours (dateEmission = dateExpiration - 6 ans)
    const expGaz = MAINTENANT.add({ days: 5 });
    const gaz = unDiagnosticGazValide({ dateEmission: expGaz.subtract({ years: 6 }) });

    // élec : expire dans 20 jours
    const expElec = MAINTENANT.add({ days: 20 });
    const elec = unDiagnosticElecValide({ dateEmission: expElec.subtract({ years: 6 }) });

    const bien = unBienValide({ diagnostics: [dpe, gaz, elec] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    expect(alertes).toHaveLength(3);
    const types = alertes.map((a) => a.source.extra?.['typeDiagnostic']);
    expect(types).toContain('dpe');
    expect(types).toContain('gaz');
    expect(types).toContain('elec');
    // Chaque alerte a son propre refId
    const refIds = alertes.map((a) => a.source.refId);
    expect(new Set(refIds).size).toBe(3);
  });
});

describe('calculerAlertesDiagnostic — diagnostic actif uniquement D-79', () => {
  it('Bien avec 2 DPE (ancien + récent), seul le DPE actif (récent) dans la fenêtre → 1 alerte', () => {
    // DPE récent (actif) : expire dans 15 jours
    const expRecent = MAINTENANT.add({ days: 15 });
    const dpeRecent = unDiagnosticDpeValide({
      dateEmission: expRecent.subtract({ years: 10 }),
    });

    // DPE ancien (remplacé) : émis avant → même si dans fenêtre, ne doit pas produire d'alerte
    // dateEmission plus ancienne, expire aussi dans la fenêtre par coïncidence
    const expAncien = MAINTENANT.add({ days: 5 });
    const dpeAncien = unDiagnosticDpeValide({
      dateEmission: expAncien.subtract({ years: 10 }).subtract({ days: 1 }),
    });

    const bien = unBienValide({ diagnostics: [dpeAncien, dpeRecent] });
    const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
    // Seul le DPE actif (le plus récent par dateEmission) → 1 alerte
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.source.refId).toBe(dpeRecent.id);
    expect(alertes[0]!.joursRestants).toBe(15);
  });
});

describe('calculerAlertesDiagnostic — tri ASC', () => {
  it('plusieurs alertes multi-Bien → tri par joursRestants croissant', () => {
    // Bien 1 : DPE expirant dans 20 jours
    const exp1 = MAINTENANT.add({ days: 20 });
    const dpe1 = unDiagnosticDpeValide({ dateEmission: exp1.subtract({ years: 10 }) });
    const bien1 = unBienValide({ diagnostics: [dpe1] });

    // Bien 2 : gaz expirant dans 5 jours
    const exp2 = MAINTENANT.add({ days: 5 });
    const gaz2 = unDiagnosticGazValide({ dateEmission: exp2.subtract({ years: 6 }) });
    const bien2 = unBienValide({ diagnostics: [gaz2] });

    // Bien 3 : élec expirant dans 15 jours
    const exp3 = MAINTENANT.add({ days: 15 });
    const elec3 = unDiagnosticElecValide({ dateEmission: exp3.subtract({ years: 6 }) });
    const bien3 = unBienValide({ diagnostics: [elec3] });

    const alertes = calculerAlertesDiagnostic([bien1, bien2, bien3], MAINTENANT);
    expect(alertes).toHaveLength(3);
    expect(alertes.map((a) => a.joursRestants)).toEqual([5, 15, 20]);
  });
});

describe('calculerAlertesDiagnostic — liste vide', () => {
  it('calculerAlertesDiagnostic([], maintenant) → []', () => {
    const alertes = calculerAlertesDiagnostic([], MAINTENANT);
    expect(alertes).toEqual([]);
  });
});

describe('calculerAlertesDiagnostic — invariant fast-check', () => {
  it('tout diagnostic non-ERP dont dateExpiration ∈ [maintenant-30, maintenant+30] → exactement 1 alerte avec joursRestants correct', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -30, max: 30 }),
        fc.constantFrom('dpe' as const, 'gaz' as const, 'elec' as const),
        (offsetJours, type) => {
          const dateExpiration = MAINTENANT.add({ days: offsetJours });
          // dateEmission = dateExpiration - durée légale
          const duree = type === 'dpe' ? 10 : 6;
          const dateEmission = dateExpiration.subtract({ years: duree });
          const diag =
            type === 'dpe'
              ? unDiagnosticDpeValide({ dateEmission })
              : type === 'gaz'
                ? unDiagnosticGazValide({ dateEmission })
                : unDiagnosticElecValide({ dateEmission });
          const bien = unBienValide({ diagnostics: [diag] });
          const alertes = calculerAlertesDiagnostic([bien], MAINTENANT);
          if (alertes.length !== 1) return false;
          const alerte = alertes[0]!;
          return alerte.joursRestants === joursAvantEcheance(dateExpiration, MAINTENANT);
        },
      ),
      { numRuns: 50 },
    );
  });
});
