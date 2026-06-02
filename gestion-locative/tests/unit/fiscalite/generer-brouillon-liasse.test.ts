/**
 * Tests unitaires — Use case `genererBrouillonLiasse` (Phase 6 / FIS-05 / Task 2).
 *
 * Couvre :
 *   - Cas heureux régime réel : DTO produit avec sections 2031-SD + 2033-A/B/C/D.
 *   - Fail-fast erreurs : DeclarationIntrouvableLiasse, BailleurIntrouvableLiasse,
 *     MappingLiasseAbsent (propagé du provider).
 *   - Régime micro-BIC : throw RegimeMicroBicNonSupporteWave1 (Plan 02 ajoutera 2042-C-PRO).
 *   - Invariant cohérence flux 2033-B / 2033-C : `dotation amortissement` =
 *     `dotation exercice 2033-C` = `decl.dotationAmortissement.enEuros()`.
 *   - Anti-pattern §3 RESEARCH.md : `amelioration` JAMAIS sur la case "Autres
 *     charges externes" (immobilisée en 2033-C, pas une charge d'exploitation).
 *   - `bailleurNom` du DTO = nom du bailleur singleton récupéré via `bailleurRepo`.
 *
 * Pattern test : exporter-csv-fiscal.test.ts (mocks vi.fn + fakes Map).
 */

