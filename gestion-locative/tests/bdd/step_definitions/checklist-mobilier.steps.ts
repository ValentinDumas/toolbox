import assert from 'node:assert/strict';
import { Before, After, Given, When, Then } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailValide } from '../../_builders/locatif.js';
import { TYPES_ITEM_INVENTAIRE, inventaireCompletPresent } from '../../../src/domain/_shared/inventaire-item.js';
import {
  type MondePhase3,
  initialiserMondePhase3,
  fermerMondePhase3,
  extraireCookies,
  cookieHeader,
} from '../../_world/monde-phase3.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

// ─── Before/After pour @loc-06 ───────────────────────────────────────────────

Before({ tags: '@loc-06' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-16');
});

After({ tags: '@loc-06' }, async function (this: MondePhase3) {
  await fermerMondePhase3(this);
});

// ─── Given ───────────────────────────────────────────────────────────────────

Given(
  "l'application est prête pour LOC-06 avec clock fixe {string}",
  async function (this: MondePhase3, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
  },
);

Given(
  'un Bien et un Locataire existent en base',
  async function (this: MondePhase3) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);

    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    this.bienId = bien.id;
    // Store ids for form payload construction
    (this as any).lotId = lot.id;
    (this as any).locataireId = locataire.id;
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

/** Construit le payload de création Bail avec les mobilier checkboxes cochées. */
function buildBailPayloadAvecMobilier(
  locataireId: string,
  bienId: string,
  lotId: string,
  mobilierCoches: string[],
): string {
  const params = new URLSearchParams({
    locataireId,
    bienId,
    'lotIds': lotId,
    dateDebut: '2025-06-01',
    dureeMois: '12',
    loyerHc: '800',
    modeCharges: 'forfait',
    montantCharges: '50',
    depotGarantie: '800',
    'irlReference.trimestre': '2026-T1',
    'irlReference.valeur': '145.47',
  });
  // Ajouter les checkboxes mobilier
  for (const type of mobilierCoches) {
    params.append('mobilier', type);
  }
  return params.toString();
}

