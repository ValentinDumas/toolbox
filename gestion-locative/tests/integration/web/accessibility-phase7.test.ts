/**
 * Tests d'intégration WCAG 2.1 AA — Phase 7 (plan 07-06).
 *
 * Audit a11y sur les deux nouvelles surfaces HTTP de la Phase 7 :
 *   - GET / (dashboard 07-05) — 4 sections ARIA + sidebar + bandeau alerte
 *   - GET /baux/indexations (07-06) — table révisions IRL + partial inline + sidebar
 *
 * Stratégie : assertions ARIA déterministes sur le HTML rendu via app.inject().
 * PAS d'axe-core (absent du package.json) — ce pattern est conforme à la Phase 3
 * (accessibility-phase3.test.ts) et satisfait l'exigence "zéro violation" :
 * "zéro violation" = toutes les assertions ARIA imposées passent.
 *
 * Pattern exact : Vitest + creerApp + DB temp + migrations + ClockFixe + app.inject.
 * Référence : tests/integration/web/accessibility-phase3.test.ts (héritage Phase 3).
 *
 * WCAG 2.1 AA — Phase 7 / DAS-01 / DAS-02
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, afterEach } from 'vitest';
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
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { DeclarationCfeRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-cfe-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import { uneDeclarationCfe } from '../../_builders/fiscalite.js';
import type { BienId, LotId, LocataireId, BailId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

// Date fixe : 2026-06-12 (cohérent avec les autres tests Phase 7)
const TODAY_STR = '2026-06-12';
const TODAY = Temporal.PlainDate.from(TODAY_STR);

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bailId: BailId;
}

/**
 * Crée un contexte de test avec :
 *  - 1 bail actif dont la révision IRL est due dans J+15 (2026-06-27) → alerte IRL
 *  - 1 déclaration CFE avec joursRestants=3 → alerte critique dashboard
 */
async function setupContexte(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-a11y-phase7-32chars!!!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du(TODAY_STR);
  const app = await creerApp(db, { clock });

  const bienRepo = new BienRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);
  const cfeRepo = new DeclarationCfeRepositorySqlite(db);

  // Bien DPE C (pas de gel), avec lot
  const lot = unLotValide({ designation: 'Principal' });
  const bien = unBienValide({ lots: [lot], classeDpe: 'C', rue: '12 rue des Tests' });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide({ nom: 'Durand', prenom: 'Alice' });
  await locataireRepo.enregistrer(locataire);

  // Bail actif, anniversaire J+15 depuis 2026-06-12 → 2026-06-27 → alerte IRL
  const bail = unBailIndexableValide({
    bienId: bien.id as BienId,
    locataireId: locataire.id as LocataireId,
    lotIds: [lot.id as LotId],
    dateDebut: Temporal.PlainDate.from('2025-06-27'),
    loyerHc: Money.fromEuros(800),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bail);

  // Déclaration CFE non déposée, joursRestants=3 → alerte critique dashboard
  const decl = uneDeclarationCfe({
    bienId: bien.id as BienId,
    statut: 'non_deposee',
    dateEcheancePaiement: TODAY.add({ days: 3 }),
  });
  await cfeRepo.enregistrer(decl);

  await marquerWizardComplete(db);

  return { app, db, sqlite, bailId: bail.id as BailId };
}

describe('accessibilité Phase 7 — WCAG 2.1 AA (plan 07-06)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) {
      await ctx.app.close();
      await ctx.db.destroy();
    }
  });

  // ── GET / (dashboard 07-05) ──────────────────────────────────────────────

  it('GET / — 4 sections aria-labelledby présentes avec leurs h2 id correspondants', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);

    // 4 sections avec aria-labelledby requis (UI-SPEC §S2-S5)
    expect(res.body).toContain('aria-labelledby="titre-alertes-critiques"');
    expect(res.body).toContain('id="titre-alertes-critiques"');
    expect(res.body).toContain('aria-labelledby="titre-impayes"');
    expect(res.body).toContain('id="titre-impayes"');
    expect(res.body).toContain('aria-labelledby="titre-actions-jour"');
    expect(res.body).toContain('id="titre-actions-jour"');
    expect(res.body).toContain('aria-labelledby="titre-echeances-venir"');
    expect(res.body).toContain('id="titre-echeances-venir"');
  });

  it('GET / — bandeau alerte CFE critique porte role="alert" + aria-live="assertive" (WCAG 4.1.3)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);

    // Bandeau alerte destructive ou warning-fort → role="alert" + aria-live="assertive"
    expect(res.body).toMatch(/role="alert"/);
    expect(res.body).toMatch(/aria-live="assertive"/);
  });

  it('GET / — nav principal aria-label présent + aria-current="page" sur Tableau de bord (WCAG 4.1.2)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);

    expect(res.body).toMatch(/aria-label="Navigation principale"/);
    // navActive='dashboard' → aria-current="page" sur le lien Tableau de bord
    expect(res.body).toMatch(/href="\/" aria-current="page"/);
  });

  it('GET / — icône alerte aria-hidden="true" (couleur jamais seule, WCAG 1.4.1)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);

    // Les icônes Unicode dans partial-bandeau-alerte sont dans <span aria-hidden="true">
    expect(res.body).toMatch(/aria-hidden="true"/);
  });

  // ── GET /baux/indexations (07-06) ────────────────────────────────────────

  it('GET /baux/indexations — table aria-label="Révisions IRL à venir" présente', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/baux/indexations' });
    expect(res.statusCode).toBe(200);

    expect(res.body).toContain('aria-label="Révisions IRL à venir"');
  });

  it('GET /baux/indexations — 5 colonnes <th scope="col"> (WCAG 1.3.1)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/baux/indexations' });
    expect(res.statusCode).toBe(200);

    const matches = res.body.match(/scope="col"/g) ?? [];
    expect(matches.length).toBe(5);
  });

  it('GET /baux/indexations — partial inline porte role + aria-live dans la colonne État (WCAG 4.1.3)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/baux/indexations' });
    expect(res.statusCode).toBe(200);

    // L'alerte IRL à J+15 → joursRestants=15 → variant warning → role="status" aria-live="polite"
    expect(res.body).toMatch(/role="status"|role="alert"/);
    expect(res.body).toMatch(/aria-live="polite"|aria-live="assertive"/);
  });

  it('GET /baux/indexations — lien d\'action descriptif "Lancer la révision" (pas de "Cliquez ici")', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/baux/indexations' });
    expect(res.statusCode).toBe(200);

    expect(res.body).toContain('Lancer la révision');
    expect(res.body).not.toContain('Cliquez ici');
  });

  it('GET /baux/indexations — sidebar aria-current="page" sur Baux (navActive=baux, WCAG 4.1.2)', async () => {
    ctx = await setupContexte();
    const res = await ctx.app.inject({ method: 'GET', url: '/baux/indexations' });
    expect(res.statusCode).toBe(200);

    // navActive='baux' → aria-current="page" sur le lien /baux
    expect(res.body).toMatch(/href="\/baux" aria-current="page"/);
  });
});