import { describe, it, expect, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import type { DeclarationAnnuelleRepository } from '../../../src/domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../../src/domain/identite/bailleur-repository.js';
import {
  MappingLiasseProviderEnMemoire,
} from '../../../src/domain/fiscalite/liasse/mapping-liasse-provider.js';
import {
  genererBrouillonLiasse,
  DeclarationIntrouvableLiasse,
  BailleurIntrouvableLiasse,
  RegimeMicroBicNonSupporteWave1,
} from '../../../src/application/fiscalite/generer-brouillon-liasse.js';
import { MappingLiasseAbsent } from '../../../src/domain/fiscalite/erreurs.js';
import { MappingLiasseProviderFake } from '../../_fakes/mapping-liasse-provider-fake.js';
import { unBailleurValide } from '../../_builders/identite.js';

const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const DECL_ID = crypto.randomUUID() as DeclarationAnnuelleId;

function uneDeclarationReel(opts: {
  recettes?: number;
  dotation?: number;
  entretien?: number;
  amelioration?: number;
  chargeCourante?: number;
  ardGenere?: number;
  ardConsomme?: number;
  exercice?: number;
}): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: opts.exercice ?? 2026,
    regimeApplique: 'reel',
    recettesTotales: Money.fromEuros(opts.recettes ?? 12_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(opts.entretien ?? 0),
      amelioration: Money.fromEuros(opts.amelioration ?? 0),
      charge_courante_periodique: Money.fromEuros(opts.chargeCourante ?? 0),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.fromEuros(opts.dotation ?? 3_500),
    ardGenere: Money.fromEuros(opts.ardGenere ?? 0),
    ardConsomme: Money.fromEuros(opts.ardConsomme ?? 0),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[{"type":"gros_oeuvre","montantHt":20000000}]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

function uneDeclarationMicroBic(): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    recettesTotales: Money.fromEuros(40_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.zero(),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

function makeDeclRepo(decl: DeclarationAnnuelle | null): DeclarationAnnuelleRepository {
  return {
    enregistrer: vi.fn(),
    trouverParId: vi.fn().mockResolvedValue(decl),
    trouverParBailleurExercice: vi.fn(),
    listerParBailleur: vi.fn(),
  };
}

function makeBailleurRepoOK(): BailleurRepository {
  return {
    trouver: vi.fn().mockResolvedValue(unBailleurValide({ nomComplet: 'Marie Curie' })),
    enregistrer: vi.fn(),
  } as unknown as BailleurRepository;
}

function makeBailleurRepoVide(): BailleurRepository {
  return {
    trouver: vi.fn().mockResolvedValue(null),
    enregistrer: vi.fn(),
  } as unknown as BailleurRepository;
}

describe('genererBrouillonLiasse — use case régime réel (Phase 6 / FIS-05)', () => {
  it('Test 1 : déclaration introuvable → throw DeclarationIntrouvableLiasse', async () => {
    const declRepo = makeDeclRepo(null);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    await expect(
      genererBrouillonLiasse({ declarationId: DECL_ID }, { declRepo, bailleurRepo, mappingProvider }),
    ).rejects.toThrow(DeclarationIntrouvableLiasse);
  });

  it('Test 2 : bailleur singleton non configuré → throw BailleurIntrouvableLiasse', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoVide();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    await expect(
      genererBrouillonLiasse({ declarationId: DECL_ID }, { declRepo, bailleurRepo, mappingProvider }),
    ).rejects.toThrow(BailleurIntrouvableLiasse);
  });

  it('Test 3 : mapping millésime non couvert → MappingLiasseAbsent propage (fail-fast)', async () => {
    // Déclaration sur exercice 2027, mapping ne couvre que 2026
    const decl = uneDeclarationReel({ exercice: 2026 });
    // override via toProps n'est pas dispo — on triche en castant le repo pour renvoyer
    // une décl. dont l'exercice est 2027 (au sens du provider fake : exercice 2027 lèvera).
    const declWith2027 = DeclarationAnnuelle.creer({
      ...decl.toProps(),
      exercice: 2027,
      seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
    });
    const declRepo = makeDeclRepo(declWith2027);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    await expect(
      genererBrouillonLiasse({ declarationId: DECL_ID }, { declRepo, bailleurRepo, mappingProvider }),
    ).rejects.toThrow(MappingLiasseAbsent);
  });

  it('Test 4 : régime micro-BIC Wave 1 → throw RegimeMicroBicNonSupporteWave1', async () => {
    const decl = uneDeclarationMicroBic();
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    await expect(
      genererBrouillonLiasse({ declarationId: DECL_ID }, { declRepo, bailleurRepo, mappingProvider }),
    ).rejects.toThrow(RegimeMicroBicNonSupporteWave1);
  });

  it('Test 5 : régime réel → DTO contient regimeApplique=reel + bailleurNom du repo + clotureLe du snapshot', async () => {
    const decl = uneDeclarationReel({ recettes: 12_000 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    expect(dto.regimeApplique).toBe('reel');
    expect(dto.bailleurNom).toBe('Marie Curie');
    expect(dto.exercice).toBe(2026);
    expect(dto.clotureLe.toString()).toBe('2026-12-31');
  });

  it('Test 6 : DTO contient les 5 sections V1 (2031-SD + 2033-A/B/C/D) dans cet ordre', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const annexes = dto.sections.map((s) => s.annexe);
    expect(annexes).toEqual(['2031-SD', '2033-A', '2033-B', '2033-C', '2033-D']);
  });

  it('Test 7 : recettes 12 000 € → case 2033-B "FC" porte 12 000 € (snapshot fait foi)', async () => {
    const decl = uneDeclarationReel({ recettes: 12_000 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2033B = dto.sections.find((s) => s.annexe === '2033-B');
    expect(section2033B).toBeDefined();
    const caseFC = section2033B!.cases.find((c) => c.numero === 'FC');
    expect(caseFC).toBeDefined();
    expect(caseFC!.valeur?.toCentimes()).toBe(1_200_000n);
  });

  it('Test 8 : dotation 3 500 € → case 2033-B "FY" porte 3 500 € (snapshot fait foi)', async () => {
    const decl = uneDeclarationReel({ recettes: 12_000, dotation: 3_500 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2033B = dto.sections.find((s) => s.annexe === '2033-B');
    const caseFY = section2033B!.cases.find((c) => c.numero === 'FY');
    expect(caseFY).toBeDefined();
    expect(caseFY!.valeur?.toCentimes()).toBe(350_000n);
  });

  it('Test 9 : Invariant cohérence flux — dotation 2033-B = dotation 2033-C (même Money)', async () => {
    const decl = uneDeclarationReel({ dotation: 4_200 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const dotation2033B = dto.sections
      .find((s) => s.annexe === '2033-B')!
      .cases.find((c) => c.numero === 'FY')!.valeur;
    const dotation2033C = dto.sections
      .find((s) => s.annexe === '2033-C')!
      .cases.find((c) => c.numero === 'KE')!.valeur;
    expect(dotation2033B?.toCentimes()).toBe(420_000n);
    expect(dotation2033C?.toCentimes()).toBe(420_000n);
  });

  it('Test 10 : Bénéfice fiscal — case 2031-SD "CB" non vide, "CC" déficit null', async () => {
    // recettes 12k - dotation 3,5k - charges 0 = bénéfice 8,5k > 0
    const decl = uneDeclarationReel({ recettes: 12_000, dotation: 3_500 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2031 = dto.sections.find((s) => s.annexe === '2031-SD');
    const caseBenefice = section2031!.cases.find((c) => c.numero === 'CB');
    const caseDeficit = section2031!.cases.find((c) => c.numero === 'CC');
    expect(caseBenefice!.valeur?.toCentimes()).toBe(850_000n); // 8 500 €
    expect(caseDeficit!.valeur).toBe(null);
  });

  it('Test 11 : Déficit fiscal — case 2031-SD "CC" porte valeur absolue, "CB" null', async () => {
    // recettes 5k - dotation 8k - charges 2k = -5k (déficit 5k)
    const decl = uneDeclarationReel({
      recettes: 5_000,
      dotation: 8_000,
      entretien: 2_000,
    });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2031 = dto.sections.find((s) => s.annexe === '2031-SD');
    const caseBenefice = section2031!.cases.find((c) => c.numero === 'CB');
    const caseDeficit = section2031!.cases.find((c) => c.numero === 'CC');
    expect(caseBenefice!.valeur).toBe(null);
    expect(caseDeficit!.valeur?.toCentimes()).toBe(500_000n); // 5 000 € valeur absolue
  });

  it('Test 12 : Anti-pattern §3 — amelioration JAMAIS dans "FK" (immobilisée 2033-C)', async () => {
    // entretien 1k + amelioration 10k + charge_courante 500 → FK = 1k + 500 (pas amelioration)
    const decl = uneDeclarationReel({
      recettes: 50_000,
      entretien: 1_000,
      amelioration: 10_000,
      chargeCourante: 500,
    });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const caseFK = dto.sections
      .find((s) => s.annexe === '2033-B')!
      .cases.find((c) => c.numero === 'FK')!.valeur;
    expect(caseFK?.toCentimes()).toBe(150_000n); // 1 500 € (entretien + charge_courante)
  });

  it('Test 13 : 2033-A bandeauPostesManuels=true + au moins une case "à compléter manuellement"', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2033A = dto.sections.find((s) => s.annexe === '2033-A');
    expect(section2033A?.bandeauPostesManuels).toBe(true);
    const casesAvecMention = section2033A!.cases.filter(
      (c) => c.mention === 'à compléter manuellement',
    );
    expect(casesAvecMention.length).toBeGreaterThan(0);
    casesAvecMention.forEach((c) => expect(c.valeur).toBe(null));
  });

  it('Test 14 : 2033-A bandeau n\'est pas posé sur les autres sections (2031-SD/2033-B/C/D)', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    ['2031-SD', '2033-B', '2033-C', '2033-D'].forEach((annexe) => {
      const s = dto.sections.find((sec) => sec.annexe === annexe)!;
      expect(s.bandeauPostesManuels ?? false).toBe(false);
    });
  });

  it('Test 15 : ARD généré + consommé reportent vers 2033-D (WG/WH)', async () => {
    const decl = uneDeclarationReel({ ardGenere: 1_200, ardConsomme: 800 });
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2033D = dto.sections.find((s) => s.annexe === '2033-D');
    const wg = section2033D!.cases.find((c) => c.numero === 'WG');
    const wh = section2033D!.cases.find((c) => c.numero === 'WH');
    expect(wg!.valeur?.toCentimes()).toBe(120_000n);
    expect(wh!.valeur?.toCentimes()).toBe(80_000n);
  });

  it('Test 16 : 2042-C-PRO non rendu Wave 1 (régime réel — micro-BIC en Plan 02 uniquement)', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const section2042 = dto.sections.find((s) => s.annexe === '2042-C-PRO');
    expect(section2042).toBeUndefined();
  });

  it('Test 17 : MappingLiasseProviderFake injectable → fail-fast millésime non couvert', async () => {
    const decl = uneDeclarationReel({});
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    // Fake provider qui ne couvre que 2025 → exercice 2026 lèvera
    const mappingProvider = new MappingLiasseProviderFake(new Map());

    await expect(
      genererBrouillonLiasse({ declarationId: DECL_ID }, { declRepo, bailleurRepo, mappingProvider }),
    ).rejects.toThrow(MappingLiasseAbsent);
  });
});

// ─── Plan 06-02 — micro-BIC (FIS-05 slice 2) ──────────────────────────────────

function uneDeclarationMicroBicAvec(recettes: number): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    recettesTotales: Money.fromEuros(recettes),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.zero(),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}

describe('genererBrouillonLiasse — régime micro-BIC (Plan 06-02 / D-L6.2)', () => {
  it('Test M1 : régime micro → DTO regimeApplique=micro_bic + une seule section 2042-C-PRO', async () => {
    const decl = uneDeclarationMicroBicAvec(18_000);
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    expect(dto.regimeApplique).toBe('micro_bic');
    expect(dto.sections).toHaveLength(1);
    expect(dto.sections[0]!.annexe).toBe('2042-C-PRO');
  });

  it('Test M2 : case "5NI" porte les recettes BRUTES (pas le net après abattement 50 %)', async () => {
    const decl = uneDeclarationMicroBicAvec(18_000);
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const case5NI = dto.sections[0]!.cases.find((c) => c.numero === '5NI');
    expect(case5NI).toBeDefined();
    expect(case5NI!.valeur?.egale(Money.fromEuros(18_000))).toBe(true);
    // Anti-pattern §3 + R4.3 : pas de calcul d'abattement côté app
    expect(case5NI!.valeur?.egale(Money.fromEuros(9_000))).toBe(false);
  });

  it("Test M3 : pour micro, AUCUNE section '2031-SD' ni '2033-*' n'est rendue", async () => {
    const decl = uneDeclarationMicroBicAvec(18_000);
    const declRepo = makeDeclRepo(decl);
    const bailleurRepo = makeBailleurRepoOK();
    const mappingProvider = new MappingLiasseProviderEnMemoire();

    const dto = await genererBrouillonLiasse(
      { declarationId: DECL_ID },
      { declRepo, bailleurRepo, mappingProvider },
    );

    const annexes = dto.sections.map((s) => s.annexe);
    expect(annexes).not.toContain('2031-SD');
    expect(annexes).not.toContain('2033-A');
    expect(annexes).not.toContain('2033-B');
    expect(annexes).not.toContain('2033-C');
    expect(annexes).not.toContain('2033-D');
  });
});
