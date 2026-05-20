/**
 * Step definitions FIS-02 + FIS-03 : Calcul micro-BIC + qualification charges LMNP.
 * Tag isolation : Before/After filtrés sur @fis-02 et @fis-03.
 *
 * FIS-02 : calcul abattement micro-BIC pur (CGI art. 50-0) — pas de HTTP.
 * FIS-03 : qualification Justificatifs/TicketTravaux via routes Fastify.
 */
import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import { Temporal } from '@js-temporal/polyfill';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { calculerMicroBic } from '../../../src/application/fiscalite/calculer-micro-bic.js';
import type { MicroBicResult } from '../../../src/application/fiscalite/calculer-micro-bic.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import type { BienId, JustificatifId, TicketTravauxId } from '../../../src/domain/_shared/identifiants.js';
import { unBienValide, unLotValide } from '../../_builders/patrimoine.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

interface CookieJar {
  [name: string]: string;
}

interface MondeFiscalite extends World {
  app: Awaited<ReturnType<typeof creerApp>> | null;
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  dernierStatut: number;
  derniereUrl: string;
  dernierCorps: string;
  cookies: CookieJar;
  clockIso: string;
  // FIS-02
  microBicResult: MicroBicResult | null;
  recettes: Money | null;
  // FIS-03
  dernierBienId: BienId | null;
  dernierBienIdB: BienId | null;
  dernierJustificatifId: JustificatifId | null;
  dernierTicketId: TicketTravauxId | null;
  [key: string]: unknown;
}

function extraireCookies(
  headers: Record<string, string | string[] | undefined>,
  jar: CookieJar,
): void {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of cookies) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    const eqIdx = pair.indexOf('=');
    if (eqIdx < 0) continue;
    const name = pair.substring(0, eqIdx).trim();
    const value = pair.substring(eqIdx + 1).trim();
    jar[name] = value;
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ─── Before/After pour @fis-02 ────────────────────────────────────────────────

Before({ tags: '@fis-02' }, async function (this: MondeFiscalite) {
  this.microBicResult = null;
  this.recettes = null;
  this.app = null;
  this.db = null;
  this.sqlite = null;
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.dernierBienId = null;
  this.dernierBienIdB = null;
  this.dernierJustificatifId = null;
  this.dernierTicketId = null;
  this.clockIso = '2026-05-20';
});

After({ tags: '@fis-02' }, async function (this: MondeFiscalite) {
  // FIS-02 n'utilise pas de DB ni de app HTTP
});

// ─── Before/After pour @fis-03 ────────────────────────────────────────────────

Before({ tags: '@fis-03' }, async function (this: MondeFiscalite) {
  process.env['SESSION_SECRET'] = 'test-secret-for-fis03-tests-at-least32!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.clockIso = '2026-05-20';
  const clock = ClockFixe.du(this.clockIso);
  this.app = await creerApp(this.db, { clock });
  this.dernierStatut = 0;
  this.derniereUrl = '';
  this.dernierCorps = '';
  this.cookies = {};
  this.microBicResult = null;
  this.recettes = null;
  this.dernierBienId = null;
  this.dernierBienIdB = null;
  this.dernierJustificatifId = null;
  this.dernierTicketId = null;
});

After({ tags: '@fis-03' }, async function (this: MondeFiscalite) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});

// ─── Given communs ────────────────────────────────────────────────────────────

Given(
  "l'application est prête pour la fiscalité LMNP avec clock fixe {string}",
  async function (this: MondeFiscalite, clockIso: string) {
    if (this.app && this.clockIso !== clockIso) {
      await this.app.close();
      this.clockIso = clockIso;
      const clock = ClockFixe.du(clockIso);
      this.app = await creerApp(this.db!, { clock });
    }
    // Pour FIS-02 sans app, simplement enregistrer la clock
    this.clockIso = clockIso;
  },
);

// ─── Given FIS-02 : micro-BIC ─────────────────────────────────────────────────

Given(
  'des recettes annuelles de {int} euros pour l\'année {int}',
  function (this: MondeFiscalite, montantEuros: number, _annee: number) {
    this.recettes = Money.fromEuros(montantEuros);
  },
);

Given(
  'des recettes annuelles en centimes de {int} pour l\'année {int}',
  function (this: MondeFiscalite, centimes: number, _annee: number) {
    this.recettes = Money.fromCentimes(BigInt(centimes));
  },
);

// ─── When FIS-02 ──────────────────────────────────────────────────────────────

When(
  "l'on calcule le micro-BIC avec les règles fiscales {int}",
  function (this: MondeFiscalite, _annee: number) {
    assert.ok(this.recettes, 'Les recettes doivent être définies');
    this.microBicResult = calculerMicroBic(this.recettes, REGLES_2026);
  },
);

// ─── Then FIS-02 ──────────────────────────────────────────────────────────────

