/**
 * Steps BDD @a11y-phase3 — Accessibilité WCAG 2.1 AA Phase 3 (plan 03-05).
 *
 * Pattern : Cucumber + supertest via app.inject() + assertions HTML par regex.
 * Réutilise MondePhase3 (tests/_world/monde-phase3.ts).
 *
 * Note d'isolation : suffixe "(a11y-phase3)" sur Quand/Alors pour éviter les
 * collisions avec les autres step definitions Phase 3 (diagnostics, edl, irl).
 */
import assert from 'node:assert/strict';
import { Before, After, Given, When, Then } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide, unLotValide, unDiagnosticDpeValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import type {
  BienId,
  LotId,
  LocataireId,
  BailId,
} from '../../../src/domain/_shared/identifiants.js';

import {
  type MondePhase3,
  initialiserMondePhase3,
  fermerMondePhase3,
  extraireCookies,
  cookieHeader,
} from '../../_world/monde-phase3.js';

Before({ tags: '@a11y-phase3' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-15');
});

After({ tags: '@a11y-phase3' }, async function (this: MondePhase3) {
  await fermerMondePhase3(this);
});

// ─── Given ──────────────────────────────────────────────────────────────────

Given(
  /^l'application a11y-phase3 est prête avec clock fixe "([^"]+)"$/,
  async function (this: MondePhase3, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
  },
);

Given(
  /^un Bien a11y-phase3 avec DPE "([A-G])"$/,
  async function (this: MondePhase3, dpe: string) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const lot = unLotValide({ designation: 'Principal' });
    const classe = dpe as ClasseDpe;
    const bien = unBienValide({
      lots: [lot],
      classeDpe: classe,
      diagnostics: [unDiagnosticDpeValide({ classeDpe: classe })],
    });
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;
    (this as unknown as { lotId: LotId }).lotId = lot.id as LotId;
  },
);

Given(
  /^un Bail a11y-phase3 indexable date_debut "([^"]+)" loyer_hc (\d+) irl_ref "([^"]+)"\/([0-9.]+)$/,
  async function (
    this: MondePhase3,
    dateDebut: string,
    loyerEuros: string,
    trimestre: string,
    valeur: string,
  ) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const lotId = (this as unknown as { lotId: LotId }).lotId;

    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const bail = unBailIndexableValide({
      locataireId: locataire.id as LocataireId,
      bienId: this.bienId as BienId,
      lotIds: [lotId],
      dateDebut: Temporal.PlainDate.from(dateDebut),
      loyerHc: Money.fromEuros(parseInt(loyerEuros, 10)),
      irlReference: IRL.creer({ trimestre, valeur }),
    });
    await bailRepo.enregistrer(bail);
    this.bailId = bail.id as BailId;
  },
);

// ─── When ───────────────────────────────────────────────────────────────────

When(
  /^le bailleur ouvre GET \/baux\/:id\/indexer \(a11y-phase3\)$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/indexer`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur ouvre GET \/baux\/:id\/edl\/entree\/nouveau \(a11y-phase3\)$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/edl/entree/nouveau`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur ouvre GET \/biens\/:id\/diagnostics\/nouveau \(a11y-phase3\)$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bienId);
    const resp = await this.app.inject({
      method: 'GET',
      url: `/biens/${this.bienId}/diagnostics/nouveau`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

// ─── Then ───────────────────────────────────────────────────────────────────

Then(
  'la page a11y-phase3 contient l\'input id="irl_trimestre"',
  function (this: MondePhase3) {
    assert.equal(this.dernierStatut, 200, `Statut attendu 200, reçu ${this.dernierStatut}`);
    assert.match(this.dernierCorps, /id="irl_trimestre"/, 'input id="irl_trimestre" absent');
  },
);

Then(
  'la page a11y-phase3 contient au moins un <button type="submit"> natif',
  function (this: MondePhase3) {
    assert.match(
      this.dernierCorps,
      /<button[^>]*type="submit"/,
      '<button type="submit"> natif absent',
    );
  },
);

Then(
  'le bloc a11y-phase3 role="alert" contient autofocus et tabindex="-1"',
  function (this: MondePhase3) {
    assert.equal(this.dernierStatut, 200);
    // Le bloc gel-loyer porte role="alert" + tabindex="-1" + autofocus
    assert.match(this.dernierCorps, /role="alert"/, 'role="alert" absent');
    assert.match(this.dernierCorps, /tabindex="-1"/, 'tabindex="-1" absent');
    assert.ok(this.dernierCorps.includes('autofocus'), 'autofocus absent');
  },
);

Then('la page a11y-phase3 contient aria-live="assertive"', function (this: MondePhase3) {
  assert.match(this.dernierCorps, /aria-live="assertive"/, 'aria-live="assertive" absent');
});

Then(
  /^la page a11y-phase3 contient un <fieldset> avec <legend>Inventaire mobilier \(décret 2015-981\) — 12 items obligatoires<\/legend>$/,
  function (this: MondePhase3) {
    assert.equal(this.dernierStatut, 200);
    assert.ok(this.dernierCorps.includes('<fieldset>'), '<fieldset> absent');
    assert.ok(
      this.dernierCorps.includes(
        '<legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>',
      ),
      'legend "Inventaire mobilier..." absente',
    );
  },
);

Then('le lien sidebar "Biens" porte aria-current="page"', function (this: MondePhase3) {
  assert.equal(this.dernierStatut, 200);
  assert.match(
    this.dernierCorps,
    /<a href="\/biens" aria-current="page">Biens<\/a>/,
    'Lien sidebar Biens sans aria-current="page"',
  );
});
