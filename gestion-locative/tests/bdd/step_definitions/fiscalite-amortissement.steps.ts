/**
 * Step definitions @fis-04-amortissement + @fis-04-ard
 *
 * Stratégie : appel direct du use case pur calculerAmortissement (pas HTTP, pas SQLite).
 * Les repos SQLite ne sont pas instanciés : résultat avant amortissement et ARD
 * sont passés directement via les steps Given, ce qui évite la complexité des
 * JOINs encaissement→echeance_loyer→bail pour des tests BDD d'orchestration.
 *
 * Sources :
 *   CGI art. 39 B : ARD reportable sans limite
 *   D-FIS-G1.6 : prorata temporis au jour près
 *   D-FIS-G1.7 : pré-affichage lecture-seule S4
 */
import { Before, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Temporal } from '@js-temporal/polyfill';

import { Money } from '../../../src/domain/_shared/money.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import type { TypeComposantBofip } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { nouveauComposantId, nouveauBienId } from '../../../src/domain/_shared/identifiants.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';
import { calculerAmortissement } from '../../../src/application/fiscalite/calculer-amortissement.js';
import { TableauAmortissementExercice } from '../../../src/domain/fiscalite/tableau-amortissement.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

// ─── World ─────────────────────────────────────────────────────────────────────

interface MondeAmortissement extends World {
  bienId: BienId;
  clock: ReturnType<typeof ClockFixe.du>;
  composants: Composant[];
  resultatAvantAmortissement: Money;
  ardCumuleEnEntree: Money;
  tableau: TableauAmortissementExercice | null;
  [key: string]: unknown;
}

// ─── Before ────────────────────────────────────────────────────────────────────

Before({ tags: '@fis-04-amortissement or @fis-04-ard' }, function (this: MondeAmortissement) {
  this.bienId = nouveauBienId();
  this.clock = ClockFixe.du('2026-12-31');
  this.composants = [];
  this.resultatAvantAmortissement = Money.zero();
  this.ardCumuleEnEntree = Money.zero();
  this.tableau = null;
});

// ─── Steps Given ───────────────────────────────────────────────────────────────

Given('un Bien enregistré avec valorisation fiscale activée', function (this: MondeAmortissement) {
  // Bien déjà initialisé par Before — l'ID est prêt
});

Given(
  'un composant {word} de {int} euros acquis le {string}',
  function (this: MondeAmortissement, type: string, montantEuros: number, dateStr: string) {
    const composant = Composant.creer({
      id: nouveauComposantId(),
      bienId: this.bienId,
      type: type as TypeComposantBofip,
      montantHt: Money.fromEuros(montantEuros),
      dateAcquisition: Temporal.PlainDate.from(dateStr),
      origineKind: 'initial',
    });
    this.composants = [...this.composants, composant];
  },
);

Given(
  'un composant {word} de {int} euros acquis le {string} sorti le {string}',
  function (this: MondeAmortissement, type: string, montantEuros: number, dateAcqStr: string, dateSortieStr: string) {
    const composant = Composant.creer({
      id: nouveauComposantId(),
      bienId: this.bienId,
      type: type as TypeComposantBofip,
      montantHt: Money.fromEuros(montantEuros),
      dateAcquisition: Temporal.PlainDate.from(dateAcqStr),
      dateSortie: Temporal.PlainDate.from(dateSortieStr),
      motifSortie: 'vente',
      origineKind: 'initial',
    });
    this.composants = [...this.composants, composant];
  },
);

Given(
  'un résultat avant amortissement de {int} euros pour exercice {int}',
  function (this: MondeAmortissement, montantEuros: number, _exercice: number) {
    this.resultatAvantAmortissement = Money.fromEuros(montantEuros);
  },
);

Given(
  'un ARD cumulé en entrée de {int} euros',
  function (this: MondeAmortissement, montantEuros: number) {
    this.ardCumuleEnEntree = Money.fromEuros(montantEuros);
  },
);

// ─── Steps When ────────────────────────────────────────────────────────────────

When(
  'on calcule le tableau d\'amortissement pour exercice {int}',
  function (this: MondeAmortissement, exercice: number) {
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(exercice);
    this.tableau = calculerAmortissement(
      this.composants,
      exercice,
      regles,
      {
        resultatAvantAmortissement: this.resultatAvantAmortissement,
        ardCumuleEnEntree: this.ardCumuleEnEntree,
      },
    );
  },
);