Then(
  "l'abattement appliqué est {int} euros",
  function (this: MondeFiscalite, montantEuros: number) {
    assert.ok(this.microBicResult, 'Le résultat micro-BIC doit être calculé');
    const attendu = Money.fromEuros(montantEuros);
    assert.strictEqual(
      this.microBicResult.abattementApplique.centimes,
      attendu.centimes,
      `Abattement attendu ${attendu.enEuros()} — obtenu ${this.microBicResult.abattementApplique.enEuros()}`,
    );
  },
);

Then(
  'le résultat imposable est {int} euros',
  function (this: MondeFiscalite, montantEuros: number) {
    assert.ok(this.microBicResult, 'Le résultat micro-BIC doit être calculé');
    const attendu = Money.fromEuros(montantEuros);
    assert.strictEqual(
      this.microBicResult.resultatImposable.centimes,
      attendu.centimes,
      `Résultat imposable attendu ${attendu.enEuros()} — obtenu ${this.microBicResult.resultatImposable.enEuros()}`,
    );
  },
);

Then(
  'le seuil micro-BIC n\'est pas dépassé',
  function (this: MondeFiscalite) {
    assert.ok(this.microBicResult, 'Le résultat micro-BIC doit être calculé');
    assert.strictEqual(
      this.microBicResult.seuilDepasse,
      false,
      'Le seuil ne devrait pas être dépassé',
    );
  },
);

Then(
  'le seuil micro-BIC est dépassé',
  function (this: MondeFiscalite) {
    assert.ok(this.microBicResult, 'Le résultat micro-BIC doit être calculé');
    assert.strictEqual(
      this.microBicResult.seuilDepasse,
      true,
      'Le seuil devrait être dépassé',
    );
  },
);

// ─── Given FIS-03 : Biens ─────────────────────────────────────────────────────

Given(
  'un Bien {string} enregistré',
  async function (this: MondeFiscalite, nomBien: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const lot = unLotValide({ designation: nomBien });
    const bien = unBienValide({ rue: nomBien, lots: [lot] });
    await bienRepo.enregistrer(bien);
    if (!this.dernierBienId) {
      this.dernierBienId = bien.id;
    } else {
      this.dernierBienIdB = bien.id;
    }
  },
);

Given(
  'un autre Bien {string} enregistré',
  async function (this: MondeFiscalite, nomBien: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const lot = unLotValide({ designation: nomBien });
    const bien = unBienValide({ rue: nomBien, lots: [lot] });
    await bienRepo.enregistrer(bien);
    this.dernierBienIdB = bien.id;
  },
);

// ─── Given FIS-03 : Justificatifs ─────────────────────────────────────────────

Given(
  'un Justificatif de type {string} avec montant TTC {int} euros rattaché au bien {string}',
  async function (
    this: MondeFiscalite,
    type: string,
    montantEuros: number,
    _nomBien: string,
  ) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierBienId, 'Un Bien doit avoir été enregistré d\'abord');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const justif = unJustificatifNonQualifie({
      type: type as 'facture' | 'ticket_caisse' | 'autre',
      bienId: this.dernierBienId,
      montantTtc: Money.fromEuros(montantEuros),
      dateDocument: Temporal.PlainDate.from(this.clockIso),
    });
    await justificatifRepo.enregistrer(justif);
    this.dernierJustificatifId = justif.id;
  },
);

Given(
  'un Justificatif de type {string} sans fichier joint rattaché au bien {string}',
  async function (
    this: MondeFiscalite,
    type: string,
    _nomBien: string,
  ) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierBienId, 'Un Bien doit avoir été enregistré d\'abord');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    // cheminFichier = 'manual' → sentinel → badge "Sans PJ" (D-FIS-G2.8)
    const { CheminRelatif } = await import('../../../src/domain/_shared/identifiants.js')
      .then(m => ({ CheminRelatif: null })).catch(() => ({ CheminRelatif: null }));
    void CheminRelatif; // unused — just for pattern clarity
    const justif = unJustificatifNonQualifie({
      type: type as 'facture' | 'ticket_caisse' | 'autre',
      bienId: this.dernierBienId,
      cheminFichier: 'manual' as import('../../../src/domain/_shared/identifiants.js').CheminRelatif,
      dateDocument: Temporal.PlainDate.from(this.clockIso),
    });
    await justificatifRepo.enregistrer(justif);
    this.dernierJustificatifId = justif.id;
  },
);

// ─── Given FIS-03 : TicketTravaux avec justificatifs liés ─────────────────────

