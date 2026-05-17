import assert from 'node:assert/strict';
import { Before, After, Given, When, Then } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import type { BienId, LotId, LocataireId, BailId } from '../../../src/domain/_shared/identifiants.js';
import {
  type MondePhase3,
  initialiserMondePhase3,
  fermerMondePhase3,
  extraireCookies,
  cookieHeader,
} from '../../_world/monde-phase3.js';

Before({ tags: '@loc-04 or @loc-05' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-15');
});

After({ tags: '@loc-04 or @loc-05' }, async function (this: MondePhase3) {
  await fermerMondePhase3(this);
});

// ─── Given ──────────────────────────────────────────────────────────────────

Given(
  /^l'application est prête pour (LOC-04|LOC-05) avec clock fixe "([^"]+)"$/,
  async function (this: MondePhase3, _tag: string, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
  },
);

Given(
  /^un Bien (LOC-04|LOC-05) avec DPE "([A-G])"$/,
  async function (this: MondePhase3, _tag: string, dpe: string) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot], classeDpe: dpe as ClasseDpe });
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;
    (this as unknown as { lotId: LotId }).lotId = lot.id as LotId;
  },
);

Given(
  /^un Bail (LOC-04|LOC-05) actif avec date_debut "([^"]+)" loyer_hc (\d+) irl_ref "([^"]+)"\/([0-9.]+)$/,
  async function (
    this: MondePhase3,
    _tag: string,
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

When('le bailleur ouvre la fiche du Bail', async function (this: MondePhase3) {
  assert.ok(this.app && this.bailId);
  const resp = await this.app.inject({
    method: 'GET',
    url: `/baux/${this.bailId}`,
    headers: { Cookie: cookieHeader(this.cookies) },
  });
  extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
  this.dernierStatut = resp.statusCode;
  this.dernierCorps = resp.body;
});

When(
  'le bailleur ouvre GET /baux/:id/indexer',
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
  /^le bailleur soumet POST \/baux\/:id\/indexer\/simuler avec irl_trimestre="([^"]+)" irl_valeur="([^"]+)"$/,
  async function (this: MondePhase3, trimestre: string, valeur: string) {
    assert.ok(this.app && this.bailId);
    const body = new URLSearchParams({
      irl_trimestre: trimestre,
      irl_valeur: valeur,
    }).toString();
    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/indexer/simuler`,
      payload: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

// ─── Then ───────────────────────────────────────────────────────────────────

Then(
  /^la page (?:LOC-04|LOC-05) contient "([^"]+)"$/,
  function (this: MondePhase3, texte: string) {
    assert.ok(
      this.dernierCorps.includes(texte),
      `Le corps ne contient pas "${texte}". Statut ${this.dernierStatut}. Extrait : ${this.dernierCorps.slice(0, 500)}`,
    );
  },
);

Then('la page contient {string}', function (this: MondePhase3, texte: string) {
  assert.ok(
    this.dernierCorps.includes(texte),
    `Le corps ne contient pas "${texte}". Statut ${this.dernierStatut}. Extrait : ${this.dernierCorps.slice(0, 500)}`,
  );
});

Then(
  /^la page (?:LOC-04|LOC-05) ne contient PAS "([^"]+)"$/,
  function (this: MondePhase3, texte: string) {
    assert.ok(
      !this.dernierCorps.includes(texte),
      `Le corps contient "${texte}" alors qu'il ne devrait pas. Extrait : ${this.dernierCorps.slice(0, 500)}`,
    );
  },
);

Then(
  "la réponse LOC-05 n'effectue pas le calcul d'indexation",
  function (this: MondePhase3) {
    // Defense en profondeur : la page ne doit pas contenir le tableau de simulation
    // (loyer après / formule de calcul).
    assert.ok(
      !this.dernierCorps.includes('Nouveau loyer calculé'),
      'La page contient le tableau de simulation alors que le gel doit bloquer le calcul',
    );
  },
);
