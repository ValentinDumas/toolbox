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

Before({ tags: '@loc-04-apply' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-15');
});

After({ tags: '@loc-04-apply' }, async function (this: MondePhase3) {
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
  /^le bailleur ouvre GET \/baux\/:id\/indexer$/,
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

// ─── @loc-04-apply ──────────────────────────────────────────────────────────

Given(
  /^l'application est prête pour LOC-04 apply avec clock fixe "([^"]+)"$/,
  async function (this: MondePhase3, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
    // Crée le bailleur singleton requis par appliquerIndexationIRL
    const { BailleurRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js'
    );
    const { Bailleur } = await import('../../../src/domain/identite/bailleur.js');
    const { Adresse } = await import('../../../src/domain/_shared/adresse.js');
    assert.ok(this.db, 'DB non initialisée');
    const bailleurRepo = new BailleurRepositorySqlite(this.db);
    const existant = await bailleurRepo.trouver();
    if (!existant) {
      await bailleurRepo.enregistrer(
        Bailleur.creer({
          nomComplet: 'Jean Bailleur',
          adresse: Adresse.creer({ rue: '1 rue Bailleur', codePostal: '75001', ville: 'Paris' }),
        }),
      );
    }
  },
);

Given(
  /^un Bien LOC-04 apply avec DPE "([A-G])"$/,
  async function (this: MondePhase3, dpe: string) {
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
  /^un Bail LOC-04 apply actif avec date_debut "([^"]+)" loyer_hc (\d+) irl_ref "([^"]+)"\/([0-9.]+)$/,
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

When(
  /^le bailleur soumet POST \/baux\/:id\/indexer\/appliquer$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/indexer/appliquer`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/baux\/:id\/indexer\/renoncer$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/indexer/renoncer`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur télécharge GET \/baux\/:id\/avenant\/(\d+)$/,
  async function (this: MondePhase3, annee: string) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/avenant/${annee}`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
    (this as unknown as { dernieresHeaders: Record<string, string | string[] | undefined> })
      .dernieresHeaders = resp.headers as Record<string, string | string[] | undefined>;
  },
);

When(
  /^le bailleur ouvre la fiche du Bail LOC-04 apply$/,
  async function (this: MondePhase3) {
    assert.ok(this.app && this.bailId);
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/baux\/:id\/indexer\/appliquer en forcant la session draft "([^"]+)"\/([0-9.]+)$/,
  async function (this: MondePhase3, trimestre: string, valeur: string) {
    // Force-poke la session via le POST /indexer/simuler — qui définit indexationDraft —
    // PUIS POST appliquer pour vérifier la défense en profondeur côté serveur (gel DPE).
    assert.ok(this.app && this.bailId);
    const body = new URLSearchParams({ irl_trimestre: trimestre, irl_valeur: valeur }).toString();
    const simResp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/indexer/simuler`,
      payload: body,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(simResp.headers as Record<string, string | string[] | undefined>, this.cookies);

    const applyResp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/indexer/appliquer`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(applyResp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = applyResp.statusCode;
    this.dernierCorps = applyResp.body;
  },
);

Then(
  /^le bail a loyer_hc (\d+) et irl_reference "([^"]+)"\/([0-9.]+)$/,
  async function (this: MondePhase3, loyerCentimes: string, trimestre: string, valeur: string) {
    assert.ok(this.db && this.bailId);
    const bailRepo = new BailRepositorySqlite(this.db);
    const bail = await bailRepo.trouverParId(this.bailId);
    assert.ok(bail, 'bail introuvable');
    assert.strictEqual(bail.loyerHc.toCentimes(), BigInt(loyerCentimes));
    assert.strictEqual(bail.irlReference.trimestre, trimestre);
    assert.strictEqual(bail.irlReference.valeur, valeur);
  },
);

Then(
  /^la table bail_indexations contient (\d+) ligne(?:s)? avec indexation_appliquee=(\d)$/,
  async function (this: MondePhase3, count: string, applique: string) {
    assert.ok(this.db && this.bailId);
    const { BailIndexationRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js'
    );
    const repo = new BailIndexationRepositorySqlite(this.db);
    const liste = await repo.listerParBail(this.bailId);
    assert.strictEqual(liste.length, parseInt(count, 10));
    assert.strictEqual(liste[0]!.indexationAppliquee, applique === '1');
  },
);

Then(
  /^la table bail_indexations contient (\d+) ligne(?:s)? avec indexation_appliquee=(\d) et raison "([^"]+)"$/,
  async function (this: MondePhase3, count: string, applique: string, raison: string) {
    assert.ok(this.db && this.bailId);
    const { BailIndexationRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js'
    );
    const repo = new BailIndexationRepositorySqlite(this.db);
    const liste = await repo.listerParBail(this.bailId);
    assert.strictEqual(liste.length, parseInt(count, 10));
    assert.strictEqual(liste[0]!.indexationAppliquee, applique === '1');
    assert.strictEqual(liste[0]!.raisonNonApplication, raison);
  },
);

Then(
  /^la table bail_indexations contient (\d+) ligne(?:s)?$/,
  async function (this: MondePhase3, count: string) {
    assert.ok(this.db && this.bailId);
    const { BailIndexationRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js'
    );
    const repo = new BailIndexationRepositorySqlite(this.db);
    const liste = await repo.listerParBail(this.bailId);
    assert.strictEqual(liste.length, parseInt(count, 10));
  },
);

Then(
  /^le fichier avenant existe sur disque pour l'année (\d+)$/,
  async function (this: MondePhase3, annee: string) {
    assert.ok(this.db && this.bailId);
    const { BailIndexationRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/bail-indexation-repository-sqlite.js'
    );
    const repo = new BailIndexationRepositorySqlite(this.db);
    const liste = await repo.listerParBail(this.bailId);
    const bi = liste.find((i) => i.dateEffet.year === parseInt(annee, 10) && i.indexationAppliquee);
    assert.ok(bi, 'aucune indexation appliquée trouvée pour cette année');
    // Vérification simple : on demande au serveur de servir le fichier (GET avenant).
    const resp = await this.app!.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/avenant/${annee}`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    assert.strictEqual(resp.statusCode, 200, `GET avenant a renvoyé ${resp.statusCode}`);
  },
);

Then(
  /^la réponse a Content-Type "([^"]+)"$/,
  function (this: MondePhase3, ct: string) {
    const headers = (this as unknown as {
      dernieresHeaders: Record<string, string | string[] | undefined>;
    }).dernieresHeaders;
    const actual = headers?.['content-type'];
    const value = Array.isArray(actual) ? actual[0] : actual;
    assert.ok(value?.startsWith(ct), `Content-Type attendu ${ct} obtenu ${value}`);
  },
);

Then(
  /^le corps commence par "([^"]+)"$/,
  function (this: MondePhase3, prefix: string) {
    assert.ok(
      this.dernierCorps.startsWith(prefix),
      `Le corps ne commence pas par "${prefix}" (extrait : "${this.dernierCorps.slice(0, 20)}")`,
    );
  },
);

Then(
  /^la page LOC-04 apply contient "([^"]+)"$/,
  function (this: MondePhase3, texte: string) {
    assert.ok(
      this.dernierCorps.includes(texte),
      `Le corps ne contient pas "${texte}"`,
    );
  },
);