When(
  "le bailleur crée un Bail avec les 12 checkboxes mobilier cochées",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const lotId = (this as any).lotId;
    const locataireId = (this as any).locataireId;
    assert.ok(lotId, 'lotId non défini');
    assert.ok(locataireId, 'locataireId non défini');

    const mobilierCoches = [...TYPES_ITEM_INVENTAIRE];
    const body = buildBailPayloadAvecMobilier(locataireId, this.bienId, lotId, mobilierCoches);

    const resp = await this.app.inject({
      method: 'POST',
      url: '/baux',
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;

    // Extraire bailId depuis redirect /baux/:id
    if (this.derniereUrl) {
      const match = this.derniereUrl.match(/\/baux\/([^/]+)/);
      if (match) this.bailId = match[1] as BailId;
    }
  },
);

When(
  "le bailleur crée un Bail avec 11 checkboxes mobilier cochées (literie décochée)",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const lotId = (this as any).lotId;
    const locataireId = (this as any).locataireId;
    assert.ok(lotId && locataireId, 'lotId/locataireId non définis');

    // Tous sauf literie
    const mobilierCoches = TYPES_ITEM_INVENTAIRE.filter((t) => t !== 'literie');
    const body = buildBailPayloadAvecMobilier(locataireId, this.bienId, lotId, mobilierCoches);

    const resp = await this.app.inject({
      method: 'POST',
      url: '/baux',
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;

    if (this.derniereUrl) {
      const match = this.derniereUrl.match(/\/baux\/([^/]+)/);
      if (match) this.bailId = match[1] as BailId;
    }
  },
);

When(
  "le bailleur édite le bail avec 10 items cochés sur 12",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    assert.ok(this.db, 'DB non initialisée');

    // Charger le bail depuis la DB pour récupérer ses ids
    const bailRepo = new BailRepositorySqlite(this.db);
    const bail = await bailRepo.trouverParId(this.bailId as BailId);
    assert.ok(bail, 'Bail non trouvé');

    // Garder 10 items seulement (sauter literie et volets_occultants)
    const mobilierCoches = TYPES_ITEM_INVENTAIRE.filter(
      (t) => t !== 'literie' && t !== 'volets_occultants',
    );

    const params = new URLSearchParams({
      locataireId: bail.locataireId,
      bienId: bail.bienId,
      'lotIds': bail.lotIds[0]!,
      dateDebut: bail.dateDebut.toString(),
      dureeMois: String(bail.dureeMois),
      loyerHc: String(Number(bail.loyerHc.toCentimes()) / 100),
      modeCharges: bail.modeCharges,
      montantCharges: String(Number(bail.montantCharges.toCentimes()) / 100),
      depotGarantie: String(Number(bail.depotGarantie.toCentimes()) / 100),
      'irlReference.trimestre': bail.irlReference.trimestre,
      'irlReference.valeur': bail.irlReference.valeur,
    });
    for (const type of mobilierCoches) {
      params.append('mobilier', type);
    }

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}`,
      payload: params.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

// ─── Then ──────────────────────────────────────────────────────────────────────

Then(
  'la base contient un bail avec {int} items mobilier présents',
  function (this: MondePhase3, nbPresents: number) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const row = this.sqlite
      .prepare('SELECT mobilier FROM bail WHERE id = ?')
      .get(this.bailId) as { mobilier: string | null } | undefined;
    assert.ok(row, 'Bail non trouvé en base');
    assert.ok(row.mobilier, 'Colonne mobilier vide');
    const items = JSON.parse(row.mobilier) as Array<{ present: boolean }>;
    const presentsCount = items.filter((i) => i.present).length;
    assert.equal(presentsCount, nbPresents, `Attendu ${nbPresents} items présents, trouvé ${presentsCount}`);
  },
);

Then(
  "aucun warning de requalification n'est affiché",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    // Naviguer vers la fiche bail (après redirect)
    let body = this.dernierCorps;
    if (this.dernierStatut >= 300 && this.dernierStatut < 400 && this.derniereUrl) {
      const resp = await this.app.inject({
        method: 'GET',
        url: this.derniereUrl,
        headers: { Cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
      body = resp.body;
    }
    assert.ok(
      !body.includes('requalifi') && !body.includes('Attention : '),
      `Warning de requalification inattendu\nExtrait: ${body.substring(0, 400)}`,
    );
  },
);

Then(
  'la base contient un bail créé avec literie absente',
  function (this: MondePhase3) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const row = this.sqlite
      .prepare('SELECT mobilier FROM bail WHERE id = ?')
      .get(this.bailId) as { mobilier: string | null } | undefined;
    assert.ok(row, 'Bail non trouvé en base');
    assert.ok(row.mobilier, 'Colonne mobilier vide');
    const items = JSON.parse(row.mobilier) as Array<{ typeItem: string; present: boolean }>;
    const literie = items.find((i) => i.typeItem === 'literie');
    assert.ok(literie, 'Item literie non trouvé dans mobilier');
    assert.equal(literie.present, false, 'literie devrait être absent (present=false)');
  },
);

Then(
  'un warning de requalification est affiché mentionnant {string}',
  async function (this: MondePhase3, mention: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    let body = this.dernierCorps;
    if (this.dernierStatut >= 300 && this.dernierStatut < 400 && this.derniereUrl) {
      const resp = await this.app.inject({
        method: 'GET',
        url: this.derniereUrl,
        headers: { Cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
      body = resp.body;
    }
    assert.ok(
      body.includes(mention),
      `Warning mentionnant "${mention}" non trouvé\nExtrait: ${body.substring(0, 500)}`,
    );
  },
);

Then(
  'la base contient un bail avec {int} items mobilier dont {int} présents et {int} absents',
  function (this: MondePhase3, total: number, presents: number, absents: number) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const row = this.sqlite
      .prepare('SELECT mobilier FROM bail WHERE id = ?')
      .get(this.bailId) as { mobilier: string | null } | undefined;
    assert.ok(row, 'Bail non trouvé en base');
    assert.ok(row.mobilier, 'Colonne mobilier vide');
    const items = JSON.parse(row.mobilier) as Array<{ present: boolean }>;
    assert.equal(items.length, total, `Attendu ${total} items total, trouvé ${items.length}`);
    const presentsCount = items.filter((i) => i.present).length;
    assert.equal(presentsCount, presents, `Attendu ${presents} présents, trouvé ${presentsCount}`);
    const absentsCount = items.filter((i) => !i.present).length;
    assert.equal(absentsCount, absents, `Attendu ${absents} absents, trouvé ${absentsCount}`);
  },
);
