/**
 * Tests unitaires — Use case listerVueConsolidee (D-FIS-G5.1, D-LOCK-2).
 *
 * RED phase : tests écrits avant l'implémentation.
 *
 * Sources :
 *   - D-FIS-G5.1 : vue consolidée multi-bien avec ventilation RÉELLE par bien
 *   - D-LOCK-2 : seuils appliqués sur le TOTAL consolidé
 *   - CGI art. 155 IV : critères LMP (SEUIL_LMP_RECETTES = 23 000 €)
 *   - CGI art. 50-0 : seuil micro-BIC (SEUIL_MICRO_BIC_LONGUE_DUREE = 83 600 €)
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BienId, BailleurId } from '../../../src/domain/_shared/identifiants.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { Bailleur } from '../../../src/domain/identite/bailleur.js';
import { Adresse } from '../../../src/domain/_shared/adresse.js';
import type { BienRepository } from '../../../src/domain/patrimoine/bien-repository.js';
import type { RecettesRepository } from '../../../src/domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../../src/domain/fiscalite/charges-repository.js';
import type { ComposantRepository } from '../../../src/domain/fiscalite/composant-repository.js';
import type { ValorisationFiscaleRepository } from '../../../src/domain/fiscalite/composant-repository.js';
import type { TableauAmortissementRepository } from '../../../src/domain/fiscalite/tableau-amortissement-repository.js';
import type { BailleurRepository } from '../../../src/domain/identite/bailleur-repository.js';
import { Bien } from '../../../src/domain/patrimoine/bien.js';
import { Lot } from '../../../src/domain/patrimoine/lot.js';
import { listerVueConsolidee } from '../../../src/application/fiscalite/lister-vue-consolidee.js';

const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const BIEN_ID_1 = crypto.randomUUID() as BienId;
const BIEN_ID_2 = crypto.randomUUID() as BienId;
const EXERCICE = 2026;

function unBailleurSingleton(revenusActifs: Money | null = null): Bailleur {
  return Bailleur.creer({
    id: BAILLEUR_ID,
    nomComplet: 'Jean Bailleur',
    adresse: Adresse.creer({ rue: '1 rue test', codePostal: '75001', ville: 'Paris' }),
    revenusActifsAnnuelsCourant: revenusActifs,
  });
}

function unBienSimple(bienId: BienId, adresse = '1 rue test'): Bien {
  const lot = Lot.creer({ designation: 'T2', surface: 40, type: 'appartement', etage: 1 });
  return Bien.creer({
    id: bienId,
    adresse: Adresse.creer({ rue: adresse, codePostal: '75001', ville: 'Paris' }),
    surface: 40,
    type: 'appartement',
    anneeConstruction: 2000,
    lots: [lot],
  });
}

function makeDeps(opts: {
  biens: Bien[];
  recettesBien: Map<BienId, Money>;
  chargesBien: Map<BienId, Money>;
  bailleur?: Bailleur;
}): Parameters<typeof listerVueConsolidee>[2] {
  const bailleur = opts.bailleur ?? unBailleurSingleton();

  const bienRepo: BienRepository = {
    enregistrer: vi.fn(),
    trouverParId: vi.fn(),
    listerTous: vi.fn().mockResolvedValue(opts.biens),
    supprimer: vi.fn(),
  };

  const recettesRepo: RecettesRepository = {
    sommeRecettesAnnuelles: vi.fn().mockResolvedValue(Money.zero()),
    sommeRecettesAnnuellesParBien: vi.fn().mockImplementation(async (bienId: BienId) => {
      return opts.recettesBien.get(bienId) ?? Money.zero();
    }),
  };

  const chargesRepo: ChargesRepository = {
    sommeChargesParCategorie: vi.fn().mockResolvedValue({
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    }),
    sommeChargesParBien: vi.fn().mockImplementation(async (bienId: BienId) => {
      return opts.chargesBien.get(bienId) ?? Money.zero();
    }),
  };

  const composantRepo: ComposantRepository = {
    enregistrer: vi.fn(),
    enregistrerBatch: vi.fn(),
    trouverParId: vi.fn(),
    listerActifsParBien: vi.fn().mockResolvedValue([]),
    listerParBien: vi.fn().mockResolvedValue([]),
    listerActifsPourBailleur: vi.fn().mockResolvedValue([]),
  };

  const valorisationRepo: ValorisationFiscaleRepository = {
    enregistrer: vi.fn(),
    trouverParBien: vi.fn().mockResolvedValue(null),
    trouverParId: vi.fn().mockResolvedValue(null),
  };

  const tableauAmortRepo: TableauAmortissementRepository = {
    enregistrerBatch: vi.fn(),
    listerParBienExercice: vi.fn().mockResolvedValue([]),
    dernierArdCumule: vi.fn().mockResolvedValue(Money.zero()),
    dernierArdCumuleBailleur: vi.fn().mockResolvedValue(Money.zero()),
  };

  const bailleurRepo: BailleurRepository = {
    enregistrer: vi.fn(),
    trouver: vi.fn().mockResolvedValue(bailleur),
    mettreAJour: vi.fn(),
  };

  return {
    bienRepo,
    recettesRepo,
    chargesRepo,
    composantRepo,
    valorisationRepo,
    tableauAmortRepo,
    bailleurRepo,
    regleFiscale: REGLES_2026,
  };
}

describe('listerVueConsolidee — use case (D-FIS-G5.1)', () => {
  it('Test 4 : 0 biens actifs → biens=[], totaux=zero, verdictLmp=lmnp_confirme', async () => {
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };
    const deps = makeDeps({ biens: [], recettesBien: new Map(), chargesBien: new Map() });

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    expect(result.biens).toHaveLength(0);
    expect(result.totaux.recettes.egale(Money.zero())).toBe(true);
    expect(result.totaux.charges.egale(Money.zero())).toBe(true);
    expect(result.verdictLmp).toBe('lmnp_confirme');
    expect(result.anneeCourante).toBe(EXERCICE);
  });

  it('Test 5 : 2 biens (B1=50k/5k, B2=40k/10k) → totaux 90k/15k, ventilation réelle, régime réel (>83.6k)', async () => {
    const b1 = unBienSimple(BIEN_ID_1, '1 rue paris');
    const b2 = unBienSimple(BIEN_ID_2, '2 rue lyon');
    const recettesBien = new Map<BienId, Money>([
      [BIEN_ID_1, Money.fromEuros(50_000)],
      [BIEN_ID_2, Money.fromEuros(40_000)],
    ]);
    const chargesBien = new Map<BienId, Money>([
      [BIEN_ID_1, Money.fromEuros(5_000)],
      [BIEN_ID_2, Money.fromEuros(10_000)],
    ]);
    // foyer 100k → LMNP (recettes 90k < foyer 100k)
    const bailleur = unBailleurSingleton(Money.fromEuros(100_000));
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };
    const deps = makeDeps({ biens: [b1, b2], recettesBien, chargesBien, bailleur });

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    expect(result.biens).toHaveLength(2);
    // Ventilation réelle par bien (D-FIS-G5.1)
    const bienB1 = result.biens.find((b) => b.bienId === BIEN_ID_1)!;
    const bienB2 = result.biens.find((b) => b.bienId === BIEN_ID_2)!;
    expect(bienB1.recettes.egale(Money.fromEuros(50_000))).toBe(true);
    expect(bienB2.recettes.egale(Money.fromEuros(40_000))).toBe(true);
    // Totaux consolidés
    expect(result.totaux.recettes.egale(Money.fromEuros(90_000))).toBe(true);
    expect(result.totaux.charges.egale(Money.fromEuros(15_000))).toBe(true);
    // Régime réel forcé : 90k > 83.6k
    expect(result.regimeApplique).toBe('reel');
    // Verdict LMP : recettes 90k < foyer 100k → LMNP confirmé
    expect(result.verdictLmp).toBe('lmnp_confirme');
  });

  it('Test 6 : seuil exact 83 599.99 € consolidé → micro éligible', async () => {
    const b1 = unBienSimple(BIEN_ID_1);
    const recettesBien = new Map<BienId, Money>([
      [BIEN_ID_1, Money.fromCentimes(8_359_999n)], // 83 599.99 €
    ]);
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };
    const deps = makeDeps({ biens: [b1], recettesBien, chargesBien: new Map() });

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    expect(result.regimeApplique).toBe('micro_bic');
  });

  it('Test 7 : 1 bien + recettes 90k + revenus foyer 80k → verdictLmp=lmp_probable', async () => {
    const b1 = unBienSimple(BIEN_ID_1);
    const recettesBien = new Map<BienId, Money>([
      [BIEN_ID_1, Money.fromEuros(90_000)],
    ]);
    // revenus foyer 80k < recettes 90k → LMP probable
    const bailleur = unBailleurSingleton(Money.fromEuros(80_000));
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };
    const deps = makeDeps({ biens: [b1], recettesBien, chargesBien: new Map(), bailleur });

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    expect(result.verdictLmp).toBe('lmp_probable');
  });

  it('Test 7b : bien avec valorisation + composant actif → dotation calculée (lignes 134-144)', async () => {
    // Couvre le chemin : valorisation != null → composants lookupés + calculerAmortissement
    const b1 = unBienSimple(BIEN_ID_1);
    const recettesBien = new Map<BienId, Money>([[BIEN_ID_1, Money.fromEuros(50_000)]]);
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };

    const { Composant } = await import('../../../src/domain/fiscalite/composant.js');
    const { Temporal: T } = await import('@js-temporal/polyfill');
    const composantActif = Composant.creer({
      bienId: BIEN_ID_1,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: T.PlainDate.from('2026-01-01'),
      origineKind: 'initial',
      ticketId: null,
      dateSortie: null,
      motifSortie: null,
    });

    const { ValorisationFiscale: VF } = await import('../../../src/domain/fiscalite/valorisation-fiscale.js');
    const vf = VF.creer({
      bienId: BIEN_ID_1,
      prixAcquisition: Money.fromEuros(200_000),
      dateAcquisition: T.PlainDate.from('2026-01-01'),
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.zero(),
      quotePartTerrainRatio: 0.10,
      activeLe: T.PlainDateTime.from('2026-01-01T00:00:00'),
    });

    const deps = makeDeps({ biens: [b1], recettesBien, chargesBien: new Map() });
    // Override valorisation → non null pour déclencher le chemin lignes 134-144
    (deps.valorisationRepo as { trouverParBien: ReturnType<typeof vi.fn> }).trouverParBien =
      vi.fn().mockResolvedValue(vf);
    // Fournir le composant actif
    (deps.composantRepo as { listerActifsParBien: ReturnType<typeof vi.fn> }).listerActifsParBien =
      vi.fn().mockResolvedValue([composantActif]);

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    // Avec 1 composant gros_oeuvre 200k, annuité 5k → dotation > 0
    expect(result.biens[0]!.dotation.toCentimes()).toBeGreaterThan(0n);
  });

  it('Test 7c : bien avec valorisation + charges >= recettes → resultatAvantAmort = Money.zero() (ligne 136 branch)', async () => {
    // Couvre la branche chargesBien >= recettesBien dans le bloc valorisation non-null (ligne 136)
    const b1 = unBienSimple(BIEN_ID_1);
    // Charges = 60k > recettes = 50k → branch Money.zero()
    const recettesBien = new Map<BienId, Money>([[BIEN_ID_1, Money.fromEuros(50_000)]]);
    const chargesBien = new Map<BienId, Money>([[BIEN_ID_1, Money.fromEuros(60_000)]]);
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };

    const { Composant } = await import('../../../src/domain/fiscalite/composant.js');
    const { Temporal: T } = await import('@js-temporal/polyfill');
    const composantActif = Composant.creer({
      bienId: BIEN_ID_1,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: T.PlainDate.from('2026-01-01'),
      origineKind: 'initial',
      ticketId: null,
      dateSortie: null,
      motifSortie: null,
    });

    const { ValorisationFiscale: VF } = await import('../../../src/domain/fiscalite/valorisation-fiscale.js');
    const vf = VF.creer({
      bienId: BIEN_ID_1,
      prixAcquisition: Money.fromEuros(200_000),
      dateAcquisition: T.PlainDate.from('2026-01-01'),
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.zero(),
      quotePartTerrainRatio: 0.10,
      activeLe: T.PlainDateTime.from('2026-01-01T00:00:00'),
    });

    const deps = makeDeps({ biens: [b1], recettesBien, chargesBien });
    (deps.valorisationRepo as { trouverParBien: ReturnType<typeof vi.fn> }).trouverParBien =
      vi.fn().mockResolvedValue(vf);
    (deps.composantRepo as { listerActifsParBien: ReturnType<typeof vi.fn> }).listerActifsParBien =
      vi.fn().mockResolvedValue([composantActif]);

    const result = await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    // Charges > recettes → resultatAvantAmort = 0 → dotation non limitée mais resultatFiscalBien = 0
    expect(result.biens[0]!.resultatFiscal.toCentimes()).toBe(0n);
  });

  it('Test 8 : sommeRecettesAnnuellesParBien appelé 1x par bien (pas la version totale)', async () => {
    const b1 = unBienSimple(BIEN_ID_1);
    const b2 = unBienSimple(BIEN_ID_2);
    const recettesBien = new Map<BienId, Money>([
      [BIEN_ID_1, Money.fromEuros(20_000)],
      [BIEN_ID_2, Money.fromEuros(15_000)],
    ]);
    const clock = { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') };
    const deps = makeDeps({ biens: [b1, b2], recettesBien, chargesBien: new Map() });

    await listerVueConsolidee(BAILLEUR_ID, EXERCICE, deps, clock);

    // Vérifie que les méthodes PAR BIEN sont appelées (pas la version totale)
    expect(deps.recettesRepo.sommeRecettesAnnuellesParBien).toHaveBeenCalledTimes(2);
    expect(deps.chargesRepo.sommeChargesParBien).toHaveBeenCalledTimes(2);
    expect(deps.recettesRepo.sommeRecettesAnnuelles).not.toHaveBeenCalled();
  });
});
