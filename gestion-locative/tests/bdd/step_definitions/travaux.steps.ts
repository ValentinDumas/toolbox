import assert from 'node:assert/strict';

import { Given, Then, When } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';

import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import type {
  BienId,
  CheminRelatif,
  TicketTravauxId,
} from '../../../src/domain/_shared/identifiants.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import {
  cookieHeader,
  extraireCookies,
  type MondePhase4,
} from '../../_world/monde-phase4.js';

// Note : Before/After @phase4 hooks définis dans coffre.steps.ts — réutilisés ici.

interface MondePhase4Travaux extends MondePhase4 {
  ticketId?: TicketTravauxId | null;
  autreBienId?: BienId | null;
}

function buildMultipartBody(
  fileFieldName: string,
  fileName: string,
  fileMime: string,
  fileBytes: Buffer,
  textFields: Record<string, string>,
): { body: Buffer; contentType: string } {
  const boundary = `----glo-test-${Math.random().toString(36).slice(2)}`;
  const CRLF = '\r\n';
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(textFields)) {
    parts.push(
      Buffer.from(
        `--${boundary}${CRLF}` +
          `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
          `${value}${CRLF}`,
        'utf8',
      ),
    );
  }

  parts.push(
    Buffer.from(
      `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"${CRLF}` +
        `Content-Type: ${fileMime}${CRLF}${CRLF}`,
      'utf8',
    ),
  );
  parts.push(fileBytes);
  parts.push(Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8'));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ─── Given ───────────────────────────────────────────────────────────────────

Given(
  /^un ticket de travaux existe rattaché au Bien$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new TicketTravauxRepositorySqlite(this.db);
    const ticket = TicketTravaux.creer(
      {
        bienId: this.bienId,
        titre: 'Remplacement chauffe-eau',
        description: 'Fuite chauffe-eau salle de bain.',
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
        dateCloture: null,
        statut: 'ouvert',
        coutEstimeTtc: Money.fromEuros(1200),
        coutReelTtc: null,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-05-10'),
        annuleLe: null,
        raisonAnnulation: null,
      },
      Temporal.PlainDate.from('2026-05-18'),
    );
    await repo.enregistrer(ticket);
    this.ticketId = ticket.id;
  },
);

Given(
  /^un justificatif existe rattaché à un autre Bien$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const autreBien = unBienValide({ rue: '2 rue Ailleurs', codePostal: '75002' });
    await bienRepo.enregistrer(autreBien);
    this.autreBienId = autreBien.id;
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
      titre: 'Devis autre Bien',
      montantTtc: Money.fromEuros(500),
      cheminFichier: 'documents/justificatifs/2026/autre.pdf' as CheminRelatif,
      nomFichierOriginal: 'autre.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: autreBien.id,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-15'),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

Given(
  /^un justificatif existe rattaché au Bien et lié au ticket$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    assert.ok(this.ticketId, 'ticketId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
      titre: 'Devis lié',
      montantTtc: Money.fromEuros(500),
      cheminFichier: 'documents/justificatifs/2026/lie.pdf' as CheminRelatif,
      nomFichierOriginal: 'lie.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-15'),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
    const ticketRepo = new TicketTravauxRepositorySqlite(this.db);
    await ticketRepo.lierJustificatif(this.ticketId, j.id);
  },
);

Given(
  /^un ticket de travaux existe rattaché au Bien avec 2 pièces jointes$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const ticketRepo = new TicketTravauxRepositorySqlite(this.db);
    const justifRepo = new JustificatifRepositorySqlite(this.db);
    const ticket = TicketTravaux.creer(
      {
        bienId: this.bienId,
        titre: 'Ticket avec 2 PJ',
        description: 'Description.',
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
        dateCloture: null,
        statut: 'ouvert',
        coutEstimeTtc: null,
        coutReelTtc: null,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-05-10'),
        annuleLe: null,
        raisonAnnulation: null,
      },
      Temporal.PlainDate.from('2026-05-18'),
    );
    await ticketRepo.enregistrer(ticket);
    this.ticketId = ticket.id;
    for (let i = 0; i < 2; i += 1) {
      const j = Justificatif.creer({
        type: 'facture',
        dateDocument: Temporal.PlainDate.from('2026-05-15'),
        titre: `PJ ${i + 1}`,
        montantTtc: null,
        cheminFichier: `documents/justificatifs/2026/pj-${i + 1}.pdf` as CheminRelatif,
        nomFichierOriginal: `pj-${i + 1}.pdf`,
        mimeType: 'application/pdf',
        tailleOctets: 1024,
        bienId: this.bienId,
        locataireId: null,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-05-15'),
      });
      await justifRepo.enregistrer(j);
      await ticketRepo.lierJustificatif(this.ticketId, j.id);
    }
  },
);

