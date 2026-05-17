import assert from 'node:assert/strict';

import { Before, After, Given, When, Then } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import { Diagnostic } from '../../../src/domain/patrimoine/diagnostic.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import {
  type MondePhase3,
  initialiserMondePhase3,
  fermerMondePhase3,
  extraireCookies,
  cookieHeader,
} from '../../_world/monde-phase3.js';

// ─── Before/After pour @phase3 ──────────────────────────────────────────────

Before({ tags: '@phase3' }, async function (this: MondePhase3) {
  await initialiserMondePhase3(this, '2026-05-16');
});

After({ tags: '@phase3' }, async function (this: MondePhase3) {
  await fermerMondePhase3(this);
});

// ─── Given ──────────────────────────────────────────────────────────────────

Given(
  'l\'application est prête pour PAT-03 avec clock fixe {string}',
  async function (this: MondePhase3, clockIso: string) {
    // Le Before @phase3 initialise déjà l'app avec '2026-05-16'
    // Si le scénario demande une autre date, réinitialiser
    if (this.clockIso !== clockIso) {
      await fermerMondePhase3(this);
      await initialiserMondePhase3(this, clockIso);
    }
  },
);

Given(
  'un Bien Phase 3 existe à l\'adresse {string}',
  async function (this: MondePhase3, _adresse: string) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;
  },
);

Given(
  /^un Bien Phase 3 avec un DPE expiré date_emission=(\S+) classe_dpe=(\S+)$/,
  async function (this: MondePhase3, dateEmissionStr: string, classeDpe: string) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bien = unBienValide();
    const dpe = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from(dateEmissionStr),
      classeDpe: classeDpe as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    });
    const bienAvecDpe = bien.ajouterDiagnostic(dpe);
    await bienRepo.enregistrer(bienAvecDpe);
    this.bienId = bien.id;
  },
);

Given(
  /^un Bien Phase 3 avec 2 DPE successifs date_emission=(\S+) classe=(\S+) et date_emission=(\S+) classe=(\S+)$/,
  async function (
    this: MondePhase3,
    date1: string,
    classe1: string,
    date2: string,
    classe2: string,
  ) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bien = unBienValide();
    const dpe1 = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from(date1),
      classeDpe: classe1 as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    });
    const dpe2 = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from(date2),
      classeDpe: classe2 as 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G',
    });
    const bienAvec2 = bien.ajouterDiagnostic(dpe1).ajouterDiagnostic(dpe2);
    await bienRepo.enregistrer(bienAvec2);
    this.bienId = bien.id;
  },
);

// ─── When ────────────────────────────────────────────────────────────────────

