/**
 * Step definitions partagés Phase 6 — Brouillon liasse fiscale.
 *
 * Couvre :
 *   - @phase6-mapping-versionne (Task 1) : versioning + fail-fast MappingLiasseAbsent.
 *   - @phase6-liasse-reel (Task 2) : génération brouillon régime réel depuis snapshot Phase 5.
 *
 * Stratégie : appel direct au domaine + au use case `genererBrouillonLiasse`,
 * pas d'HTTP, pas de DB SQLite (fakes en mémoire). Reproduit le pattern
 * `fiscalite-cloture.steps.ts` (lecture seule des snapshots Phase 5).
 *
 * Tags : @phase6 @fis-05
 */

import { Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import {
  MappingLiasseProviderEnMemoire,
  type MappingLiasseProvider,
} from '../../../src/domain/fiscalite/liasse/mapping-liasse-provider.js';
import type { MappingLiasse2026 } from '../../../src/domain/fiscalite/liasse/mapping-liasse-2026.js';
import { MappingLiasseAbsent } from '../../../src/domain/fiscalite/erreurs.js';
import { genererBrouillonLiasse } from '../../../src/application/fiscalite/generer-brouillon-liasse.js';
import type { BrouillonLiasseDto } from '../../../src/domain/fiscalite/liasse/case-liasse.js';
import { unBailleurValide } from '../../_builders/identite.js';
import type { BailleurRepository } from '../../../src/domain/identite/bailleur-repository.js';
import type { DeclarationAnnuelleRepository } from '../../../src/domain/fiscalite/declaration-annuelle-repository.js';

interface MondeLiasse extends World {
  mapping: MappingLiasse2026 | null;
  mappingProvider: MappingLiasseProvider | null;
  derniereErreur: Error | null;
  declaration: DeclarationAnnuelle | null;
  brouillon: BrouillonLiasseDto | null;
  [key: string]: unknown;
}

/**
 * Normalise les espaces dans une chaîne monétaire fr-FR. `Money.enEuros()`
 * (Intl.NumberFormat) insère un espace insécable U+00A0 entre nombre et €.
 * Les `.feature` utilisent l'espace simple U+0020 pour la lisibilité.
 * Les deux côtés passent par cette fonction avant comparaison.
 */
function normaliserEspaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

// ─── Step shared : Mapping versionné ──────────────────────────────────────────

Given('le mapping fiscal pour le millésime 2026', function (this: MondeLiasse) {
  this.mappingProvider = new MappingLiasseProviderEnMemoire();
  this.mapping = null;
  this.derniereErreur = null;
});

When('on récupère le mapping', function (this: MondeLiasse) {
  assert.ok(this.mappingProvider, 'mappingProvider non initialisé');
  try {
    this.mapping = this.mappingProvider.pour(2026);
  } catch (err) {
    this.derniereErreur = err as Error;
  }
});

Then('le mapping est trouvé', function (this: MondeLiasse) {
  assert.ok(this.mapping, 'mapping introuvable');
  assert.equal(this.mapping.millesime, 2026);
});

Then('la section 2031-SD contient la case du bénéfice fiscal', function (this: MondeLiasse) {
  assert.ok(this.mapping, 'mapping non chargé');
  const cases2031 = this.mapping.sections['2031-SD'];
  assert.ok(cases2031.length > 0, 'section 2031-SD vide');
  const beneficeFiscal = cases2031.find((c) => c.source === 'beneficeFiscal');
  assert.ok(beneficeFiscal, 'aucune case 2031-SD mappée sur beneficeFiscal');
});

Given('un MappingLiasseProvider en mémoire couvrant 2026 uniquement', function (this: MondeLiasse) {
  this.mappingProvider = new MappingLiasseProviderEnMemoire();
  this.mapping = null;
  this.derniereErreur = null;
});

When('on récupère le mapping pour {int}', function (this: MondeLiasse, annee: number) {
  assert.ok(this.mappingProvider, 'mappingProvider non initialisé');
  try {
    this.mapping = this.mappingProvider.pour(annee);
  } catch (err) {
    this.derniereErreur = err as Error;
  }
});

Then('une erreur MappingLiasseAbsent est levée', function (this: MondeLiasse) {
  assert.ok(this.derniereErreur, 'aucune erreur capturée');
  assert.equal(this.derniereErreur.name, 'MappingLiasseAbsent');
  assert.ok(this.derniereErreur instanceof MappingLiasseAbsent);
});

Then('le message cite {string}', function (this: MondeLiasse, fragment: string) {
  assert.ok(this.derniereErreur, 'aucune erreur capturée');
  assert.ok(
    this.derniereErreur.message.includes(fragment),
    `message ne contient pas "${fragment}" — message reçu : ${this.derniereErreur.message}`,
  );
});

// ─── Step shared : Brouillon liasse réel ──────────────────────────────────────

const BAILLEUR_ID = crypto.randomUUID() as BailleurId;
const DECL_ID = crypto.randomUUID() as DeclarationAnnuelleId;

function uneDeclarationReelMinimale(opts: {
  recettes?: number;
  dotation?: number;
  ardGenere?: number;
  ardConsomme?: number;
  charges?: number;
}): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'reel',
    recettesTotales: Money.fromEuros(opts.recettes ?? 12_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(opts.charges ?? 0),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
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

function makeBailleurRepoStub(): BailleurRepository {
  return {
    trouver: async () => unBailleurValide(),
    enregistrer: async () => {},
  } as unknown as BailleurRepository;
}

function makeDeclRepoStub(decl: DeclarationAnnuelle | null): DeclarationAnnuelleRepository {
  return {
    enregistrer: async () => {},
    trouverParId: async () => decl,
    trouverParBailleurExercice: async () => decl,
    listerParBailleur: async () => (decl ? [decl] : []),
  };
}

Given(
  'une DeclarationAnnuelle clôturée en régime réel avec recettes {int} €',
  function (this: MondeLiasse, recettes: number) {
    this.declaration = uneDeclarationReelMinimale({ recettes });
    this.brouillon = null;
    this.derniereErreur = null;
  },
);

Given(
  'une DeclarationAnnuelle clôturée en régime réel avec dotation amortissement {int} € et bénéfice',
  function (this: MondeLiasse, dotation: number) {
    // 12 000 € recettes - 3 500 € dotation = 8 500 € de bénéfice (positif).
    this.declaration = uneDeclarationReelMinimale({ recettes: 12_000, dotation, charges: 0 });
    this.brouillon = null;
    this.derniereErreur = null;
  },
);

Given('une DeclarationAnnuelle réel avec déficit fiscal', function (this: MondeLiasse) {
  // 5 000 € recettes - 8 000 € dotation - 2 000 € charges = -5 000 € (déficit fiscal).
  this.declaration = uneDeclarationReelMinimale({
    recettes: 5_000,
    dotation: 8_000,
    charges: 2_000,
  });
  this.brouillon = null;
  this.derniereErreur = null;
});

Given('une DeclarationAnnuelle réel', function (this: MondeLiasse) {
  this.declaration = uneDeclarationReelMinimale({});
  this.brouillon = null;
  this.derniereErreur = null;
});

When('on génère le brouillon liasse pour cette déclaration', async function (this: MondeLiasse) {
  assert.ok(this.declaration, 'déclaration non initialisée');
  const declRepo = makeDeclRepoStub(this.declaration);
  const bailleurRepo = makeBailleurRepoStub();
  const mappingProvider = new MappingLiasseProviderEnMemoire();
  try {
    this.brouillon = await genererBrouillonLiasse(
      { declarationId: this.declaration.id },
      { declRepo, bailleurRepo, mappingProvider },
    );
  } catch (err) {
    this.derniereErreur = err as Error;
  }
});

When('on génère le brouillon', async function (this: MondeLiasse) {
  assert.ok(this.declaration, 'déclaration non initialisée');
  const declRepo = makeDeclRepoStub(this.declaration);
  const bailleurRepo = makeBailleurRepoStub();
  const mappingProvider = new MappingLiasseProviderEnMemoire();
  try {
    this.brouillon = await genererBrouillonLiasse(
      { declarationId: this.declaration.id },
      { declRepo, bailleurRepo, mappingProvider },
    );
  } catch (err) {
    this.derniereErreur = err as Error;
  }
});

Then(
  'le brouillon contient une section {string}',
  function (this: MondeLiasse, libelleSection: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const cible = libelleSection.split('—')[0]!.trim();
    const trouve = this.brouillon.sections.find((s) => s.titre.includes(cible));
    assert.ok(trouve, `section "${libelleSection}" introuvable`);
  },
);

Then(
  'une case {string} porte la valeur {string}',
  function (this: MondeLiasse, codeCase: string, valeurAttendue: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const sectionsAvecCase = this.brouillon.sections.flatMap((s) => s.cases);
    const trouve = sectionsAvecCase.find((c) => c.numero === codeCase);
    assert.ok(trouve, `case "${codeCase}" introuvable`);
    assert.ok(trouve.valeur, `la case "${codeCase}" devrait porter une valeur`);
    assert.equal(
      normaliserEspaces(trouve.valeur.enEuros()),
      normaliserEspaces(valeurAttendue),
    );
  },
);

Then('la case dotation amortissement vaut {string}', function (this: MondeLiasse, valeurAttendue: string) {
  assert.ok(this.brouillon, 'brouillon non généré');
  const allCases = this.brouillon.sections.flatMap((s) => s.cases);
  const dotation = allCases.find((c) => c.libelleOfficiel.toLowerCase().includes('dotation'));
  assert.ok(dotation, 'case dotation amortissement introuvable');
  assert.ok(dotation.valeur);
  assert.equal(
    normaliserEspaces(dotation.valeur.enEuros()),
    normaliserEspaces(valeurAttendue),
  );
});

Then('la case 2031-SD bénéfice fiscal est non vide', function (this: MondeLiasse) {
  assert.ok(this.brouillon, 'brouillon non généré');
  const section2031 = this.brouillon.sections.find((s) => s.annexe === '2031-SD');
  assert.ok(section2031, 'section 2031-SD introuvable');
  const beneficeFiscal = section2031.cases.find((c) =>
    c.libelleOfficiel.toLowerCase().includes('bénéfice'),
  );
  assert.ok(beneficeFiscal, 'case bénéfice fiscal introuvable');
  assert.ok(beneficeFiscal.valeur, 'la case bénéfice fiscal devrait être non vide');
});

Then('la case 2031-SD déficit fiscal est vide', function (this: MondeLiasse) {
  assert.ok(this.brouillon, 'brouillon non généré');
  const section2031 = this.brouillon.sections.find((s) => s.annexe === '2031-SD');
  assert.ok(section2031, 'section 2031-SD introuvable');
  const deficitFiscal = section2031.cases.find((c) =>
    c.libelleOfficiel.toLowerCase().includes('déficit'),
  );
  assert.ok(deficitFiscal, 'case déficit fiscal introuvable');
  assert.equal(deficitFiscal.valeur, null);
});

Then('la case 2031-SD bénéfice fiscal est vide', function (this: MondeLiasse) {
  assert.ok(this.brouillon, 'brouillon non généré');
  const section2031 = this.brouillon.sections.find((s) => s.annexe === '2031-SD');
  assert.ok(section2031, 'section 2031-SD introuvable');
  const beneficeFiscal = section2031.cases.find((c) =>
    c.libelleOfficiel.toLowerCase().includes('bénéfice'),
  );
  assert.ok(beneficeFiscal, 'case bénéfice fiscal introuvable');
  assert.equal(beneficeFiscal.valeur, null);
});

Then('la case 2031-SD déficit fiscal porte la valeur absolue du déficit', function (this: MondeLiasse) {
  assert.ok(this.brouillon, 'brouillon non généré');
  const section2031 = this.brouillon.sections.find((s) => s.annexe === '2031-SD');
  assert.ok(section2031, 'section 2031-SD introuvable');
  const deficitFiscal = section2031.cases.find((c) =>
    c.libelleOfficiel.toLowerCase().includes('déficit'),
  );
  assert.ok(deficitFiscal, 'case déficit fiscal introuvable');
  assert.ok(deficitFiscal.valeur, 'la case déficit fiscal devrait être non vide');
  // 5 000 recettes - 8 000 dotation - 2 000 charges = -5 000 → |.| = 5 000 €
  assert.equal(deficitFiscal.valeur.toCentimes(), 500_000n);
});

Then(
  'la section {string} affiche un bandeau {string}',
  function (this: MondeLiasse, libelleSection: string, _libelleBandeau: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const cible = libelleSection.split('—')[0]!.trim();
    const sectionCible = this.brouillon.sections.find((s) => s.titre.includes(cible));
    assert.ok(sectionCible, `section "${libelleSection}" introuvable`);
    assert.equal(sectionCible.bandeauPostesManuels, true, 'bandeauPostesManuels doit être true');
  },
);

Then(
  'certaines cases {string} portent la mention {string}',
  function (this: MondeLiasse, annexeLabel: string, mention: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const annexeTitre = annexeLabel.split('—')[0]!.trim();
    const cible = this.brouillon.sections.find((s) => s.titre.includes(annexeTitre));
    assert.ok(cible, `section "${annexeLabel}" introuvable`);
    const avecMention = cible.cases.filter((c) => c.mention === mention);
    assert.ok(avecMention.length > 0, `aucune case "${annexeLabel}" ne porte la mention "${mention}"`);
  },
);

// ─── Plan 06-02 — régime micro-BIC ────────────────────────────────────────────

function uneDeclarationMicroBicMinimale(opts: { recettes: number }): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: DECL_ID,
    bailleurId: BAILLEUR_ID,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    recettesTotales: Money.fromEuros(opts.recettes),
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

Given(
  'une DeclarationAnnuelle clôturée en régime micro-BIC avec recettes {int} €',
  function (this: MondeLiasse, recettes: number) {
    this.declaration = uneDeclarationMicroBicMinimale({ recettes });
    this.brouillon = null;
    this.derniereErreur = null;
  },
);

Then(
  'le brouillon NE contient PAS de section {string}',
  function (this: MondeLiasse, libelleSection: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const cible = libelleSection.split('—')[0]!.trim();
    const trouve = this.brouillon.sections.find((s) => s.titre.includes(cible));
    assert.equal(trouve, undefined, `section "${libelleSection}" présente alors qu'elle ne devrait PAS l'être`);
  },
);

Then(
  'la case {string} ne porte PAS la valeur {string}',
  function (this: MondeLiasse, codeCase: string, valeurInterdite: string) {
    assert.ok(this.brouillon, 'brouillon non généré');
    const cases = this.brouillon.sections.flatMap((s) => s.cases);
    const trouve = cases.find((c) => c.numero === codeCase);
    assert.ok(trouve, `case "${codeCase}" introuvable`);
    assert.ok(trouve.valeur);
    assert.notEqual(
      normaliserEspaces(trouve.valeur.enEuros()),
      normaliserEspaces(valeurInterdite),
    );
  },
);