Given(
  /^le Bien possède 1 ticket ouvert, 1 ticket en_cours et 1 ticket clos$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new TicketTravauxRepositorySqlite(this.db);
    const today = Temporal.PlainDate.from('2026-05-18');
    const tickets = [
      TicketTravaux.creer(
        {
          bienId: this.bienId,
          titre: 'Ouvert',
          description: 'Desc ouvert.',
          dateOuverture: Temporal.PlainDate.from('2026-05-10'),
          dateCloture: null,
          statut: 'ouvert',
          coutEstimeTtc: Money.fromEuros(500),
          coutReelTtc: null,
          notes: null,
          creeLe: Temporal.PlainDate.from('2026-05-10'),
          annuleLe: null,
          raisonAnnulation: null,
        },
        today,
      ),
      TicketTravaux.creer(
        {
          bienId: this.bienId,
          titre: 'En cours',
          description: 'Desc en cours.',
          dateOuverture: Temporal.PlainDate.from('2026-05-12'),
          dateCloture: null,
          statut: 'en_cours',
          coutEstimeTtc: Money.fromEuros(800),
          coutReelTtc: null,
          notes: null,
          creeLe: Temporal.PlainDate.from('2026-05-12'),
          annuleLe: null,
          raisonAnnulation: null,
        },
        today,
      ),
      TicketTravaux.creer(
        {
          bienId: this.bienId,
          titre: 'Clos',
          description: 'Desc clos.',
          dateOuverture: Temporal.PlainDate.from('2026-05-01'),
          dateCloture: Temporal.PlainDate.from('2026-05-15'),
          statut: 'clos',
          coutEstimeTtc: Money.fromEuros(1000),
          coutReelTtc: Money.fromEuros(950),
          notes: null,
          creeLe: Temporal.PlainDate.from('2026-05-01'),
          annuleLe: null,
          raisonAnnulation: null,
        },
        today,
      ),
    ];
    for (const t of tickets) {
      await repo.enregistrer(t);
    }
  },
);

// ─── When ────────────────────────────────────────────────────────────────────

When(
  /^le bailleur soumet POST \/biens\/:id\/travaux avec titre "([^"]*)" description "([^"]*)" dateOuverture "([^"]+)"(?: coutEstimeTtcEuros "([^"]+)")?$/,
  async function (
    this: MondePhase4Travaux,
    titre: string,
    description: string,
    dateOuverture: string,
    coutEstimeTtcEurosRaw?: string,
  ) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const params = new URLSearchParams({
      titre,
      description,
      dateOuverture,
    });
    if (
      coutEstimeTtcEurosRaw !== undefined &&
      coutEstimeTtcEurosRaw !== null &&
      coutEstimeTtcEurosRaw.length > 0
    ) {
      params.set('coutEstimeTtcEuros', coutEstimeTtcEurosRaw);
    }
    const resp = await this.app.inject({
      method: 'POST',
      url: `/biens/${this.bienId}/travaux`,
      payload: params.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/biens\/uuid-inconnu\/travaux avec titre "([^"]*)" description "([^"]*)" dateOuverture "([^"]+)"$/,
  async function (
    this: MondePhase4Travaux,
    titre: string,
    description: string,
    dateOuverture: string,
  ) {
    assert.ok(this.app, 'App non initialisée');
    const fakeUuid = '00000000-0000-4000-8000-000000000000';
    const params = new URLSearchParams({ titre, description, dateOuverture });
    const resp = await this.app.inject({
      method: 'POST',
      url: `/biens/${fakeUuid}/travaux`,
      payload: params.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/justificatifs avec multipart PDF "([^"]+)"$/,
  async function (this: MondePhase4Travaux, titre: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    const pdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
      Buffer.from('\n%test pdf payload\n'),
    ]);
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'devis.pdf',
      'application/pdf',
      pdfBytes,
      {
        titre,
        type: 'facture',
        dateDocument: '2026-05-15',
      },
    );
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/justificatifs`,
      payload: body,
      headers: {
        'content-type': contentType,
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/justificatifs avec query justificatifId$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/justificatifs?justificatifId=${this.justificatifId}`,
      payload: '',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    } as never);
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/justificatifs\/:jid\/delier$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/justificatifs/${this.justificatifId}/delier`,
      payload: '',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    } as never);
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/clore avec dateCloture "([^"]+)" coutReelTtcEuros "([^"]+)"$/,
  async function (
    this: MondePhase4Travaux,
    dateCloture: string,
    coutReelTtcEuros: string,
  ) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    const params = new URLSearchParams({ dateCloture, coutReelTtcEuros });
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/clore`,
      payload: params.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/clore avec dateCloture "([^"]+)" sans coutReel$/,
  async function (this: MondePhase4Travaux, dateCloture: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    const params = new URLSearchParams({ dateCloture });
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/clore`,
      payload: params.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

When(
  /^le bailleur soumet POST \/travaux\/:id\/annuler avec raison "([^"]+)"$/,
  async function (this: MondePhase4Travaux, raison: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    const params = new URLSearchParams({ raison });
    const resp = await this.app.inject({
      method: 'POST',
      url: `/travaux/${this.ticketId}/annuler`,
      payload: params.toString(),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader(this.cookies),
      },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.derniereUrl = (resp.headers['location'] as string) ?? '';
    this.dernierCorps = resp.body;
  },
);

When(
  /^on supprime directement le ticket en base via SQL$/,
  function (this: MondePhase4Travaux) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.ticketId, 'ticketId non défini');
    this.sqlite
      .prepare('DELETE FROM tickets_travaux WHERE id = ?')
      .run(this.ticketId as string);
  },
);

When(
  /^le bailleur navigue vers GET \/biens\/:bienId$/,
  async function (this: MondePhase4Travaux) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/biens/${this.bienId}`,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    this.dernierStatut = resp.statusCode;
    this.dernierCorps = resp.body;
  },
);

