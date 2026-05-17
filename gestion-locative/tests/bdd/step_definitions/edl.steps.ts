import assert from 'node:assert/strict';
import { Before, After, Given, When, Then } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { EtatDesLieuxRepositorySqlite } from '../../../src/infrastructure/repositories/etat-des-lieux-repository-sqlite.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import {
  unLocataireValide,
  unBailValide,
  unEtatDesLieuxEntreeValide,
  inventaire12ItemsPresentsBon,
} from '../../_builders/locatif.js';
import {
  inventaireCompletPresent,
  InventaireItem,
} from '../../../src/domain/_shared/inventaire-item.js';
import {
  type MondePhase3,
  initialiserMondePhase3,
  fermerMondePhase3,
  extraireCookies,
  cookieHeader,
} from '../../_world/monde-phase3.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

// ─── Before/After pour @loc-03 ───────────────────────────────────────────────

Before({ tags: '@loc-03' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-16');
});

After({ tags: '@loc-03' }, async function (this: MondePhase3) {
  await fermerMondePhase3(this);
});

// ─── Given ───────────────────────────────────────────────────────────────────

Given(
  "l'application est prête pour LOC-03 avec clock fixe {string}",
  async function (this: MondePhase3, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
  },
);

Given(
  'un Bail Phase 3 activé avec date_debut={word} et duree_mois={int}',
  async function (this: MondePhase3, dateDebut: string, dureeMois: number) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);

    const lot = unLotValide({ designation: 'Principal' });
    const bien = unBienValide({ lots: [lot] });
    await bienRepo.enregistrer(bien);

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    const bail = unBailValide({
      bienId: bien.id,
      locataireId: locataire.id,
      lotIds: [lot.id],
      dateDebut: Temporal.PlainDate.from(dateDebut),
      dureeMois,
    }).activer(Temporal.PlainDate.from(dateDebut), 1);
    await bailRepo.enregistrer(bail);
    this.bailId = bail.id;
  },
);

Given(
  "un EDL d'entrée est déjà enregistré pour ce bail",
  async function (this: MondePhase3) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const edlRepo = new EtatDesLieuxRepositorySqlite(this.db);
    const edl = unEtatDesLieuxEntreeValide({ bailId: this.bailId as BailId });
    await edlRepo.enregistrer(edl);
    this.edlId = edl.id;
  },
);