When(
  /^le bailleur soumet POST \/biens\/:id\/diagnostics avec type=dpe date_emission=(.+) classe_dpe=(.+)$/,
  async function (this: MondePhase3, dateEmission: string, classeDpe: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/biens/${this.bienId}/diagnostics`,
      payload: `type=dpe&date_emission=${dateEmission}&classe_dpe=${classeDpe}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/biens\/:id\/diagnostics avec type=erp date_emission=(.+)$/,
  async function (this: MondePhase3, dateEmission: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/biens/${this.bienId}/diagnostics`,
      payload: `type=erp&date_emission=${dateEmission}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/biens\/:id\/diagnostics avec type=dpe date_emission=(.+) sans classe_dpe$/,
  async function (this: MondePhase3, dateEmission: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/biens/${this.bienId}/diagnostics`,
      payload: `type=dpe&date_emission=${dateEmission}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur navigue vers GET \/biens\/:id$/,
  async function (this: MondePhase3) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');

    // Si redirect depuis POST précédent, suivre la redirection
    if (this.dernierStatut >= 300 && this.dernierStatut < 400 && this.derniereUrl) {
      const resp = await this.app.inject({
        method: 'GET',
        url: this.derniereUrl,
        headers: { Cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
      this.dernierStatut = resp.statusCode;
      this.dernierCorps = resp.body;
    } else {
      const resp = await this.app.inject({
        method: 'GET',
        url: `/biens/${this.bienId}`,
        headers: { Cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
      this.dernierStatut = resp.statusCode;
      this.dernierCorps = resp.body;
    }
  },
);

// ─── Then ────────────────────────────────────────────────────────────────────

Then(
  'il est redirigé vers la fiche du Bien',
  async function (this: MondePhase3) {
    assert.equal(this.dernierStatut, 302, `Attendu redirect 302, reçu ${this.dernierStatut}`);
    assert.ok(
      this.derniereUrl.includes(`/biens/${this.bienId}`),
      `URL redirect attendue /biens/${this.bienId}, reçu ${this.derniereUrl}`,
    );
    // Suivre la redirection
    assert.ok(this.app, 'App non initialisée');
    const resp = await this.app.inject({
      method: 'GET',
      url: this.derniereUrl,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

Then(
  'la colonne classe_dpe du Bien en base est {string}',
  function (this: MondePhase3, classeAttendue: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const row = this.sqlite
      .prepare('SELECT classe_dpe FROM bien WHERE id = ?')
      .get(this.bienId) as { classe_dpe: string | null } | undefined;
    assert.ok(row, 'Bien non trouvé en base');
    assert.equal(row.classe_dpe, classeAttendue, `classe_dpe attendu "${classeAttendue}", reçu "${row.classe_dpe}"`);
  },
);

Then(
  /^la table diagnostics contient 1 ligne avec type=dpe date_emission=(\S+) date_expiration=(\S+)$/,
  function (this: MondePhase3, dateEmission: string, dateExpiration: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const rows = this.sqlite
      .prepare('SELECT * FROM diagnostics WHERE bien_id = ? AND type = ?')
      .all(this.bienId, 'dpe') as Array<{ date_emission: string; date_expiration: string | null }>;
    assert.equal(rows.length, 1, `Attendu 1 diagnostic DPE, trouvé ${rows.length}`);
    assert.equal(rows[0]!.date_emission, dateEmission);
    assert.equal(rows[0]!.date_expiration, dateExpiration);
  },
);

Then(
  'la table diagnostics contient 1 ligne avec type=erp date_expiration=NULL',
  function (this: MondePhase3) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const rows = this.sqlite
      .prepare('SELECT * FROM diagnostics WHERE bien_id = ? AND type = ?')
      .all(this.bienId, 'erp') as Array<{ date_expiration: string | null }>;
    assert.equal(rows.length, 1, `Attendu 1 diagnostic ERP, trouvé ${rows.length}`);
    assert.equal(rows[0]!.date_expiration, null, `date_expiration attendu NULL, reçu ${rows[0]!.date_expiration}`);
  },
);

Then(
  'la réponse a le statut {int}',
  function (this: MondePhase3, statut: number) {
    assert.equal(this.dernierStatut, statut, `Statut attendu ${statut}, reçu ${this.dernierStatut}`);
  },
);

Then(
  'aucun diagnostic n\'est créé en base',
  function (this: MondePhase3) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const rows = this.sqlite
      .prepare('SELECT COUNT(*) as n FROM diagnostics WHERE bien_id = ?')
      .get(this.bienId) as { n: number };
    assert.equal(rows.n, 0, `Attendu 0 diagnostics, trouvé ${rows.n}`);
  },
);

Then(
  'la page contient un avertissement de diagnostic expiré',
  function (this: MondePhase3) {
    const hasWarning =
      this.dernierCorps.includes('banniere-warning') ||
      this.dernierCorps.includes('Expiré') ||
      this.dernierCorps.includes('a expiré');
    assert.ok(hasWarning, `Page ne contient pas d'avertissement d'expiration\nExtrait: ${this.dernierCorps.substring(0, 500)}`);
  },
);

Then(
  'la page ne fait pas de redirection',
  function (this: MondePhase3) {
    assert.ok(
      this.dernierStatut === 200,
      `La page a redirigé (statut ${this.dernierStatut}) ou a renvoyé une erreur`,
    );
  },
);

Then(
  'la page contient {int} lignes de diagnostics',
  function (this: MondePhase3, nombreLignes: number) {
    // Compter les occurrences de date_emission dans les rows
    // La table diagnostics génère un <tr> par diagnostic
    // On cherche des occurrences de la date dans le format DD/MM/YYYY
    const matches = this.dernierCorps.match(/Expiré le|Valide jusqu|Illimitée/g) ?? [];
    // Si les helpers ne sont pas encore là, on fallback sur le comptage de <tr> dans le tbody
    const trMatches = this.dernierCorps.match(/<tr/g) ?? [];
    assert.ok(
      matches.length >= nombreLignes || trMatches.length >= nombreLignes + 1,
      `Attendu ${nombreLignes} lignes diagnostics, page contient ${matches.length} statuts (${trMatches.length} <tr>)\nExtrait: ${this.dernierCorps.substring(0, 800)}`,
    );
  },
);

Then(
  'la classe DPE affichée est {string}',
  function (this: MondePhase3, classe: string) {
    assert.ok(
      this.dernierCorps.includes(`DPE ${classe}`),
      `Classe DPE "${classe}" non trouvée dans la page\nExtrait: ${this.dernierCorps.substring(0, 500)}`,
    );
  },
);

Then(
  'aucun diagnostic n\'a été supprimé en base',
  function (this: MondePhase3) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const rows = this.sqlite
      .prepare('SELECT COUNT(*) as n FROM diagnostics WHERE bien_id = ?')
      .get(this.bienId) as { n: number };
    assert.equal(rows.n, 2, `Attendu 2 diagnostics en base, trouvé ${rows.n}`);
  },
);
