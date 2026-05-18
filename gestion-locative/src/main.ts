import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

import Fastify from 'fastify';
import fastifyView from '@fastify/view';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyMultipart from '@fastify/multipart';
import type { Kysely } from 'kysely';
import { formatDate } from './helpers/format-date.js';
import { formatMoney } from './helpers/format-money.js';
import { formatPeriode } from './helpers/format-periode.js';
import { formaterClasseDpe } from './helpers/format-classe-dpe.js';
import { formaterTypeDiagnostic } from './helpers/format-type-diagnostic.js';
import { formaterStatutDiagnostic } from './helpers/format-statut-diagnostic.js';
import { formaterTypeItemInventaire } from './helpers/format-type-item-inventaire.js';
import { formaterEtatItem } from './helpers/format-etat-item.js';
import { formaterRaisonNonApplication } from './helpers/format-raison-non-application.js';
import { formaterTypeJustificatif } from './helpers/format-type-justificatif.js';
import { formaterTailleFichier } from './helpers/format-taille-fichier.js';
import { formaterAnneeFiscale } from './helpers/format-annee-fiscale.js';
import { formaterStatutTicket } from './helpers/format-statut-ticket.js';
import type { Clock } from './domain/_shared/clock.js';
import { ClockSysteme } from './domain/_shared/clock.js';
import type { ActiviteBailDetector } from './domain/locatif/activite-bail-detector.js';

// Augmente FastifyReply pour supporter `reply.locals` (injection EJS via @fastify/view defaultContext workaround)
declare module 'fastify' {
  interface FastifyReply {
    locals: Record<string, unknown>;
  }
}