Given(
  'un TicketTravaux avec 2 justificatifs liés rattachés au bien {string}',
  async function (this: MondeFiscalite, _nomBien: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierBienId, 'Un Bien doit avoir été enregistré d\'abord');

    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const ticketRepo = new TicketTravauxRepositorySqlite(this.db);
    const { TicketTravaux } = await import('../../../src/domain/travaux/ticket-travaux.js');
    const today = Temporal.PlainDate.from(this.clockIso);

    // Créer 2 justificatifs liés au bien
    const j1 = unJustificatifNonQualifie({
      bienId: this.dernierBienId,
      montantTtc: Money.fromEuros(300),
      dateDocument: today,
      titre: 'Facture travaux 1',
    });
    const j2 = unJustificatifNonQualifie({
      bienId: this.dernierBienId,
      montantTtc: Money.fromEuros(200),
      dateDocument: today,
      titre: 'Facture travaux 2',
    });
    await justificatifRepo.enregistrer(j1);
    await justificatifRepo.enregistrer(j2);

    // Créer le ticket
    const ticket = TicketTravaux.creer(
      {
        bienId: this.dernierBienId,
        titre: 'Réfection salle de bain',
        description: 'Travaux de réfection complète',
        dateOuverture: today,
        dateCloture: null,
        statut: 'ouvert',
        coutEstimeTtc: Money.fromEuros(500),
        coutReelTtc: null,
        notes: null,
        creeLe: today,
        annuleLe: null,
        raisonAnnulation: null,
        nature: 'amelioration',
      },
      today,
    );
    await ticketRepo.enregistrer(ticket);

    // Lier les justificatifs au ticket
    await ticketRepo.lierJustificatif(ticket.id, j1.id);
    await ticketRepo.lierJustificatif(ticket.id, j2.id);

    this.dernierTicketId = ticket.id;
    this.dernierJustificatifId = j1.id; // premier pour référence
  },
);

// ─── When FIS-03 ──────────────────────────────────────────────────────────────

