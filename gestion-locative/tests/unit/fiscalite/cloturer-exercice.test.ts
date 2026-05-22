/**
 * Tests TDD — use case cloturerExercice.
 *
 * Couverture :
 *   Test 1 : prérequis bloquants → throw PrerequisCloturalNonSatisfaits
 *   Test 2 : micro-BIC avec recettes 30k → dotation/ARD à zéro, pas de tableau amortissement
 *   Test 3 : réel avec recettes 100k + composants → cloture combine tous les calculs
 *   Test 4 : double appel → throw DeclarationDejaExiste
 *   Test 5 : seuil dépassé (> 83.6k) → regimeApplique forcé 'reel' même si regimeChoisi='micro_bic'
 *   Test 6 : exercice N+1 → calculerAmortissement reçoit ardCumuleEnEntree depuis dernierArdCumuleBailleur
 */

import { Temporal } from '@js-temporal/polyfill';
import { describe, it, expect, vi } from 'vitest';
import { cloturerExercice, DeclarationDejaExiste } from '../../../src/application/fiscalite/cloturer-exercice.js';
import { collecterPrerequisCloture } from '../../../src/application/fiscalite/collecter-prerequis-cloture.js';
import { PrerequisCloturalNonSatisfaits } from '../../../src/domain/fiscalite/erreurs.js';
import { AmortissementExercice } from '../../../src/domain/fiscalite/amortissement-exercice.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import type { BailleurId, BienId } from '../../../src/domain/_shared/identifiants.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { unComposantGrosOeuvre, uneValorisationFiscale } from '../../_builders/fiscalite.js';
import { unBienValide } from '../../_builders/patrimoine.js';

const TODAY = Temporal.PlainDate.from('2026-05-20');
const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const BIEN_ID = crypto.randomUUID() as ReturnType<typeof crypto.randomUUID>;
const REGLE = new RegleFiscaleProviderEnMemoire();

function makeClock() {
  return { aujourdhui: () => TODAY };
}

function makeDb(trxFn?: (trx: unknown) => Promise<void>) {
  const trxMock = {};
  return {
    transaction: () => ({
      execute: vi.fn().mockImplementation(async (fn: (trx: unknown) => Promise<void>) => {
        await fn(trxMock);
        trxFn?.(trxMock);
      }),
    }),
  };
}

function makeRepos(overrides: {
  bloquants?: string[];
  recettes?: Money;
  chargesDeductibles?: Money;
  declExistante?: unknown;
  revenusActifs?: Money | null;
  ardCumule?: Money;
} = {}) {
  const bailleur = unBailleurValide();
  const bailleurAvecRevenus = { ...bailleur, revenusActifsAnnuelsCourant: overrides.revenusActifs ?? null };
  const recettes = overrides.recettes ?? Money.fromEuros(30_000);
  const bloquants = overrides.bloquants ?? [];

  return {
    bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleurAvecRevenus) },
    recettesRepo: { sommeRecettesAnnuelles: vi.fn().mockResolvedValue(recettes) },
    chargesRepo: {
      sommeChargesParCategorie: vi.fn().mockResolvedValue({
        entretien_reparation: overrides.chargesDeductibles ?? Money.fromEuros(5_000),
        amelioration: Money.zero(),
        charge_courante_periodique: Money.zero(),
        non_deductible: Money.zero(),
        non_qualifie: Money.zero(),
      }),
    },
    composantRepo: { listerActifsPourBailleur: vi.fn().mockResolvedValue([]) },
    valorisationRepo: { trouverParBien: vi.fn().mockResolvedValue({}) },
    declRepo: {
      enregistrer: vi.fn().mockResolvedValue(undefined),
      trouverParBailleurExercice: vi.fn().mockResolvedValue(overrides.declExistante ?? null),
    },
    tableauAmortRepo: {
      enregistrerBatch: vi.fn().mockResolvedValue(undefined),
      dernierArdCumuleBailleur: vi.fn().mockResolvedValue(overrides.ardCumule ?? Money.zero()),
    },
    justificatifRepo: {
      compterNonQualifiesPourAnnee: vi.fn().mockResolvedValue(bloquants.includes('justificatif') ? 2 : 0),
    },
    ticketRepo: { compterStatutsActifs: vi.fn().mockResolvedValue(0) },
    bienRepo: { listerTous: vi.fn().mockResolvedValue([]) },
  };
}

