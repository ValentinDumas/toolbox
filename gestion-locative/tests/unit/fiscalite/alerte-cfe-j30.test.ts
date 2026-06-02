/**
 * Tests unitaires — Alerte CFE J-30 (Phase 6 / FIS-06 / Plan 06-07 / D-CFE6.5).
 *
 * Couvre :
 *   - joursAvantEcheance : positif / zéro / négatif + monotonie (fast-check).
 *   - estAlerteActive : filtres statut (payee/exoneree_*) + fenêtre J-30.
 *   - calculerAlertesCfe : agrégation + tri par joursRestants ASC.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Temporal } from '@js-temporal/polyfill';

import {
  joursAvantEcheance,
  estAlerteActive,
  calculerAlertesCfe,
} from '../../../src/domain/fiscalite/cfe/alerte-cfe-j30.js';
import { DeclarationCfe } from '../../../src/domain/fiscalite/cfe/declaration-cfe.js';
import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

const BIEN_TEST = '11111111-1111-4111-8111-111111111111' as BienId;

function declCfe(opts: {
  statut: 'non_deposee' | 'deposee' | 'exoneree_premiere_annee' | 'exoneree_commune' | 'payee';
  echeance: string;
}): DeclarationCfe {
  const date = Temporal.PlainDate.from(opts.echeance);
  return DeclarationCfe.creer({
    bienId: BIEN_TEST,
    millesime: date.year,
    statut: opts.statut,
    dateDepotDeclaration:
      opts.statut === 'deposee' || opts.statut === 'payee'
        ? Temporal.PlainDate.from(`${date.year}-12-10`)
        : null,
    montantAvisCentimes: opts.statut === 'payee' ? Money.fromEuros(320) : null,
    dateEcheancePaiement: date,
  });
}

describe('joursAvantEcheance', () => {
  it('30 jours avant 2026-12-15 → 30', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-12-15'),
        Temporal.PlainDate.from('2026-11-15'),
      ),
    ).toBe(30);
  });

  it('jour J → 0', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-12-15'),
        Temporal.PlainDate.from('2026-12-15'),
      ),
    ).toBe(0);
  });

  it('le lendemain → -1 (échéance dépassée)', () => {
    expect(
      joursAvantEcheance(
        Temporal.PlainDate.from('2026-12-15'),
        Temporal.PlainDate.from('2026-12-16'),
      ),
    ).toBe(-1);
  });

  it('propriété fast-check : monotonie — date1 < date2 → joursAvantEcheance(date1) > joursAvantEcheance(date2)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 365 }),
        fc.integer({ min: 0, max: 365 }),
        (offset1, offset2) => {
          if (offset1 === offset2) return true; // skip equality
          const echeance = Temporal.PlainDate.from('2026-12-15');
          const d1 = echeance.subtract({ days: Math.max(offset1, offset2) });
          const d2 = echeance.subtract({ days: Math.min(offset1, offset2) });
          // d1 < d2
          const j1 = joursAvantEcheance(echeance, d1);
          const j2 = joursAvantEcheance(echeance, d2);
          return j1 > j2;
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('estAlerteActive — filtres statut + fenêtre J-30 (pitfall §5)', () => {
  const j15Echeance = Temporal.PlainDate.from('2026-12-15');
  const j15MaintenantJ15 = Temporal.PlainDate.from('2026-11-30'); // J-15

  it("statut payee → false (déjà payée, pas d'alerte)", () => {
    const d = declCfe({ statut: 'payee', echeance: '2026-12-15' });
    expect(estAlerteActive(d, j15MaintenantJ15)).toBe(false);
  });

  it('statut exoneree_premiere_annee → false', () => {
    const d = declCfe({ statut: 'exoneree_premiere_annee', echeance: '2026-12-15' });
    expect(estAlerteActive(d, j15MaintenantJ15)).toBe(false);
  });

  it('statut exoneree_commune → false', () => {
    const d = declCfe({ statut: 'exoneree_commune', echeance: '2026-12-15' });
    expect(estAlerteActive(d, j15MaintenantJ15)).toBe(false);
  });

  it("statut non_deposee + J-30 → true (limite incluse)", () => {
    const d = declCfe({ statut: 'non_deposee', echeance: '2026-12-15' });
    const maintenant = j15Echeance.subtract({ days: 30 });
    expect(estAlerteActive(d, maintenant)).toBe(true);
  });

  it("statut non_deposee + J-31 → false (hors fenêtre)", () => {
    const d = declCfe({ statut: 'non_deposee', echeance: '2026-12-15' });
    const maintenant = j15Echeance.subtract({ days: 31 });
    expect(estAlerteActive(d, maintenant)).toBe(false);
  });

  it("statut deposee + J-7 → true", () => {
    const d = declCfe({ statut: 'deposee', echeance: '2026-12-15' });
    const maintenant = j15Echeance.subtract({ days: 7 });
    expect(estAlerteActive(d, maintenant)).toBe(true);
  });

  it('statut non_deposee + J+10 (échéance dépassée 10j) → true (destructive)', () => {
    const d = declCfe({ statut: 'non_deposee', echeance: '2026-12-15' });
    const maintenant = j15Echeance.add({ days: 10 });
    expect(estAlerteActive(d, maintenant)).toBe(true);
  });

  it('statut non_deposee + J-100 → false (trop loin)', () => {
    const d = declCfe({ statut: 'non_deposee', echeance: '2026-12-15' });
    const maintenant = j15Echeance.subtract({ days: 100 });
    expect(estAlerteActive(d, maintenant)).toBe(false);
  });
});

describe('calculerAlertesCfe — agrégation + tri', () => {
  it('liste mixte → ne retient que les CFE actives', () => {
    const declarations = [
      declCfe({ statut: 'payee', echeance: '2026-12-15' }),
      declCfe({ statut: 'non_deposee', echeance: '2026-12-15' }),
      declCfe({ statut: 'exoneree_commune', echeance: '2026-12-15' }),
    ];
    const maintenant = Temporal.PlainDate.from('2026-11-30'); // J-15
    const alertes = calculerAlertesCfe(declarations, maintenant);
    expect(alertes).toHaveLength(1);
    expect(alertes[0]!.statutCfe).toBe('non_deposee');
    expect(alertes[0]!.joursRestants).toBe(15);
  });

  it('liste vide → []', () => {
    const alertes = calculerAlertesCfe([], Temporal.PlainDate.from('2026-11-30'));
    expect(alertes).toEqual([]);
  });

  it('tri par joursRestants ASC (plus urgent en premier)', () => {
    const declarations = [
      declCfe({ statut: 'non_deposee', echeance: '2026-12-31' }), // J-30
      declCfe({ statut: 'non_deposee', echeance: '2026-12-08' }), // J-7 plus urgent
      declCfe({ statut: 'non_deposee', echeance: '2026-12-15' }), // J-14
    ];
    const maintenant = Temporal.PlainDate.from('2026-12-01');
    const alertes = calculerAlertesCfe(declarations, maintenant);
    expect(alertes.map((a) => a.joursRestants)).toEqual([7, 14, 30]);
  });
});
