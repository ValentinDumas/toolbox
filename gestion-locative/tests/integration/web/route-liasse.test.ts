/**
 * Tests d'intégration HTTP — GET /fiscalite/declarations/:id/liasse
 * (Phase 6 / FIS-05 Plan 06-01 Task 3).
 *
 * Couvre :
 *   - 200 régime réel : vue HTML rendue avec bandeau S1 + 5 tableaux ARIA-labelés.
 *   - 404 déclaration inexistante : page d'erreur générique (sans révéler l'ID).
 *   - 422 régime micro-BIC Wave 1 : page d'erreur explicite.
 *
 * Le test 422 mapping non couvert nécessite l'injection d'un provider fake
 * (Wave 1 main.ts utilise l'impl mémoire). On le couvre via le test unit
 * `mapping-liasse-provider.test.ts` + un test direct du use case
 * (`generer-brouillon-liasse.test.ts` Test 3).
 *
 * Pattern : `tests/integration/web/accessibility-phase3.test.ts` + app.inject().
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { DeclarationAnnuelle } from '../../../src/domain/fiscalite/declaration-annuelle.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { unBailleurValide } from '../../_builders/identite.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
  declarationId: DeclarationAnnuelleId;
}

async function setupAvecDeclarationReel(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-liasse-phase6-32chars!!!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-12-31');
  const app = await creerApp(db, { clock });

  // Seed bailleur + déclaration annuelle clôturée régime réel.
  const bailleurRepo = new BailleurRepositorySqlite(db);
  const bailleur = unBailleurValide({ nomComplet: 'Alice Martin' });
  await bailleurRepo.enregistrer(bailleur);

  const declRepo = new DeclarationAnnuelleRepositorySqlite(db);
  const decl = DeclarationAnnuelle.creer({
    bailleurId: bailleur.id as BailleurId,
    exercice: 2026,
    regimeApplique: 'reel',
    recettesTotales: Money.fromEuros(12_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.fromEuros(1_500),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.fromEuros(300),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.fromEuros(3_500),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[{"type":"gros_oeuvre","montantHt":20000000}]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
  await declRepo.enregistrer(decl);

  return {
    app,
    db,
    sqlite,
    declarationId: decl.id,
  };
}

async function setupAvecDeclarationMicroBic(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-liasse-phase6-32chars!!!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-12-31');
  const app = await creerApp(db, { clock });

  const bailleurRepo = new BailleurRepositorySqlite(db);
  const bailleur = unBailleurValide();
  await bailleurRepo.enregistrer(bailleur);

  const declRepo = new DeclarationAnnuelleRepositorySqlite(db);
  const decl = DeclarationAnnuelle.creer({
    bailleurId: bailleur.id as BailleurId,
    exercice: 2026,
    regimeApplique: 'micro_bic',
    recettesTotales: Money.fromEuros(30_000),
    chargesQualifieesParCategorie: {
      entretien_reparation: Money.zero(),
      amelioration: Money.zero(),
      charge_courante_periodique: Money.zero(),
      non_deductible: Money.zero(),
      non_qualifie: Money.zero(),
    },
    dotationAmortissement: Money.zero(),
    ardGenere: Money.zero(),
    ardConsomme: Money.zero(),
    revenusFoyerSnapshot: Money.fromEuros(40_000),
    statutLmnpLmp: 'lmnp_confirme',
    composantsSnapshot: '[]',
    clotureLe: Temporal.PlainDate.from('2026-12-31'),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
  await declRepo.enregistrer(decl);

  return { app, db, sqlite, declarationId: decl.id };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('Route GET /fiscalite/declarations/:id/liasse (Phase 6 / FIS-05 Wave 1)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  it('200 régime réel — rend la vue brouillon avec bandeau S1 + 5 tableaux ARIA-labelés', async () => {
    ctx = await setupAvecDeclarationReel();

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse`,
    });

    expect(res.statusCode).toBe(200);
    // Bandeau S1 brouillon (UI-SPEC §S1)
    expect(res.body).toContain('Brouillon liasse fiscale 2026');
    expect(res.body).toContain('À reporter case-par-case');
    expect(res.body).toContain('role="status"');
    // ARIA labels par annexe (UI-SPEC §Accessibilité)
    expect(res.body).toMatch(/aria-label="Annexe 2031-SD/);
    expect(res.body).toMatch(/aria-label="Annexe 2033-A/);
    expect(res.body).toMatch(/aria-label="Annexe 2033-B/);
    expect(res.body).toMatch(/aria-label="Annexe 2033-C/);
    expect(res.body).toMatch(/aria-label="Annexe 2033-D/);
    // Nom du bailleur dans le titre
    expect(res.body).toContain('Alice Martin');
  });

  it('200 régime réel — case FC (recettes) rendue en monospace + valeur 12 000 €', async () => {
    ctx = await setupAvecDeclarationReel();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse`,
    });
    expect(res.statusCode).toBe(200);
    // Numéro de case en monospace (UI-SPEC §Typography)
    expect(res.body).toMatch(/class="case-cerfa"[^>]*font-family:ui-monospace/);
    expect(res.body).toContain('>FC<');
    // Valeur 12 000 € (espace insécable U+00A0 entre nombre et €)
    expect(res.body).toMatch(/12\s*000,00\s*€/);
  });

  it('200 régime réel — bandeau "postes à compléter manuellement" sur 2033-A (S3)', async () => {
    ctx = await setupAvecDeclarationReel();
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Bilan simplifié (2033-A)');
    expect(res.body).toContain('à compléter manuellement');
  });

  it('404 — déclaration introuvable, message générique sans révéler l\'ID (T-06-LIASSE-W1-01)', async () => {
    ctx = await setupAvecDeclarationReel();
    const inconnuId = crypto.randomUUID();

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${inconnuId}/liasse`,
    });

    expect(res.statusCode).toBe(404);
    expect(res.body).toContain('Déclaration introuvable');
    // Le message ne doit PAS exposer l'UUID dans la réponse HTML.
    expect(res.body).not.toContain(inconnuId);
  });

  it('200 — régime micro-BIC : rend la section 2042-C-PRO avec la case 5NI (Plan 06-02)', async () => {
    ctx = await setupAvecDeclarationMicroBic();

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/fiscalite/declarations/${ctx.declarationId}/liasse`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('2042-C-PRO');
    expect(res.body).toContain('5NI');
    // Recettes brutes (30 000 € — pas le net après abattement 15 000 €)
    expect(res.body).toMatch(/30[\s ]?000,00/);
  });
});
