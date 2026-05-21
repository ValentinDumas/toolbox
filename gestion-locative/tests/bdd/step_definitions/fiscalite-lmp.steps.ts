/**
 * Step definitions @fis-01 : Détection bascule LMNP → LMP (CGI art. 155 IV).
 *
 * Stratégie : appel direct du use case pur detecterBasculeLmp (pas HTTP, pas SQLite).
 * Le use case est PUR — pas d'I/O — tests ultra-rapides et déterministes.
 *
 * Sources :
 *   CGI art. 155 IV — critères LMP depuis Conseil Constitutionnel n° 2009-587 DC
 *   D-FIS-G3.3 — verdict tri-état
 *   D-FIS-G3.4 — anti-sticky : chaque exercice évalué indépendamment
 *   BOFIP-BIC-CHAMP-40-20 — périmètre revenus actifs foyer
 */

import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';

import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import {
  detecterBasculeLmp,
  type VerdictLmp,
} from '../../../src/application/fiscalite/detecter-bascule-lmp.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';

// ─── World ─────────────────────────────────────────────────────────────────────

interface MondeLmp extends World {
  /** Recettes de l'exercice courant en centimes */
  recettes: Money;
  /** Revenus actifs du foyer en centimes (null = non renseignés) */
  revenusFoyer: Money | null;
  /** Verdict du dernier calcul */
  dernierVerdict: VerdictLmp | null;
  /** Verdicts des exercices anti-sticky (multi-exercices) */
  verdictsParExercice: Record<number, VerdictLmp>;
  [key: string]: unknown;
}

// ─── Before ────────────────────────────────────────────────────────────────────

Before({ tags: '@fis-01' }, function (this: MondeLmp) {
  this.recettes = Money.zero();
  this.revenusFoyer = null;
  this.dernierVerdict = null;
  this.verdictsParExercice = {};
});

// ─── Steps Given ───────────────────────────────────────────────────────────────

Given(
  'l\'application est prête pour la détection LMP avec clock fixe {string}',
  function (this: MondeLmp, _clockIso: string) {
    // Use case pur — pas d'infrastructure à initialiser
  },
);

Given(
  'des recettes annuelles de {int} centimes pour exercice {int}',
  function (this: MondeLmp, centimes: number, _exercice: number) {
    this.recettes = Money.fromCentimes(BigInt(centimes));
  },
);

Given(
  'aucun revenu du foyer renseigné',
  function (this: MondeLmp) {
    this.revenusFoyer = null;
  },
);

Given(
  'des revenus du foyer de {int} centimes enregistrés',
  function (this: MondeLmp, centimes: number) {
    this.revenusFoyer = Money.fromCentimes(BigInt(centimes));
  },
);

Given(
  'si les revenus du foyer passent à {int} centimes',
  function (this: MondeLmp, centimes: number) {
    this.revenusFoyer = Money.fromCentimes(BigInt(centimes));
  },
);

Given(
  'si les revenus du foyer repassent à {int} centimes',
  function (this: MondeLmp, centimes: number) {
    this.revenusFoyer = Money.fromCentimes(BigInt(centimes));
  },
);

// ─── Steps When ────────────────────────────────────────────────────────────────

When(
  /^on évalue le verdict LMNP\/LMP pour exercice (\d+)$/,
  function (this: MondeLmp, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(exercice);
    this.dernierVerdict = detecterBasculeLmp(
      { recettes: this.recettes, revenusFoyer: this.revenusFoyer },
      regles,
    );
    this.verdictsParExercice[exercice] = this.dernierVerdict;
  },
);

// ─── Steps Then ────────────────────────────────────────────────────────────────

Then(
  'le verdict est {string}',
  function (this: MondeLmp, verdictAttendu: string) {
    assert.strictEqual(
      this.dernierVerdict,
      verdictAttendu,
      `Verdict attendu : ${verdictAttendu}, obtenu : ${this.dernierVerdict}`,
    );
  },
);

Then(
  'le verdict exercice {int} est {string}',
  function (this: MondeLmp, exercice: number, verdictAttendu: string) {
    const verdict = this.verdictsParExercice[exercice];
    assert.ok(verdict !== undefined, `Aucun verdict calculé pour exercice ${exercice}`);
    assert.strictEqual(
      verdict,
      verdictAttendu,
      `Exercice ${exercice} — verdict attendu : ${verdictAttendu}, obtenu : ${verdict}`,
    );
  },
);

// Variante avec suffixe "(anti-sticky confirmé)" — même step
Then(
  'le verdict exercice {int} est {string} (anti-sticky confirmé)',
  function (this: MondeLmp, exercice: number, verdictAttendu: string) {
    const verdict = this.verdictsParExercice[exercice];
    assert.ok(verdict !== undefined, `Aucun verdict calculé pour exercice ${exercice}`);
    assert.strictEqual(
      verdict,
      verdictAttendu,
      `Anti-sticky : exercice ${exercice} — verdict attendu : ${verdictAttendu}, obtenu : ${verdict}`,
    );
  },
);

// Alias REGLES_2026 pour usage direct dans les tests
export { REGLES_2026, detecterBasculeLmp };
