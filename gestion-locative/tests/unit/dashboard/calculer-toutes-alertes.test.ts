/**
 * Tests unitaires — use case calculerToutesAlertes (Phase 7 / DAS-02 / D-AL-02).
 *
 * Stratégie : doubles in-memory (objets littéraux implémentant les interfaces domaine),
 * ClockFixe(2026-06-11), builders domaine. Aucun infra, aucun Fastify.
 *
 * Couverture :
 *   Test 1 — Clock-driven : date lue UNE fois via deps.clock.aujourdhui()
 *   Test 2 — Fusion 4 sources : 4 alertes (1 cfe + 1 irl + 1 diagnostic + 1 fin_bail)
 *   Test 3 — Tri ASC global : [diagnostic(5), irl(10), fin_bail(20), cfe(30)]
 *   Test 4 — IRL exercice courant exclu : bail indexé 2026 → 0 alerte IRL
 *   Test 5 — CFE agrégée par bien : cfeRepo.listerParBien appelé pour chaque bien
 *   Test 6 — Vide : repos vides → []
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { calculerToutesAlertes } from '../../../src/application/dashboard/calculer-toutes-alertes.js';
import type { CalculerToutesAlertesDeps } from '../../../src/application/dashboard/calculer-toutes-alertes.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { unBienValide, unDiagnosticDpeValide } from '../../_builders/patrimoine.js';
import { unBailIndexableValide, uneBailIndexationAppliqueeValide } from '../../_builders/locatif.js';
import { uneDeclarationCfe } from '../../_builders/fiscalite.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../../src/domain/locatif/bail-repository.js';
import type { DeclarationCfeRepository } from '../../../src/domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { BailIndexationRepository } from '../../../src/domain/locatif/bail-indexation-repository.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import type { Bien } from '../../../src/domain/patrimoine/bien.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';
import type { DeclarationCfe } from '../../../src/domain/fiscalite/cfe/declaration-cfe.js';
import type { BailIndexation } from '../../../src/domain/locatif/bail-indexation.js';

const MAINTENANT = Temporal.PlainDate.from('2026-06-11');
const CLOCK = ClockFixe.du('2026-06-11');

function makeDeps(opts: {
  biens?: Bien[];
  baux?: Bail[];
  cfe?: Map<string, DeclarationCfe[]>;
  indexations?: Map<string, BailIndexation | null>;
}): CalculerToutesAlertesDeps {
  const { biens = [], baux = [], cfe = new Map(), indexations = new Map() } = opts;

  const bienRepo: BienRepository = {
    listerTous: async () => biens,
    trouverParId: async () => null,
    enregistrer: async () => { throw new Error('non utilisé'); },
    supprimer: async () => { throw new Error('non utilisé'); },
  };

  const bailRepo: BailRepository = {
    listerTous: async () => baux,
    trouverParId: async () => null,
    listerParLocataire: async () => [],
    enregistrer: async () => { throw new Error('non utilisé'); },
    supprimer: async () => { throw new Error('non utilisé'); },
  };

  const cfeRepo: DeclarationCfeRepository = {
    listerParBien: async (bienId) => cfe.get(bienId as string) ?? [],
    enregistrer: async () => { throw new Error('non utilisé'); },
    trouverParId: async () => { throw new Error('non utilisé'); },
    trouverParBienMillesime: async () => { throw new Error('non utilisé'); },
  };

  const bailIndexationRepo: BailIndexationRepository = {
    dernierePourBail: async (bailId) => indexations.get(bailId as string) ?? null,
    enregistrer: async () => { throw new Error('non utilisé'); },
    trouverParId: async () => { throw new Error('non utilisé'); },
    listerParBail: async () => { throw new Error('non utilisé'); },
  };

  return { bienRepo, bailRepo, cfeRepo, bailIndexationRepo, clock: CLOCK };
}

describe('calculerToutesAlertes', () => {
  it('Test 1 — Clock-driven : lit la date UNE fois via clock.aujourdhui()', async () => {
    // Bien avec CFE J-30 (dateEcheancePaiement = 2026-07-11)
    const bien = unBienValide();
    const decl = uneDeclarationCfe({
      bienId: bien.id,
      statut: 'non_deposee',
      dateEcheancePaiement: MAINTENANT.add({ days: 30 }),
    });
    const clockSpy = { ...CLOCK, aujourdhui: vi.fn(() => MAINTENANT) };
    const deps: CalculerToutesAlertesDeps = {
      ...makeDeps({ biens: [bien], cfe: new Map([[bien.id as string, [decl]]]) }),
      clock: clockSpy,
    };

    await calculerToutesAlertes(deps);

    expect(clockSpy.aujourdhui).toHaveBeenCalledTimes(1);
  });

  it('Test 2 — Fusion 4 sources : 4 alertes (cfe + irl + diagnostic + fin_bail)', async () => {
    // CFE: J-30 (2026-07-11)
    const bienCfe = unBienValide();
    const decl = uneDeclarationCfe({
      bienId: bienCfe.id,
      statut: 'non_deposee',
      dateEcheancePaiement: MAINTENANT.add({ days: 30 }),
    });

    // Diagnostic DPE: J-5 (expire 2026-06-16 → dateEmission = 2016-06-16)
    const bienDiag = unBienValide({
      diagnostics: [
        unDiagnosticDpeValide({ dateEmission: Temporal.PlainDate.from('2016-06-16') }),
      ],
    });

    // IRL only (J+10): anniversary=2026-06-21, dureeMois=36 → fin=2028-06-21 (hors fenêtre fin_bail)
    const bailIrl = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
      dureeMois: 36,
    });

    // Fin de bail only (J+20): fin=2026-07-01, anniversary=2026-08-01 (J+51, hors fenêtre IRL)
    const bailFin = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2024-08-01'),
      dureeMois: 23,
    });

    const deps = makeDeps({
      biens: [bienCfe, bienDiag],
      baux: [bailIrl, bailFin],
      cfe: new Map([[bienCfe.id as string, [decl]]]),
    });

    const alertes = await calculerToutesAlertes(deps);

    const types = alertes.map((a) => a.type);
    expect(types).toContain('cfe');
    expect(types).toContain('irl');
    expect(types).toContain('diagnostic');
    expect(types).toContain('fin_bail');
    expect(alertes.length).toBe(4);
  });

  it('Test 3 — Tri ASC global : [diagnostic(5), irl(10), fin_bail(20), cfe(30)]', async () => {
    // CFE: J-30
    const bienCfe = unBienValide();
    const decl = uneDeclarationCfe({
      bienId: bienCfe.id,
      statut: 'non_deposee',
      dateEcheancePaiement: MAINTENANT.add({ days: 30 }),
    });

    // Diagnostic DPE: J-5 (expire 2026-06-16)
    const bienDiag = unBienValide({
      diagnostics: [
        unDiagnosticDpeValide({ dateEmission: Temporal.PlainDate.from('2016-06-16') }),
      ],
    });

    // IRL only (J+10): anniversary=2026-06-21, dureeMois=36 → fin=2028-06-21 (hors fenêtre fin_bail)
    const bailIrl = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
      dureeMois: 36,
    });

    // Fin de bail only (J+20): fin=2026-07-01, anniversary=2026-08-01 (J+51, hors fenêtre IRL)
    const bailFin = unBailIndexableValide({
      bienId: bienDiag.id,
      dateDebut: Temporal.PlainDate.from('2024-08-01'),
      dureeMois: 23,
    });

    const deps = makeDeps({
      biens: [bienCfe, bienDiag],
      baux: [bailIrl, bailFin],
      cfe: new Map([[bienCfe.id as string, [decl]]]),
    });

    const alertes = await calculerToutesAlertes(deps);

    expect(alertes.length).toBe(4);
    const jours = alertes.map((a) => a.joursRestants);
    expect(jours).toEqual([...jours].sort((a, b) => a - b));
    // Ordre attendu : diagnostic(5) < irl(10) < fin_bail(20) < cfe(30)
    expect(alertes[0]!.type).toBe('diagnostic');
    expect(alertes[1]!.type).toBe('irl');
    expect(alertes[2]!.type).toBe('fin_bail');
    expect(alertes[3]!.type).toBe('cfe');
  });

  it('Test 4 — IRL exercice courant exclu : bail indexé 2026 → 0 alerte IRL', async () => {
    // Bail avec anniversaire dans la fenêtre
    const bien = unBienValide();
    const bail = unBailIndexableValide({
      bienId: bien.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
    });

    // Indexation existante pour 2026 (exercice courant)
    const indexation2026 = uneBailIndexationAppliqueeValide({
      bailId: bail.id,
      dateEffet: Temporal.PlainDate.from('2026-05-01'), // year === 2026
    });

    const deps = makeDeps({
      biens: [bien],
      baux: [bail],
      indexations: new Map([[bail.id as string, indexation2026]]),
    });

    const alertes = await calculerToutesAlertes(deps);
    const alertesIrl = alertes.filter((a) => a.type === 'irl');
    expect(alertesIrl).toHaveLength(0);
  });

  it('Test 4b — IRL alerte active : bail indexé 2025 → alerte IRL retournée', async () => {
    const bien = unBienValide();
    const bail = unBailIndexableValide({
      bienId: bien.id,
      dateDebut: Temporal.PlainDate.from('2025-06-21'),
    });

    // Indexation année 2025 (pas l'exercice courant 2026)
    const indexation2025 = uneBailIndexationAppliqueeValide({
      bailId: bail.id,
      dateEffet: Temporal.PlainDate.from('2025-06-21'), // year === 2025
    });

    const deps = makeDeps({
      biens: [bien],
      baux: [bail],
      indexations: new Map([[bail.id as string, indexation2025]]),
    });

    const alertes = await calculerToutesAlertes(deps);
    const alertesIrl = alertes.filter((a) => a.type === 'irl');
    expect(alertesIrl.length).toBeGreaterThanOrEqual(1);
  });

  it('Test 5 — CFE agrégée par bien : listerParBien appelé pour chaque bien', async () => {
    const bien1 = unBienValide();
    const bien2 = unBienValide();
    const listerParBienSpy = vi.fn(async (_bienId: BienId | string) => []);

    const deps: CalculerToutesAlertesDeps = {
      ...makeDeps({ biens: [bien1, bien2] }),
      cfeRepo: {
        listerParBien: listerParBienSpy,
        enregistrer: async () => { throw new Error('non utilisé'); },
        trouverParId: async () => { throw new Error('non utilisé'); },
        trouverParBienMillesime: async () => { throw new Error('non utilisé'); },
      },
    };

    await calculerToutesAlertes(deps);

    expect(listerParBienSpy).toHaveBeenCalledTimes(2);
    const calledIds = listerParBienSpy.mock.calls.map((c) => c[0] as string);
    expect(calledIds).toContain(bien1.id as string);
    expect(calledIds).toContain(bien2.id as string);
  });

  it('Test 6 — Vide : tous repos vides → []', async () => {
    const deps = makeDeps({});
    const alertes = await calculerToutesAlertes(deps);
    expect(alertes).toEqual([]);
  });
});
