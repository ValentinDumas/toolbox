/**
 * Tests d'intégration WCAG 2.1 AA — Phase 3 (plan 03-05).
 *
 * Vérifie sur les vues Phase 3 :
 *  - aria-label sur badges DPE et tables (1.4.1 + 4.1.2)
 *  - role=alert + aria-live=assertive + autofocus + tabindex=-1 sur gel-loyer (4.1.3)
 *  - <nav aria-label> + <ol> + <li aria-current="step"> sur wizard IRL (4.1.2)
 *  - <fieldset><legend> sur formulaire mobilier (1.3.1)
 *  - sidebar aria-current="page" selon navActive (4.1.2)
 *  - print.css servi via fastify-static et lié en media="print"
 *
 * Pattern : Vitest + app.inject() (cf. relances-mailto.test.ts Phase 1).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { ClasseDpe } from '../../../src/domain/_shared/duree-validite-diagnostic.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { BailRepositorySqlite } from '../../../src/infrastructure/repositories/bail-repository-sqlite.js';
import { LocataireRepositorySqlite } from '../../../src/infrastructure/repositories/locataire-repository-sqlite.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { unBienValide, unLotValide, unDiagnosticDpeValide } from '../../_builders/patrimoine.js';
import { unLocataireValide, unBailIndexableValide } from '../../_builders/locatif.js';
import type {
  BienId,
  LotId,
  LocataireId,
  BailId,
} from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  bienId: BienId;
  lotId: LotId;
  bailId: BailId;
}

async function setupBienEtBail(classeDpe: ClasseDpe): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-a11y-phase3-32chars!!!!';
  const sqlite = new Database(':memory:');
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-05-15');
  const app = await creerApp(db, { clock });

  const bienRepo = new BienRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);

  const lot = unLotValide({ designation: 'Principal' });
  const diagnosticDpe = unDiagnosticDpeValide({ classeDpe });
  const bien = unBienValide({ lots: [lot], classeDpe, diagnostics: [diagnosticDpe] });
  await bienRepo.enregistrer(bien);

  const locataire = unLocataireValide();
  await locataireRepo.enregistrer(locataire);

  const bail = unBailIndexableValide({
    locataireId: locataire.id as LocataireId,
    bienId: bien.id as BienId,
    lotIds: [lot.id as LotId],
    dateDebut: Temporal.PlainDate.from('2025-05-01'),
    loyerHc: Money.fromEuros(800),
    irlReference: IRL.creer({ trimestre: '2024-T4', valeur: '142.06' }),
  });
  await bailRepo.enregistrer(bail);

  return {
    app,
    db,
    sqlite,
    bienId: bien.id as BienId,
    lotId: lot.id as LotId,
    bailId: bail.id as BailId,
  };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('accessibilité Phase 3 — WCAG 2.1 AA (plan 03-05)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  it('partial-badge-dpe rend aria-label="Classe DPE : F" + texte visible "DPE F"', async () => {
    ctx = await setupBienEtBail('F');
    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/aria-label="Classe DPE : F"/);
    expect(res.body).toContain('DPE F');
  });

  it('partial-badge-dpe rend aria-label="Classe DPE : D" pour classe D', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/aria-label="Classe DPE : D"/);
    expect(res.body).toContain('DPE D');
  });

  it('wizard-irl-layout rend <nav aria-label="Étapes de la révision IRL"> + <li aria-current="step">', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: `/baux/${ctx.bailId}/indexer` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/aria-label="Étapes de la révision IRL"/);
    expect(res.body).toMatch(/aria-current="step"/);
    expect(res.body).toMatch(/Étape\s+\d\s+sur\s+5/);
  });

  it('gel-loyer.ejs rend role=alert + aria-live=assertive + autofocus + tabindex=-1', async () => {
    ctx = await setupBienEtBail('F');
    const res = await ctx.app.inject({ method: 'GET', url: `/baux/${ctx.bailId}/indexer` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/role="alert"/);
    expect(res.body).toMatch(/aria-live="assertive"/);
    expect(res.body).toContain('autofocus');
    expect(res.body).toMatch(/tabindex="-1"/);
    expect(res.body).toContain('décret n° 2022-1313');
  });

  it('partial-edl-form rend <fieldset><legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/baux/${ctx.bailId}/edl/entree/nouveau`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<fieldset>');
    expect(res.body).toContain(
      'Inventaire mobilier (décret 2015-981) — 12 items obligatoires',
    );
  });

  it('table diagnostics aria-label="Diagnostics du bien" présent sur fiche Bien', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/aria-label="Diagnostics du bien"/);
  });

  it('sidebar navActive=biens marque /biens/:id/diagnostics/nouveau avec aria-current="page"', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/biens/${ctx.bienId}/diagnostics/nouveau`,
    });
    expect(res.statusCode).toBe(200);
    // Le lien Biens doit porter aria-current="page"
    expect(res.body).toMatch(/<a href="\/biens" aria-current="page">Biens<\/a>/);
  });

  it('sidebar navActive=baux marque /baux/:id/indexer avec aria-current="page" sur Baux', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: `/baux/${ctx.bailId}/indexer` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(/<a href="\/baux" aria-current="page">Baux<\/a>/);
  });

  it('layout-debut inclut <link rel="stylesheet" href="/styles/print.css" media="print">', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: `/biens/${ctx.bienId}` });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatch(
      /<link rel="stylesheet" href="\/styles\/print\.css" media="print"\s*\/?>/,
    );
  });

  it('print.css est servi en static avec content-type CSS', async () => {
    ctx = await setupBienEtBail('D');
    const res = await ctx.app.inject({ method: 'GET', url: '/styles/print.css' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/css/);
    // Vérifier qu'il contient bien les règles @media print
    expect(res.body).toContain('@media print');
    expect(res.body).toContain('display: none');
  });
});
