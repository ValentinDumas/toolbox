/**
 * Step definitions @phase7-dashboard : dashboard DAS-01 (Phase 7 / D-DASH-01..04).
 *
 * Stratégie : montage Fastify via creerApp + DB in-memory + ClockFixe + app.inject.
 * Harnais miroir de activation.steps.ts.
 *
 * Couverture :
 *   - composition 4 sections ARIA (D-DASH-02)
 *   - top 5 alertes critiques + tri ASC urgence (D-DASH-03 / D-DASH-04)
 *   - état zen "Vous êtes à jour" (toutes sections vides)
 *   - redirection premier lancement → /wizard/bien (D-DASH-01 / KPI Activation Phase 1)
 *
 * NOTE : les step definitions génériques "la page contient/ne contient pas {string}"
 * sont déclarées dans activation.steps.ts — ne pas dupliquer ici.
 *
 * Tags : @phase7 @phase7-dashboard
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { After, Before, Given, Then, When, World } from '@cucumber/cucumber';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { marquerWizardComplete } from '../../../src/infrastructure/lifecycle/premier-lancement.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unBailIndexableValide, unLocataireValide } from '../../_builders/locatif.js';
import { uneDeclarationCfe } from '../../_builders/fiscalite.js';
import type { BienId, LotId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

// Date fixe : 2026-06-12 — alertes CFE avec dateEcheancePaiement proche (joursRestants <= 7)
const TODAY_STR = '2026-06-12';
const TODAY = Temporal.PlainDate.from(TODAY_STR);

interface MondeDashboard extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  bienId: BienId | null;
  [key: string]: unknown;
}

Before({ tags: '@phase7-dashboard' }, async function (this: MondeDashboard) {
  process.env['SESSION_SECRET'] = 'test-secret-for-phase7-dashboard-32chars!!';
  this.sqlite = new Database(':memory:');
  activerPragmas(this.sqlite);
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du(TODAY_STR);
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.bienId = null;
});

After({ tags: '@phase7-dashboard' }, async function (this: MondeDashboard) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
  if (this.sqlite) this.sqlite.close();
});

// ─── Given ────────────────────────────────────────────────────────────────────

Given(
  /^le wizard est complété avec un bien et un bail actif$/,
  async function (this: MondeDashboard) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const locataireRepo = new LocataireRepositorySqlite(this.db);
    const bailRepo = new BailRepositorySqlite(this.db);

    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;

    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);

    // bail avec anniversary lointain (> J+30) pour ne pas déclencher d'alerte IRL par défaut
    // lotIds doit référencer les lots du bien (FK bail_lots.lot_id → lot.id)
    const lotIds = bien.lots.map((l) => l.id as LotId);
    const bail = unBailIndexableValide({
      bienId: bien.id,
      locataireId: locataire.id,
      lotIds,
      dateDebut: Temporal.PlainDate.from('2025-01-01'),
      dureeMois: 24,
    });
    await bailRepo.enregistrer(bail);

    await marquerWizardComplete(this.db);
  },
);

Given(
  /^une alerte critique existe \(joursRestants 3\)$/,
  async function (this: MondeDashboard) {
    assert.ok(this.db && this.bienId, 'DB et bienId requis');
    const cfeRepo = new DeclarationCfeRepositorySqlite(this.db);
    // joursRestants = 3 → dateEcheancePaiement = today + 3 jours (dans la fenêtre <= 7)
    const decl = uneDeclarationCfe({
      bienId: this.bienId,
      statut: 'non_deposee',
      dateEcheancePaiement: TODAY.add({ days: 3 }),
    });
    await cfeRepo.enregistrer(decl);
  },
);

Given(
  /^6 alertes critiques existent \(joursRestants 1\.\.6\)$/,
  async function (this: MondeDashboard) {
    assert.ok(this.db && this.bienId, 'DB et bienId requis');
    const bienRepo = new BienRepositorySqlite(this.db);
    const cfeRepo = new DeclarationCfeRepositorySqlite(this.db);

    // Créer 6 biens + déclarations CFE avec joursRestants 1..6 (tous <= 7 → critiques)
    for (let i = 1; i <= 6; i++) {
      const bien = unBienValide();
      await bienRepo.enregistrer(bien);
      const decl = uneDeclarationCfe({
        bienId: bien.id,
        statut: 'non_deposee',
        dateEcheancePaiement: TODAY.add({ days: i }),
        millesime: 2020 + i,
      });
      await cfeRepo.enregistrer(decl);
    }
  },
);

Given(
  /^des alertes critiques de joursRestants variés \(5, 1, 3\)$/,
  async function (this: MondeDashboard) {
    assert.ok(this.db && this.bienId, 'DB et bienId requis');
    const bienRepo = new BienRepositorySqlite(this.db);
    const cfeRepo = new DeclarationCfeRepositorySqlite(this.db);

    // Créer 3 biens + déclarations CFE (j=5, j=1, j=3 — insérés dans le désordre volontairement)
    for (const jours of [5, 1, 3]) {
      const bien = unBienValide();
      await bienRepo.enregistrer(bien);
      const decl = uneDeclarationCfe({
        bienId: bien.id,
        statut: 'non_deposee',
        dateEcheancePaiement: TODAY.add({ days: jours }),
        millesime: 2020 + jours,
      });
      await cfeRepo.enregistrer(decl);
    }
  },
);

Given(
  /^aucun impayé, alerte ni échéance à venir n'existe$/,
  function (this: MondeDashboard) {
    // DB contient seulement le bien + bail du Background sans CFE déclarée.
    // Le bail a dateDebut=2025-01-01, dureeMois=24 : fin = 2027-01-01 (> J+30).
    // Aucune échéance non payée dans la fenêtre [today, today+2mois).
    // → etatGlobal = 'a_jour'
  },
);

Given(
  /^l'application est dans un état de premier lancement \(aucun bien\)$/,
  function (this: MondeDashboard) {
    // DB vide — Before crée la DB mais ne marque pas wizard_complete.
    // estPremierLancement(db) retournera true → redirect /wizard/bien.
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When(
  "je visite {string}",
  async function (this: MondeDashboard, url: string) {
    assert.ok(this.app, 'App doit être initialisée');
    const reponse = await this.app.inject({
      method: 'GET',
      url,
    });
    this.dernierStatut = reponse.statusCode;
    this.derniereUrl = (reponse.headers['location'] as string) ?? '';
    this.dernierCorps = reponse.body;
  },
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then(
  "la réponse a un statut {int}",
  function (this: MondeDashboard, statutAttendu: number) {
    assert.strictEqual(
      this.dernierStatut,
      statutAttendu,
      `Statut HTTP attendu ${statutAttendu}, obtenu ${this.dernierStatut}`,
    );
  },
);

Then(
  "la page contient au plus 5 bannières d'alerte",
  function (this: MondeDashboard) {
    // Compter les occurrences de 'aria-label="Alerte ' dans le HTML rendu
    const matches = this.dernierCorps.match(/aria-label="Alerte /g) ?? [];
    assert.ok(
      matches.length <= 5,
      `Au plus 5 bannières d'alerte attendues, obtenu ${matches.length}`,
    );
    assert.ok(matches.length > 0, 'Au moins 1 bannière d\'alerte doit être présente');
  },
);

Then(
  "la première bannière d'alerte rendue est la plus urgente",
  function (this: MondeDashboard) {
    // La première alerte (j=1) doit apparaître avant j=3 et j=5 dans le HTML
    const pos1 = this.dernierCorps.indexOf('dans 1 jour');
    const pos3 = this.dernierCorps.indexOf('dans 3 jours');
    const pos5 = this.dernierCorps.indexOf('dans 5 jours');
    assert.ok(pos1 !== -1, 'La bannière j=1 doit être présente');
    assert.ok(pos3 !== -1, 'La bannière j=3 doit être présente');
    assert.ok(pos5 !== -1, 'La bannière j=5 doit être présente');
    assert.ok(
      pos1 < pos3 && pos3 < pos5,
      `Ordre ASC attendu (j=1 avant j=3 avant j=5), positions: j1=${pos1}, j3=${pos3}, j5=${pos5}`,
    );
  },
);

Then(
  "la réponse est une redirection 302 vers {string}",
  function (this: MondeDashboard, urlAttendue: string) {
    assert.strictEqual(
      this.dernierStatut,
      302,
      `Statut 302 attendu, obtenu ${this.dernierStatut}`,
    );
    assert.ok(
      this.derniereUrl === urlAttendue || this.derniereUrl.endsWith(urlAttendue),
      `Redirection vers "${urlAttendue}" attendue, obtenu "${this.derniereUrl}"`,
    );
  },
);