// ─── Helpers Then ─────────────────────────────────────────────────────────────

/** Trouve la ligne de dotation pour un composant donné par son type. */
function trouverLigneParType(
  monde: MondeAmortissement,
  type: string,
) {
  assert.ok(monde.tableau, 'tableau attendu');
  // Retrouver l'ID du composant dans la liste World par son type
  const composant = monde.composants.find((c) => c.type === type);
  assert.ok(composant, `Composant de type ${type} introuvable dans le contexte`);
  const ligne = monde.tableau.dotationParComposant.find((l) => l.composantId === composant.id);
  assert.ok(ligne, `Ligne dotation pour ${type} introuvable dans le tableau`);
  return ligne;
}

// ─── Steps Then ────────────────────────────────────────────────────────────────

Then(
  'le composant {word} a une dotation théorique de {int} euros pour exercice {int}',
  function (this: MondeAmortissement, type: string, montantEuros: number, _exercice: number) {
    const ligne = trouverLigneParType(this, type);
    const attenduCentimes = BigInt(montantEuros) * 100n;
    assert.strictEqual(
      ligne.dotationTheorique.toCentimes(),
      attenduCentimes,
      `dotationTheorique attendue = ${montantEuros}€, obtenue = ${Number(ligne.dotationTheorique.toCentimes()) / 100}€`,
    );
  },
);

Then(
  'le composant {word} a une dotation théorique inférieure à {int} centimes pour exercice {int}',
  function (this: MondeAmortissement, type: string, plafondCentimes: number, _exercice: number) {
    const ligne = trouverLigneParType(this, type);
    assert.ok(
      ligne.dotationTheorique.toCentimes() < BigInt(plafondCentimes),
      `dotationTheorique doit être < ${plafondCentimes} centimes, obtenu = ${ligne.dotationTheorique.toCentimes()}`,
    );
  },
);

Then(
  'le composant {word} a une dotation théorique supérieure à {int} centimes pour exercice {int}',
  function (this: MondeAmortissement, type: string, plancherCentimes: number, _exercice: number) {
    const ligne = trouverLigneParType(this, type);
    assert.ok(
      ligne.dotationTheorique.toCentimes() > BigInt(plancherCentimes),
      `dotationTheorique doit être > ${plancherCentimes} centimes, obtenu = ${ligne.dotationTheorique.toCentimes()}`,
    );
  },
);

Then(
  'le composant {word} a une dotation appliquée de {int} euros et ARD généré de {int} euros',
  function (this: MondeAmortissement, type: string, dotAppEuros: number, ardGenEuros: number) {
    const ligne = trouverLigneParType(this, type);
    assert.strictEqual(
      ligne.dotationAppliquee.toCentimes(),
      BigInt(dotAppEuros) * 100n,
      `dotationAppliquee attendue = ${dotAppEuros}€, obtenu = ${Number(ligne.dotationAppliquee.toCentimes()) / 100}€`,
    );
    assert.strictEqual(
      ligne.ardGenereComposant.toCentimes(),
      BigInt(ardGenEuros) * 100n,
      `ardGenereComposant attendu = ${ardGenEuros}€, obtenu = ${Number(ligne.ardGenereComposant.toCentimes()) / 100}€`,
    );
  },
);

Then(
  'l\'ARD cumulé disponible exercice {int} est de {int} euros',
  function (this: MondeAmortissement, _exercice: number, montantEuros: number) {
    assert.ok(this.tableau, 'tableau attendu');
    assert.strictEqual(
      this.tableau.ardCumuleEnSortie.toCentimes(),
      BigInt(montantEuros) * 100n,
      `ardCumuleEnSortie attendu = ${montantEuros}€, obtenu = ${Number(this.tableau.ardCumuleEnSortie.toCentimes()) / 100}€`,
    );
  },
);

Then(
  'l\'ARD consommé pour exercice {int} est de {int} euros',
  function (this: MondeAmortissement, _exercice: number, montantEuros: number) {
    assert.ok(this.tableau, 'tableau attendu');
    assert.strictEqual(
      this.tableau.ardConsomme.toCentimes(),
      BigInt(montantEuros) * 100n,
      `ardConsomme attendu = ${montantEuros}€, obtenu = ${Number(this.tableau.ardConsomme.toCentimes()) / 100}€`,
    );
  },
);
