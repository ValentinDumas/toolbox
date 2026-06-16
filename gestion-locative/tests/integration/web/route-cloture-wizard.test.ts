/**
 * Tests d'intégration HTTP — GET /fiscalite/cloturer/:exercice/etape/{1..5}
 * (Phase 9 / QUA-01 — régression UAT liasse).
 *
 * Régression : les 5 vues du wizard de clôture (etape-1..5.ejs) incluaient leurs
 * partials avec une profondeur relative erronée (`../../../../partials/...`, 4 niveaux
 * au lieu de 3). @fastify/view + EJS échouait à résoudre le chemin
 * (ENOENT `…/toolbox/partials/layout-debut.ejs`) et rendait la page d'erreur 500.
 * Aucun test ne rendait ces vues (les tests de clôture exercent le use-case en mémoire),
 * donc le crash a survécu depuis la création (commit 18fcf49) jusqu'à l'UAT Phase 9.
 *
 * Ce test rend chaque étape via app.inject() et exige un 200 + le contenu attendu,
 * pas la page « Erreur inattendue ».
 *
 * Pattern : `tests/integration/web/route-liasse.test.ts` + app.inject().
 *
 * @tags @phase9 @qua-01 integration
 */

import { describe, it, expect, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { unBailleurValide } from '../../_builders/identite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface Contexte {
  app: Awaited<ReturnType<typeof creerApp>>;
  db: Kysely<DB>;
  sqlite: InstanceType<typeof Database>;
}

async function setup(): Promise<Contexte> {
  process.env['SESSION_SECRET'] = 'test-secret-cloture-wizard-phase9-32chars!!';
  const sqlite = new Database(':memory:');
  activerPragmas(sqlite);
  const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

  const clock = ClockFixe.du('2026-12-31');
  const app = await creerApp(db, { clock });

  const bailleurRepo = new BailleurRepositorySqlite(db);
  await bailleurRepo.enregistrer(unBailleurValide({ nomComplet: 'Alice Martin' }));

  return { app, db, sqlite };
}

async function fermer(ctx: Contexte): Promise<void> {
  await ctx.app.close();
  await ctx.db.destroy();
}

describe('Routes GET /fiscalite/cloturer/:exercice/etape/{1..5} (Phase 9 / QUA-01)', () => {
  let ctx: Contexte;

  afterEach(async () => {
    if (ctx) await fermer(ctx);
  });

  const etapes: ReadonlyArray<{ n: number; heading: string }> = [
    { n: 1, heading: 'Étape 1 — Vérification des prérequis' },
    { n: 2, heading: 'Étape 2 — Revenus du foyer' },
    { n: 3, heading: 'Étape 3 — Comparatif micro-BIC / régime réel' },
    { n: 4, heading: 'Étape 4 — Confirmation' },
  ];

  for (const { n, heading } of etapes) {
    it(`200 étape ${n} — rend la vue wizard (régression include partials)`, async () => {
      ctx = await setup();
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/fiscalite/cloturer/2026/etape/${n}`,
      });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain(heading);
      // La page d'erreur ne doit jamais être rendue (le bug rendait "Erreur inattendue").
      expect(res.body).not.toContain('Erreur inattendue');
      expect(res.body).not.toContain('layout-debut.ejs');
    });
  }

  it('200 étape 5 — rend la vue de soumission finale (régression include partials)', async () => {
    ctx = await setup();
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/fiscalite/cloturer/2026/etape/5',
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Clôturer');
    expect(res.body).not.toContain('Erreur inattendue');
    expect(res.body).not.toContain('layout-debut.ejs');
  });
});