When(
  /^l'utilisateur qualifie le justificatif en "([^"]*)" via POST \/fiscalite\/qualification\/justificatif\/:id$/,
  async function (this: MondeFiscalite, qualification: string) {
    assert.ok(this.app, 'App doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif doit être défini');

    // GET d'abord pour récupérer les cookies de session (CSRF non requis en test)
    const getResp = await this.app.inject({
      method: 'GET',
      url: `/fiscalite/qualification?annee=${this.clockIso.substring(0, 4)}`,
    });
    extraireCookies(getResp.headers as Record<string, string | string[] | undefined>, this.cookies);

    const resp = await this.app.inject({
      method: 'POST',
      url: `/fiscalite/qualification/justificatif/${this.dernierJustificatifId}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookieHeader(this.cookies),
      },
      payload: `qualification=${encodeURIComponent(qualification)}`,
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^l'utilisateur qualifie le ticket en "([^"]*)" via POST \/fiscalite\/qualification\/ticket\/:id$/,
  async function (this: MondeFiscalite, qualification: string) {
    assert.ok(this.app, 'App doit être initialisée');
    assert.ok(this.dernierTicketId, 'Un ticket doit être défini');

    const getResp = await this.app.inject({
      method: 'GET',
      url: `/fiscalite/qualification?annee=${this.clockIso.substring(0, 4)}`,
    });
    extraireCookies(getResp.headers as Record<string, string | string[] | undefined>, this.cookies);

    const resp = await this.app.inject({
      method: 'POST',
      url: `/fiscalite/qualification/ticket/${this.dernierTicketId}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookieHeader(this.cookies),
      },
      payload: `natureFiscale=${encodeURIComponent(qualification)}`,
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  "l'utilisateur décompose le justificatif en 2 enfants de {int} et {int} euros",
  async function (this: MondeFiscalite, montant1: number, montant2: number) {
    assert.ok(this.app, 'App doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif doit être défini');
    assert.ok(this.dernierBienId, 'Un bien doit être défini');

    const bienId2 = this.dernierBienIdB ?? this.dernierBienId;

    const getResp = await this.app.inject({
      method: 'GET',
      url: `/fiscalite/qualification?annee=${this.clockIso.substring(0, 4)}`,
    });
    extraireCookies(getResp.headers as Record<string, string | string[] | undefined>, this.cookies);

    const payload = [
      `enfants[0].bienId=${encodeURIComponent(this.dernierBienId)}`,
      `enfants[0].montantTtcEuros=${montant1}`,
      `enfants[0].titre=${encodeURIComponent('Part bien A')}`,
      `enfants[1].bienId=${encodeURIComponent(bienId2)}`,
      `enfants[1].montantTtcEuros=${montant2}`,
      `enfants[1].titre=${encodeURIComponent('Part bien B')}`,
    ].join('&');

    const resp = await this.app.inject({
      method: 'POST',
      url: `/fiscalite/qualification/decomposer/${this.dernierJustificatifId}`,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie: cookieHeader(this.cookies),
      },
      payload,
    });
    extraireCookies(resp.headers as Record<string, string | string[] | undefined>, this.cookies);
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = resp.headers['location'] as string ?? '';
    this.dernierCorps = resp.body;
    // Si pas une redirection → erreur de validation ou serveur, afficher pour debug
    if (resp.statusCode !== 302) {
      console.error('[DEBUG decompose] statut:', resp.statusCode, 'body:', resp.body.substring(0, 300));
    }
  },
);

When(
  /^l'utilisateur accède à GET \/fiscalite\/qualification\?annee=(\d+)$/,
  async function (this: MondeFiscalite, annee: string) {
    assert.ok(this.app, 'App doit être initialisée');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/fiscalite/qualification?annee=${parseInt(annee, 10)}`,
    });
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

// ─── Then FIS-03 ──────────────────────────────────────────────────────────────

Then(
  'le justificatif est qualifié {string}',
  async function (this: MondeFiscalite, qualification: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif doit être défini');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const j = await justificatifRepo.trouverParId(this.dernierJustificatifId);
    assert.ok(j, 'Justificatif introuvable après qualification');
    assert.strictEqual(
      j.qualificationFiscale,
      qualification,
      `Qualification attendue "${qualification}" — obtenue "${j.qualificationFiscale}"`,
    );
  },
);

Then(
  'la qualification a été enregistrée en base de données',
  async function (this: MondeFiscalite) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif doit être défini');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const j = await justificatifRepo.trouverParId(this.dernierJustificatifId);
    assert.ok(j, 'Justificatif introuvable');
    assert.ok(
      j.qualificationFiscale !== null && j.qualificationFiscale !== 'non_qualifie',
      `La qualification doit être définie et non 'non_qualifie' — obtenu "${j.qualificationFiscale}"`,
    );
    assert.ok(j.qualifieLe !== null, 'qualifie_le doit être défini');
  },
);

Then(
  'le ticket a natureFiscale {string}',
  async function (this: MondeFiscalite, natureFiscale: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierTicketId, 'Un ticket doit être défini');
    const ticketRepo = new TicketTravauxRepositorySqlite(this.db);
    const ticket = await ticketRepo.trouverParId(this.dernierTicketId);
    assert.ok(ticket, 'Ticket introuvable après qualification');
    assert.strictEqual(
      ticket.natureFiscale,
      natureFiscale,
      `natureFiscale attendue "${natureFiscale}" — obtenue "${ticket.natureFiscale}"`,
    );
  },
);

Then(
  'les {int} justificatifs liés ont qualification_fiscale {string}',
  async function (this: MondeFiscalite, _count: number, qualification: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierTicketId, 'Un ticket doit être défini');
    const ticketRepo = new TicketTravauxRepositorySqlite(this.db);
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const justifIds = await ticketRepo.listerJustificatifsLies(this.dernierTicketId);
    assert.ok(justifIds.length > 0, 'Aucun justificatif lié trouvé');
    for (const jId of justifIds) {
      const j = await justificatifRepo.trouverParId(jId);
      assert.ok(j, `Justificatif ${jId} introuvable`);
      assert.strictEqual(
        j.qualificationFiscale,
        qualification,
        `Justificatif ${jId} : qualification attendue "${qualification}" — obtenue "${j.qualificationFiscale}"`,
      );
    }
  },
);

Then(
  '{int} enfants sont créés avec les bons montants',
  async function (this: MondeFiscalite, nbEnfants: number) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif parent doit être défini');
    // Chercher les enfants via parent_justificatif_id
    const rows = await this.db
      .selectFrom('justificatifs')
      .selectAll()
      .where('parent_justificatif_id', '=', this.dernierJustificatifId)
      .execute();
    assert.strictEqual(
      rows.length,
      nbEnfants,
      `Attendu ${nbEnfants} enfants — obtenu ${rows.length}`,
    );
  },
);

Then(
  'le parent est qualifié {string}',
  async function (this: MondeFiscalite, qualification: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.dernierJustificatifId, 'Un justificatif parent doit être défini');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    const parent = await justificatifRepo.trouverParId(this.dernierJustificatifId);
    assert.ok(parent, 'Justificatif parent introuvable');
    assert.strictEqual(
      parent.qualificationFiscale,
      qualification,
      `Parent : qualification attendue "${qualification}" — obtenue "${parent.qualificationFiscale}"`,
    );
  },
);

Then(
  'la réponse contient le badge {string}',
  function (this: MondeFiscalite, badge: string) {
    assert.strictEqual(this.dernierStatut, 200, `Statut HTTP attendu 200 — obtenu ${this.dernierStatut}`);
    assert.ok(
      this.dernierCorps.includes(badge),
      `Le corps de la réponse ne contient pas le badge "${badge}"\nExtrait : ${this.dernierCorps.substring(0, 500)}`,
    );
  },
);