Given(
  "un EDL d'entrée avec 12 items bons est enregistré",
  async function (this: MondePhase3) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const edlRepo = new EtatDesLieuxRepositorySqlite(this.db);
    const edl = unEtatDesLieuxEntreeValide({
      bailId: this.bailId as BailId,
      inventaire: inventaire12ItemsPresentsBon(),
    });
    await edlRepo.enregistrer(edl);
    this.edlId = edl.id;
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

function buildInventaireFormFields(items: InventaireItem[]): Record<string, string> {
  const fields: Record<string, string> = {};
  items.forEach((item, idx) => {
    fields[`inventaire[${idx}].typeItem`] = item.typeItem;
    if (item.present) {
      fields[`inventaire[${idx}].present`] = 'on';
    }
    if (item.etat) {
      fields[`inventaire[${idx}].etat`] = item.etat;
    }
    if (item.note) {
      fields[`inventaire[${idx}].note`] = item.note;
    }
  });
  return fields;
}

When(
  "le bailleur enregistre un EDL d'entrée avec 12 items bons et contradictoire=true",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaireFields = buildInventaireFormFields(inventaireCompletPresent());
    const body = new URLSearchParams({
      date_edl: '2026-05-01',
      contradictoire: 'on',
      date_signature: '2026-05-01',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/entree`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur enregistre un EDL de sortie avec 12 items bons et contradictoire=false",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaireFields = buildInventaireFormFields(inventaireCompletPresent());
    const body = new URLSearchParams({
      date_edl: '2027-05-01',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/sortie`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur tente d'enregistrer un second EDL d'entrée",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaireFields = buildInventaireFormFields(inventaireCompletPresent());
    const body = new URLSearchParams({
      date_edl: '2026-05-15',
      contradictoire: 'on',
      date_signature: '2026-05-15',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/entree`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur enregistre un EDL de sortie sans EDL d'entrée préalable",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaireFields = buildInventaireFormFields(inventaireCompletPresent());
    const body = new URLSearchParams({
      date_edl: '2027-05-01',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/sortie`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur enregistre un EDL de sortie avec literie absente et plaques_cuisson dégradées",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaire = inventaireCompletPresent().map((item) => {
      if (item.typeItem === 'literie') {
        return InventaireItem.creer({ typeItem: 'literie', present: false, etat: null, note: null });
      }
      if (item.typeItem === 'plaques_cuisson') {
        return InventaireItem.creer({ typeItem: 'plaques_cuisson', present: true, etat: 'degrade', note: null });
      }
      return item;
    });

    const inventaireFields = buildInventaireFormFields(inventaire);
    const body = new URLSearchParams({
      date_edl: '2027-05-01',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/sortie`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur annule l'EDL d'entrée avec raison {string}",
  async function (this: MondePhase3, raison: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    assert.ok(this.edlId, 'edlId non défini');
    const body = new URLSearchParams({ raison }).toString();
    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/entree/${this.edlId}/annuler`,
      payload: body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "le bailleur enregistre un nouvel EDL d'entrée",
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const inventaireFields = buildInventaireFormFields(inventaireCompletPresent());
    const body = new URLSearchParams({
      date_edl: '2026-06-01',
      contradictoire: 'on',
      date_signature: '2026-06-01',
      ...inventaireFields,
    }).toString();

    const resp = await this.app.inject({
      method: 'POST',
      url: `/baux/${this.bailId}/edl/entree`,
      payload: body,
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
  'la table etat_des_lieux contient {int} lignes pour ce bail',
  function (this: MondePhase3, n: number) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const rows = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM etat_des_lieux WHERE bail_id = ?')
      .get(this.bailId) as { count: number };
    assert.equal(rows.count, n, `Attendu ${n} EDL, trouvé ${rows.count}`);
  },
);

Then(
  /^la page GET \/baux\/:id\/edl\/sortie n'affiche aucun warning delta$/,
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/edl/sortie`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    const body = resp.body;
    assert.ok(
      !body.includes('WARNING_ITEM_DISPARU') && !body.includes('WARNING_ITEM_DEGRADE') && !body.includes('warning-zone'),
      `Page affiche un warning delta inattendu\nExtrait: ${body.substring(0, 500)}`,
    );
  },
);

Then(
  "la réponse indique qu'un EDL d'entrée existe déjà",
  function (this: MondePhase3) {
    // Soit redirect avec session warning, soit re-render avec message d'erreur
    const isRedirect = this.dernierStatut >= 300 && this.dernierStatut < 400;
    const hasMessage = this.dernierCorps.includes("EDL d'entrée existe déjà") ||
      this.dernierCorps.includes('existe déjà');
    assert.ok(
      isRedirect || hasMessage,
      `Attendu redirect ou message "existe déjà", statut=${this.dernierStatut}\nExtrait: ${this.dernierCorps.substring(0, 300)}`,
    );
  },
);

Then(
  "la table etat_des_lieux ne contient qu'un seul EDL d'entrée actif pour ce bail",
  function (this: MondePhase3) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const row = this.sqlite
      .prepare("SELECT COUNT(*) as count FROM etat_des_lieux WHERE bail_id = ? AND type = 'entree' AND annule_le IS NULL")
      .get(this.bailId) as { count: number };
    assert.equal(row.count, 1, `Attendu 1 EDL d'entrée actif, trouvé ${row.count}`);
  },
);

Then(
  /^la page \/baux\/:id\/edl\/sortie affiche un warning sur l'absence d'EDL d'entrée$/,
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    // Suivre redirect si nécessaire
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
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/edl/sortie`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    body = resp.body;
    assert.ok(
      body.includes("EDL d'entrée") || body.includes('entrée') || body.includes('absent'),
      `Warning absence EDL d'entrée non trouvé\nExtrait: ${body.substring(0, 500)}`,
    );
  },
);

Then(
  /^la page GET \/baux\/:id\/edl\/sortie contient un warning pour literie disparue$/,
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/edl/sortie`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    assert.ok(
      resp.body.includes('Literie') && (resp.body.includes("présent à l'entrée") || resp.body.includes('disparu')),
      `Warning literie disparue non trouvé\nExtrait: ${resp.body.substring(0, 800)}`,
    );
  },
);

Then(
  /^la page GET \/baux\/:id\/edl\/sortie contient un warning pour plaques_cuisson dégradées$/,
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/baux/${this.bailId}/edl/sortie`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    assert.ok(
      resp.body.includes('cuisson') && (resp.body.includes('dégradé') || resp.body.includes('degrade')),
      `Warning plaques_cuisson dégradé non trouvé\nExtrait: ${resp.body.substring(0, 800)}`,
    );
  },
);

Then(
  "la table etat_des_lieux contient {int} lignes pour ce bail dont {int} annulé",
  function (this: MondePhase3, total: number, annules: number) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const totalRow = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM etat_des_lieux WHERE bail_id = ?')
      .get(this.bailId) as { count: number };
    assert.equal(totalRow.count, total, `Attendu ${total} EDL total, trouvé ${totalRow.count}`);
    const annulesRow = this.sqlite
      .prepare('SELECT COUNT(*) as count FROM etat_des_lieux WHERE bail_id = ? AND annule_le IS NOT NULL')
      .get(this.bailId) as { count: number };
    assert.equal(annulesRow.count, annules, `Attendu ${annules} EDL annulé, trouvé ${annulesRow.count}`);
  },
);

Then(
  'trouverActifParBailEtType retourne le nouveau EDL',
  async function (this: MondePhase3) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bailId, 'bailId non défini');
    const edlRepo = new EtatDesLieuxRepositorySqlite(this.db);
    const actif = await edlRepo.trouverActifParBailEtType(this.bailId as BailId, 'entree');
    assert.ok(actif, "Pas d'EDL d'entrée actif trouvé");
    assert.ok(!actif.annuleLe, "L'EDL actif ne doit pas être annulé");
  },
);
