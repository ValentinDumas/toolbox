import { fileURLToPath } from 'node:url';
import path from 'node:path';

import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import type { Kysely } from 'kysely';
import { formatDate } from './helpers/format-date.js';
import { formatMoney } from './helpers/format-money.js';

// Augmente FastifyReply pour supporter `reply.locals` (injection EJS via @fastify/view defaultContext workaround)
declare module 'fastify' {
  interface FastifyReply {
    locals: Record<string, unknown>;
  }
}

import type { DB } from './infrastructure/db/kysely-types.js';
import { ouvrirDb, cheminBaseParDefaut, appliquerMigrationsBrutes } from './infrastructure/db/database.js';
import { BienRepositorySqlite } from './infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from './infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from './infrastructure/repositories/bail-repository-sqlite.js';
import { plugin as racinePlugin } from './web/routes/racine.js';
import { plugin as biensPlugin } from './web/routes/biens.js';
import { plugin as locatairesPlugin } from './web/routes/locataires.js';
import { plugin as bauxPlugin } from './web/routes/baux.js';
import { plugin as wizardPlugin } from './web/routes/wizard.js';
import {
  verifierDejaLance,
  ecrirePidfile,
  supprimerPidfile,
} from './infrastructure/lifecycle/pidfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function creerApp(db: Kysely<DB>): Promise<ReturnType<typeof Fastify>> {
  const logLevel = process.env['LOG_LEVEL'] ?? 'silent';

  // DP-05: SESSION_SECRET fail-fast — 32+ chars requis
  const sessionSecret = process.env['SESSION_SECRET'];
  if (!sessionSecret || sessionSecret.length < 32) {
     
    console.error(
      'FATAL: SESSION_SECRET manquant ou < 32 caractères. Générer avec : openssl rand -hex 32',
    );
    process.exit(1);
  }

  const app = Fastify({
    logger: {
      level: logLevel,
      transport: process.env['NODE_ENV'] !== 'production' && logLevel !== 'silent'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: sessionSecret,
    cookieName: 'glo-session',
    cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 24 * 3600 * 1000, path: '/' },
    saveUninitialized: false,
  });

  await app.register(fastifyFormbody);
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '../public'),
    prefix: '/',
  });

  await app.register(fastifyView, {
    engine: { ejs: (await import('ejs')).default },
    root: path.join(__dirname, 'web/views'),
    viewExt: 'ejs',
  });

  const repo = new BienRepositorySqlite(db);
  const locataireRepo = new LocataireRepositorySqlite(db);
  const bailRepo = new BailRepositorySqlite(db);

  // Hook global : injecte les helpers de format français dans les locals EJS.
  // reply.locals est lu par @fastify/view et fusionné dans les données de chaque vue.
  // Les routes continuent à gérer banniereSuccess elles-mêmes (pas de double lecture de session).
  app.addHook('preHandler', async (_req, reply) => {
    reply.locals = {
      ...(reply.locals ?? {}),
      formatDate,
      formatMoney,
    };
  });

  await app.register(racinePlugin, { db });
  await app.register(wizardPlugin, { db, bienRepo: repo, locataireRepo, bailRepo });
  await app.register(biensPlugin, { repo });
  await app.register(locatairesPlugin, { repo: locataireRepo, bailRepo });
  await app.register(bauxPlugin, { bailRepo, bienRepo: repo, locataireRepo });

  return app;
}

async function demarrer(): Promise<void> {
  const PORT = parseInt(process.env['PORT'] ?? '7878', 10);
  const HOST = process.env['HOST'] ?? '127.0.0.1';

  // Migration CLI
  if (process.argv.includes('migrate')) {
    const { default: BetterSqlite3 } = await import('better-sqlite3');
    const chemin = cheminBaseParDefaut();
    const sqlite = new BetterSqlite3(chemin);
    const { Kysely, SqliteDialect } = await import('kysely');
    const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    const migrationsPath = path.join(__dirname, '../migrations/0001_init.sql');
    await appliquerMigrationsBrutes(db, sqlite, migrationsPath);
    await db.destroy();
    console.log(`Migration appliquée : ${chemin}`);
    process.exit(0);
  }

  const cheminDb = cheminBaseParDefaut();
  const dossierDb = path.dirname(cheminDb);

  if (verifierDejaLance(dossierDb, PORT)) {
    process.exit(1);
  }

  const { db, sqlite } = ouvrirDb(cheminDb);
  const migrationsPath = path.join(__dirname, '../migrations/0001_init.sql');
  await appliquerMigrationsBrutes(db, sqlite, migrationsPath);

  const app = await creerApp(db);

  ecrirePidfile(dossierDb);

  const cleanup = async (): Promise<void> => {
    supprimerPidfile(dossierDb);
    await app.close();
    await db.destroy();
  };

  process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });

  await app.listen({ port: PORT, host: HOST });
  console.log(`Gestion locative — http://${HOST}:${PORT}`);
  console.log(`Base de données : ${cheminDb}`);
}

// Entrée principale
if (import.meta.url === `file://${process.argv[1]}`) {
  await demarrer();
}