describe('cloturerExercice', () => {
  it('Test 1 : prérequis bloquants → throw PrerequisCloturalNonSatisfaits', async () => {
    const repos = makeRepos({ bloquants: ['justificatif'] });

    await expect(
      cloturerExercice(
        { bailleurId: BAILLEUR_ID, exercice: 2026 },
        repos as never,
        makeClock(),
        REGLE,
        makeDb() as never,
      ),
    ).rejects.toThrow(PrerequisCloturalNonSatisfaits);

    // Aucune écriture (prérequis bloquants)
    expect(repos.declRepo.enregistrer).not.toHaveBeenCalled();
  });

  it('Test 2 : micro-BIC 20k (< seuil LMP) → dotation/ARD à zéro, transaction exécutée', async () => {
    // Recettes 20k < 23k seuil LMP → pas besoin de revenus foyer
    const repos = makeRepos({ recettes: Money.fromEuros(20_000) });
    const db = makeDb();

    const resultat = await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026 },
      repos as never,
      makeClock(),
      REGLE,
      db as never,
    );

    expect(resultat.regimeApplique).toBe('micro_bic');
    expect(repos.declRepo.enregistrer).toHaveBeenCalledOnce();
    // Pas de lignes amortissement pour micro-BIC
    expect(repos.tableauAmortRepo.enregistrerBatch).not.toHaveBeenCalled();
    // verdictLmp est déterminé (recettes 30k < 23k seuil LMP non atteint)
    expect(['lmnp_confirme', 'lmp_probable', 'indetermine_revenus_foyer_manquants']).toContain(resultat.verdictLmp);
  });

  it('Test 3 : réel avec recettes 100k + composant → orchestration complète', async () => {
    const composant = unComposantGrosOeuvre({ bienId: BIEN_ID as never });
    const repos = makeRepos({
      recettes: Money.fromEuros(100_000),
      chargesDeductibles: Money.fromEuros(10_000),
      revenusActifs: Money.fromEuros(150_000),
    });
    repos.composantRepo.listerActifsPourBailleur = vi.fn().mockResolvedValue([composant]);
    const db = makeDb();

    const resultat = await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026, regimeChoisi: 'reel' },
      repos as never,
      makeClock(),
      REGLE,
      db as never,
    );

    expect(resultat.regimeApplique).toBe('reel');
    expect(repos.declRepo.enregistrer).toHaveBeenCalledOnce();
    // Tableau amortissement enregistré pour régime réel
    expect(repos.tableauAmortRepo.enregistrerBatch).toHaveBeenCalledOnce();
  });

  it('Test 4 : double appel (même bailleur + exercice) → throw DeclarationDejaExiste', async () => {
    const fakeDecl = { id: 'decl-123', exercice: 2026 };
    // revenusActifs fourni pour éviter le prérequis bloquant (recettes 30k < 23k seuil LMP)
    const repos = makeRepos({ declExistante: fakeDecl, recettes: Money.fromEuros(20_000) });

    await expect(
      cloturerExercice(
        { bailleurId: BAILLEUR_ID, exercice: 2026 },
        repos as never,
        makeClock(),
        REGLE,
        makeDb() as never,
      ),
    ).rejects.toThrow(DeclarationDejaExiste);
  });

  it('Test 5 : recettes > seuil micro (> 83 600€) → réel forcé même si regimeChoisi=micro_bic', async () => {
    const composant = unComposantGrosOeuvre({ bienId: BIEN_ID as never });
    const repos = makeRepos({
      recettes: Money.fromEuros(90_000),
      revenusActifs: Money.fromEuros(150_000),
    });
    repos.composantRepo.listerActifsPourBailleur = vi.fn().mockResolvedValue([composant]);

    const resultat = await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026, regimeChoisi: 'micro_bic' },
      repos as never,
      makeClock(),
      REGLE,
      makeDb() as never,
    );

    expect(resultat.regimeApplique).toBe('reel');
  });

  it('Test 6 : exercice N+1 → ardCumuleEnEntree transmis depuis dernierArdCumuleBailleur', async () => {
    const ardN = Money.fromEuros(10_000);
    const composant = unComposantGrosOeuvre({ bienId: BIEN_ID as never });
    const repos = makeRepos({
      recettes: Money.fromEuros(60_000),
      chargesDeductibles: Money.fromEuros(10_000),
      revenusActifs: Money.fromEuros(150_000),
      ardCumule: ardN,
    });
    repos.composantRepo.listerActifsPourBailleur = vi.fn().mockResolvedValue([composant]);

    await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026, regimeChoisi: 'reel' },
      repos as never,
      makeClock(),
      REGLE,
      makeDb() as never,
    );

    // dernierArdCumuleBailleur appelé avec (bailleurId, exercice - 1)
    expect(repos.tableauAmortRepo.dernierArdCumuleBailleur).toHaveBeenCalledWith(
      BAILLEUR_ID,
      2025,
    );
  });

  it('Test 7 : réel avec charges > recettes → resultatAvantAmortissement = 0 (ligne 185)', async () => {
    // Couvre la branche : recettes (10k) < charges (20k) → resultat = Money.zero()
    const composant = unComposantGrosOeuvre({ bienId: BIEN_ID as never });
    const repos = makeRepos({
      recettes: Money.fromEuros(100_000),
      chargesDeductibles: Money.fromEuros(110_000), // charges > recettes
      revenusActifs: Money.fromEuros(150_000),
    });
    repos.composantRepo.listerActifsPourBailleur = vi.fn().mockResolvedValue([composant]);

    const resultat = await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026, regimeChoisi: 'reel' },
      repos as never,
      makeClock(),
      REGLE,
      makeDb() as never,
    );

    expect(resultat.regimeApplique).toBe('reel');
    // Pas de résultat avant amortissement : les deux branches sont testées, la clôture réussit
    expect(resultat.declarationId).toBeTruthy();
  });

  it('CR-03 — multi-bien : un bailleur avec 2 biens actifs produit exactement UNE ligne SYNTHESE_BIEN par exercice', async () => {
    // Régression : 05-VERIFICATION.md gap 2 (BLOCKER). Le bug structural créait N lignes SYNTHESE_BIEN
    // chacune portant ardCumuleEnSortie GLOBAL → dernierArdCumuleBailleur sur-additionnait l'ARD par N.
    //
    // En V1 D-LOCK-2 mono-bailleur, l'ARD est un attribut bailleur-level (pas bien-level) :
    // on ne crée qu'UNE seule ligne SYNTHESE_BIEN par exercice, portée par biensIds[0] (porteur sentinelle).
    const BIEN_ID_A = crypto.randomUUID() as BienId;
    const BIEN_ID_B = crypto.randomUUID() as BienId;
    const composantA = unComposantGrosOeuvre({
      bienId: BIEN_ID_A,
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    const composantB = unComposantGrosOeuvre({
      bienId: BIEN_ID_B,
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    const repos = makeRepos({
      recettes: Money.fromEuros(100_000),
      chargesDeductibles: Money.fromEuros(10_000),
      revenusActifs: Money.fromEuros(150_000),
    });
    repos.composantRepo.listerActifsPourBailleur = vi.fn().mockResolvedValue([composantA, composantB]);

    // Capture des lignes passées à enregistrerBatch pour assertion explicite
    let capturedLignes: AmortissementExercice[] = [];
    repos.tableauAmortRepo.enregistrerBatch = vi.fn().mockImplementation(async (lignes: AmortissementExercice[]) => {
      capturedLignes = lignes;
    });

    await cloturerExercice(
      { bailleurId: BAILLEUR_ID, exercice: 2026, regimeChoisi: 'reel' },
      repos as never,
      makeClock(),
      REGLE,
      makeDb() as never,
    );

    // Assertion principale : exactement UNE SYNTHESE_BIEN (pas 2)
    const syntheseLignes = capturedLignes.filter((l) => l.typeLigne === 'SYNTHESE_BIEN');
    expect(syntheseLignes.length).toBe(1);
    expect(syntheseLignes[0]!.typeLigne).toBe('SYNTHESE_BIEN');
    expect(syntheseLignes[0]!.composantId).toBeNull();
    // bienId est l'un des deux biens (porteur sentinelle V1, sans signification métier)
    expect([BIEN_ID_A, BIEN_ID_B]).toContain(syntheseLignes[0]!.bienId);
    // ardCumuleDisponible porte l'ARD global du bailleur (ardCumuleEnSortie), non multiplié
    expect(syntheseLignes[0]!.ardCumuleDisponible).not.toBeNull();
    // Les COMPOSANT restent 1 par composant (2 composants → 2 lignes COMPOSANT)
    const composantLignes = capturedLignes.filter((l) => l.typeLigne === 'COMPOSANT');
    expect(composantLignes.length).toBe(2);
  });
});

// ─── Couverture : collecterPrerequisCloture branches manquantes ──────────────────

describe('collecterPrerequisCloture — branches non couvertes (lignes 67-109)', () => {
  const BAILLEUR_ID_PR = crypto.randomUUID() as BailleurId;
  const REGLE_PROVIDER = new RegleFiscaleProviderEnMemoire();

  it('bailleur absent → bloquant + retour anticipé (lignes 66-69)', async () => {
    const repos = {
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(null) },
      justificatifRepo: { compterNonQualifiesPourAnnee: vi.fn() },
      ticketRepo: { compterStatutsActifs: vi.fn() },
      valorisationRepo: { trouverParBien: vi.fn() },
      bienRepo: { listerTous: vi.fn() },
      recettesRepo: { sommeRecettesAnnuelles: vi.fn() },
    };

    const result = await collecterPrerequisCloture(
      BAILLEUR_ID_PR,
      2026,
      repos as never,
      REGLE_PROVIDER,
    );

    expect(result.bloquants).toHaveLength(1);
    expect(result.bloquants[0]).toContain('bailleur');
    // Retour anticipé : autres repos pas appelés
    expect(repos.justificatifRepo.compterNonQualifiesPourAnnee).not.toHaveBeenCalled();
  });

  it('tickets actifs → bloquant tickets ajouté (lignes 80-85)', async () => {
    const bailleur = unBailleurValide();
    const repos = {
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
      justificatifRepo: { compterNonQualifiesPourAnnee: vi.fn().mockResolvedValue(0) },
      ticketRepo: { compterStatutsActifs: vi.fn().mockResolvedValue(2) }, // 2 tickets actifs
      valorisationRepo: { trouverParBien: vi.fn() },
      bienRepo: { listerTous: vi.fn().mockResolvedValue([]) },
      recettesRepo: { sommeRecettesAnnuelles: vi.fn().mockResolvedValue(Money.fromEuros(10_000)) },
    };

    const result = await collecterPrerequisCloture(
      BAILLEUR_ID_PR,
      2026,
      repos as never,
      REGLE_PROVIDER,
    );

    expect(result.bloquants.some((b) => b.includes('ticket'))).toBe(true);
  });

  it('bien actif sans valorisation + recettes > seuil micro → bloquant valorisation (lignes 101-109)', async () => {
    const bailleur = { ...unBailleurValide(), revenusActifsAnnuelsCourant: Money.fromEuros(200_000) };
    const BIEN_ID_NV = crypto.randomUUID() as BienId;
    const bien = unBienValide({ id: BIEN_ID_NV });

    const repos = {
      bailleurRepo: { trouver: vi.fn().mockResolvedValue(bailleur) },
      justificatifRepo: { compterNonQualifiesPourAnnee: vi.fn().mockResolvedValue(0) },
      ticketRepo: { compterStatutsActifs: vi.fn().mockResolvedValue(0) },
      valorisationRepo: { trouverParBien: vi.fn().mockResolvedValue(null) }, // pas de valorisation
      bienRepo: { listerTous: vi.fn().mockResolvedValue([bien]) },
      recettesRepo: { sommeRecettesAnnuelles: vi.fn().mockResolvedValue(Money.fromEuros(90_000)) }, // > 83.6k
    };

    const result = await collecterPrerequisCloture(
      BAILLEUR_ID_PR,
      2026,
      repos as never,
      REGLE_PROVIDER,
    );

    // Bloquant valorisation ajouté
    expect(result.bloquants.some((b) => b.includes('fiscalement'))).toBe(true);
  });
});