import type { DB } from './infrastructure/db/kysely-types.js';
import { ouvrirDb, cheminBaseParDefaut, appliquerToutesMigrations } from './infrastructure/db/database.js';
import { BienRepositorySqlite } from './infrastructure/repositories/bien-repository-sqlite.js';
import { LocataireRepositorySqlite } from './infrastructure/repositories/locataire-repository-sqlite.js';
import { BailRepositorySqlite } from './infrastructure/repositories/bail-repository-sqlite.js';
import { BailleurRepositorySqlite } from './infrastructure/repositories/bailleur-repository-sqlite.js';
import { ActiviteBailDetectorSqlite } from './infrastructure/repositories/activite-bail-detector-sqlite.js';
import { EcheanceLoyerRepositorySqlite } from './infrastructure/repositories/echeance-loyer-repository-sqlite.js';
import { EncaissementRepositorySqlite } from './infrastructure/repositories/encaissement-repository-sqlite.js';
import { QuittanceRepositorySqlite } from './infrastructure/repositories/quittance-repository-sqlite.js';
import { StockageFichierLocal } from './infrastructure/storage/stockage-fichier-local.js';
import { PdfRendererPdfmake } from './infrastructure/pdf/pdf-renderer-pdfmake.js';
import { plugin as racinePlugin } from './web/routes/racine.js';
import { plugin as biensPlugin } from './web/routes/biens.js';
import { plugin as locatairesPlugin } from './web/routes/locataires.js';
import { plugin as bauxPlugin } from './web/routes/baux.js';
import { plugin as wizardPlugin } from './web/routes/wizard.js';
import { plugin as bailleurPlugin } from './web/routes/bailleur.js';
import { plugin as echeancesPlugin } from './web/routes/echeances.js';
import { plugin as encaissementsPlugin } from './web/routes/encaissements.js';
import { plugin as quittancesPlugin } from './web/routes/quittances.js';
import { plugin as impayesPlugin } from './web/routes/impayes.js';
import { plugin as relancesPlugin } from './web/routes/relances.js';
import { plugin as diagnosticsPlugin } from './web/routes/diagnostics.js';
import { plugin as etatsDesLieuxPlugin } from './web/routes/etats-des-lieux.js';
import { plugin as indexationsPlugin } from './web/routes/indexations.js';
import { plugin as coffrePlugin } from './web/routes/coffre.js';
import { plugin as travauxPlugin } from './web/routes/travaux.js';
import { EtatDesLieuxRepositorySqlite } from './infrastructure/repositories/etat-des-lieux-repository-sqlite.js';
import { BailIndexationRepositorySqlite } from './infrastructure/repositories/bail-indexation-repository-sqlite.js';
import { RelanceRepositorySqlite } from './infrastructure/repositories/relance-repository-sqlite.js';
import { JustificatifRepositorySqlite } from './infrastructure/repositories/justificatif-repository-sqlite.js';
import { StockageJustificatifsLocal } from './infrastructure/storage/stockage-justificatifs-local.js';
import { ConvertisseurImageSharp } from './infrastructure/image/convertisseur-image-sharp.js';
import { TicketTravauxRepositorySqlite } from './infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import {
  verifierDejaLance,
  ecrirePidfile,
  supprimerPidfile,
} from './infrastructure/lifecycle/pidfile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function creerApp(
  db: Kysely<DB>,
  opts: { clock?: Clock; activiteBailDetector?: ActiviteBailDetector } = {},
): Promise<ReturnType<typeof Fastify>> {
  const clock = opts.clock ?? new ClockSysteme();
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
  // Phase 4 — D-105 + D-116 : limits.fileSize 50 Mo / 1 fichier / 20 fields
  await app.register(fastifyMultipart, {
    limits: { fileSize: 52_428_800, files: 1, fields: 20 },
  });
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
  const bailleurRepo = new BailleurRepositorySqlite(db);
  const echeanceLoyerRepo = new EcheanceLoyerRepositorySqlite(db);
  const encaissementRepo = new EncaissementRepositorySqlite(db);
  const quittanceRepo = new QuittanceRepositorySqlite(db);
  const stockage = new StockageFichierLocal(
    process.env['GESTION_LOCATIVE_DATA_DIR'] ??
      path.join(os.homedir(), 'Library', 'Application Support', 'gestion-locative', 'documents'),
  );
  const pdfRenderer = new PdfRendererPdfmake();
  const edlRepo = new EtatDesLieuxRepositorySqlite(db);
  const bailIndexationRepo = new BailIndexationRepositorySqlite(db);
  const relanceRepo = new RelanceRepositorySqlite(db);
  const activiteBailDetector = opts.activiteBailDetector ?? new ActiviteBailDetectorSqlite(db);
  // Phase 4 — BC Documents
  const justificatifRepo = new JustificatifRepositorySqlite(db);
  const stockageJustificatifs = new StockageJustificatifsLocal(
    process.env['GESTION_LOCATIVE_DATA_DIR'] ??
      path.join(os.homedir(), 'Library', 'Application Support', 'gestion-locative', 'documents'),
  );
  const convertisseurImage = new ConvertisseurImageSharp();
  // Phase 4 — BC Travaux
  const ticketRepo = new TicketTravauxRepositorySqlite(db);

  // Hook global : injecte les helpers de format français dans les locals EJS.
  // reply.locals est lu par @fastify/view et fusionné dans les données de chaque vue.
  // Les routes continuent à gérer banniereSuccess elles-mêmes (pas de double lecture de session).
  app.addHook('preHandler', async (_req, reply) => {
    const today = clock.aujourdhui();
    reply.locals = {
      ...(reply.locals ?? {}),
      formatDate,
      formatMoney,
      formatPeriode,
      formaterClasseDpe,
      formaterTypeDiagnostic,
      formaterStatutDiagnostic,
      formaterTypeItemInventaire,
      formaterEtatItem,
      formaterRaisonNonApplication,
      formaterTypeJustificatif,
      formaterTailleFichier,
      formaterAnneeFiscale,
      formaterStatutTicket,
      today,
    };
  });

  // CR-07 : defense-in-depth XSS — Content-Security-Policy global.
  // 'unsafe-inline' est conservé pour les <script> inline existants
  // (modifier.ejs, fiche.ejs encaissements/quittances). Si on bascule
  // sur des scripts externes (cf IN-05), passer en mode nonce.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'",
    );
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'same-origin');
    return payload;
  });

  // Gestionnaire d'erreurs global — défense en profondeur (T-01-08-01).
  // Distingue HTML (Accept: text/html) de JSON pour les API.
  // Ne sérialise PAS err.stack côté client (mitigation T-01-08-01 information disclosure).
  app.setErrorHandler(async (err: Error & { statusCode?: number }, req, reply) => {
    req.log.error({ err, url: req.url, method: req.method }, 'erreur non interceptée');
    const acceptsHtml = req.headers['accept']?.includes('text/html') ?? false;
    const message = err.message || 'Erreur inattendue';
    const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;

    if (acceptsHtml) {
      return reply.code(statusCode).view('pages/erreur.ejs', { message, navActive: null });
    }
    return reply.code(statusCode).send({ error: message });
  });

  await app.register(racinePlugin, { db });
  await app.register(wizardPlugin, { db, bienRepo: repo, locataireRepo, bailRepo });
  await app.register(biensPlugin, { repo, justificatifRepo, ticketRepo });
  await app.register(diagnosticsPlugin, { bienRepo: repo });
  await app.register(locatairesPlugin, { repo: locataireRepo, bailRepo, justificatifRepo });
  await app.register(bauxPlugin, { bailRepo, bienRepo: repo, locataireRepo, activiteBailDetector, echeanceLoyerRepo, encaissementRepo, edlRepo, bailIndexationRepo, clock });
  await app.register(indexationsPlugin, {
    bailRepo,
    bienRepo: repo,
    locataireRepo,
    bailleurRepo,
    echeanceLoyerRepo,
    encaissementRepo,
    bailIndexationRepo,
    pdfRenderer,
    stockage,
    clock,
    db,
  });
  await app.register(etatsDesLieuxPlugin, { bailRepo, edlRepo });
  await app.register(bailleurPlugin, { bailleurRepo });
  await app.register(echeancesPlugin, {
    bailRepo,
    bienRepo: repo,
    locataireRepo,
    echeanceLoyerRepo,
    bailleurRepo,
    pdfRenderer,
    clock,
  });

  await app.register(encaissementsPlugin, {
    encaissementRepo,
    echeanceLoyerRepo,
    bailRepo,
    locataireRepo,
    bienRepo: repo,
    clock,
  });

  await app.register(quittancesPlugin, {
    quittanceRepo,
    echeanceLoyerRepo,
    encaissementRepo,
    bailleurRepo,
    locataireRepo,
    bienRepo: repo,
    bailRepo,
    pdfRenderer,
    stockage,
    clock,
    db,
  });

  await app.register(impayesPlugin, {
    echeanceLoyerRepo,
    encaissementRepo,
    bailRepo,
    locataireRepo,
    relanceRepo,
    clock,
  });

  await app.register(relancesPlugin, {
    relanceRepo,
    echeanceLoyerRepo,
    encaissementRepo,
    bailRepo,
    locataireRepo,
    bienRepo: repo,
    bailleurRepo,
    pdfRenderer,
    clock,
  });

  // Phase 4 — BC Documents (DOC-01, DOC-03)
  await app.register(coffrePlugin, {
    justificatifRepo,
    bienRepo: repo,
    locataireRepo,
    stockage: stockageJustificatifs,
    convertisseurImage,
    clock,
    db,
  });

  // Phase 4 — BC Travaux (INC-01)
  await app.register(travauxPlugin, {
    ticketRepo,
    bienRepo: repo,
    locataireRepo,
    justificatifRepo,
    stockage: stockageJustificatifs,
    convertisseurImage,
    clock,
    db,
  });

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
    const dossierMigrations = path.join(__dirname, '../migrations');
    await appliquerToutesMigrations(db, sqlite, dossierMigrations);
    await db.destroy();
    console.log(`Migrations appliquées : ${chemin}`);
    process.exit(0);
  }

  const cheminDb = cheminBaseParDefaut();
  const dossierDb = path.dirname(cheminDb);

  if (verifierDejaLance(dossierDb, PORT)) {
    process.exit(1);
  }

  const { db, sqlite } = ouvrirDb(cheminDb);
  const dossierMigrations = path.join(__dirname, '../migrations');
  await appliquerToutesMigrations(db, sqlite, dossierMigrations);

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