// ─── Then ────────────────────────────────────────────────────────────────────

Then(
  /^la redirection cible \/travaux\/:id$/,
  function (this: MondePhase4Travaux) {
    assert.ok(
      this.derniereUrl.startsWith('/travaux/'),
      `URL redirection attendue /travaux/:id, reçu: ${this.derniereUrl}`,
    );
    const id = this.derniereUrl.replace('/travaux/', '');
    this.ticketId = id as TicketTravauxId;
  },
);

Then(
  /^la table tickets_travaux contient (\d+) ligne(?:s)? avec statut "(.+)"$/,
  function (this: MondePhase4Travaux, nbStr: string, statutAttendu: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare('SELECT id, statut FROM tickets_travaux WHERE statut = ?')
      .all(statutAttendu) as Array<{ id: string; statut: string }>;
    assert.equal(
      rows.length,
      Number(nbStr),
      `Nombre de lignes statut=${statutAttendu} attendu ${nbStr}, reçu ${rows.length}`,
    );
  },
);

Then(
  /^la table tickets_travaux contient (\d+) ligne(?:s)? avec cout_estime_ttc_centimes (\d+)$/,
  function (this: MondePhase4Travaux, nbStr: string, centimesStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare(
        'SELECT id FROM tickets_travaux WHERE cout_estime_ttc_centimes = ?',
      )
      .all(Number(centimesStr)) as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);

Then(
  /^la table tickets_travaux contient (\d+) ligne(?:s)? avec cout_reel_ttc_centimes (\d+)$/,
  function (this: MondePhase4Travaux, nbStr: string, centimesStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare(
        'SELECT id FROM tickets_travaux WHERE cout_reel_ttc_centimes = ?',
      )
      .all(Number(centimesStr)) as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);

Then(
  /^la table tickets_travaux contient (\d+) ligne(?:s)? avec raison_annulation "(.+)"$/,
  function (this: MondePhase4Travaux, nbStr: string, raisonAttendue: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare(
        'SELECT id FROM tickets_travaux WHERE raison_annulation = ?',
      )
      .all(raisonAttendue) as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);

Then(
  /^la table tickets_travaux contient (\d+) ligne(?:s)?$/,
  function (this: MondePhase4Travaux, nbStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare('SELECT id FROM tickets_travaux')
      .all() as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);

Then(
  /^la table ticket_justificatifs contient (\d+) ligne(?:s)? pour le ticket$/,
  function (this: MondePhase4Travaux, nbStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const ticketId = this.ticketId as string | undefined;
    const rows = ticketId
      ? (this.sqlite
          .prepare(
            'SELECT ticket_id, justificatif_id FROM ticket_justificatifs WHERE ticket_id = ?',
          )
          .all(ticketId) as Array<{
          ticket_id: string;
          justificatif_id: string;
        }>)
      : ([] as Array<{ ticket_id: string; justificatif_id: string }>);
    assert.equal(
      rows.length,
      Number(nbStr),
      `Nombre de lignes pivot pour ticket=${ticketId} attendu ${nbStr}, reçu ${rows.length}`,
    );
  },
);

Then(
  /^la table justificatifs contient (\d+) ligne(?:s)? rattachée(?:s)? au Bien du ticket$/,
  function (this: MondePhase4Travaux, nbStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const rows = this.sqlite
      .prepare('SELECT id FROM justificatifs WHERE bien_id = ?')
      .all(this.bienId as string) as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);

// Note : "la table justificatifs contient N ligne(s)" est géré par
// coffre.steps.ts:443 — on n'expose pas de doublon ici.
// "la table justificatifs contient toujours N ligne[s]" (sans suffixe
// "corbeille_le non null") est nécessaire pour T9 — ajouté ici.
Then(
  /^la table justificatifs contient toujours (\d+) ligne(?:s)?$/,
  function (this: MondePhase4Travaux, nbStr: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare('SELECT id FROM justificatifs')
      .all() as Array<{ id: string }>;
    assert.equal(rows.length, Number(nbStr));
  },
);
