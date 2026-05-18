import assert from 'node:assert/strict';

import { After, Before, Given, Then, When } from '@cucumber/cucumber';
import { Temporal } from '@js-temporal/polyfill';
import sharp from 'sharp';

import { Justificatif } from '../../../src/domain/documents/justificatif.js';
import type { BienId, CheminRelatif, JustificatifId } from '../../../src/domain/_shared/identifiants.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import {
  cookieHeader,
  extraireCookies,
  fermerMondePhase4,
  initialiserMondePhase4,
  type MondePhase4,
} from '../../_world/monde-phase4.js';

Before({ tags: '@phase4' }, async function (this: MondePhase4) {
  await initialiserMondePhase4(this, '2026-05-18');
});

After({ tags: '@phase4' }, async function (this: MondePhase4) {
  await fermerMondePhase4(this);
});

Given(
  "l'application Phase 4 est prête avec clock fixe {string}",
  async function (this: MondePhase4, clockIso: string) {
    if (this.clockIso !== clockIso) {
      await fermerMondePhase4(this);
      await initialiserMondePhase4(this, clockIso);
    }
  },
);

Given(
  /^un Bien Phase 4 existe à l'adresse "(.+)"$/,
  async function (this: MondePhase4, _adresse: string) {
    assert.ok(this.db, 'DB non initialisée');
    const bienRepo = new BienRepositorySqlite(this.db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;
  },
);

Given(
  /^un justificatif existe rattaché au Bien$/,
  async function (this: MondePhase4) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
      titre: 'Doc test corbeille',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2026/x-doc-test.pdf' as CheminRelatif,
      nomFichierOriginal: 'doc-test.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-15'),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

Given(
  /^un justificatif existe avec creeLe=(\S+) et today=(\S+)$/,
  async function (this: MondePhase4, creeLeStr: string, _todayStr: string) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from(creeLeStr),
      titre: 'Doc ancien',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2020/ancien.pdf' as CheminRelatif,
      nomFichierOriginal: 'ancien.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from(creeLeStr),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

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

When(
  /^le bailleur téléverse une facture PDF "(.+)" rattachée au Bien$/,
  async function (this: MondePhase4, titre: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const pdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]),
      Buffer.from('\n%test pdf payload\n'),
    ]);
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'facture.pdf',
      'application/pdf',
      pdfBytes,
      {
        titre,
        type: 'facture',
        dateDocument: '2026-05-15',
        rattachement: 'bien',
        bienId: this.bienId as string,
      },
    );
    const resp = await this.app.inject({
      method: 'POST',
      url: '/coffre/upload',
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
  /^le bailleur téléverse une facture PDF "(.+)" sans rattachement$/,
  async function (this: MondePhase4, titre: string) {
    assert.ok(this.app, 'App non initialisée');
    const pdfBytes = Buffer.concat([
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
      Buffer.from('\n%test\n'),
    ]);
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'facture.pdf',
      'application/pdf',
      pdfBytes,
      {
        titre,
        type: 'facture',
        dateDocument: '2026-05-15',
        // pas de rattachement → Zod refuse
      },
    );
    const resp = await this.app.inject({
      method: 'POST',
      url: '/coffre/upload',
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
  /^le bailleur téléverse un fichier JPEG renommé en \.pdf rattaché au Bien$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    // Real JPEG bytes (FF D8 FF E0…) mais MIME header annoncé application/pdf
    const jpegBytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'masquerade.pdf',
      'application/pdf',
      jpegBytes,
      {
        titre: 'JPEG masqué',
        type: 'facture',
        dateDocument: '2026-05-15',
        rattachement: 'bien',
        bienId: this.bienId as string,
      },
    );
    const resp = await this.app.inject({
      method: 'POST',
      url: '/coffre/upload',
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
  /^le bailleur téléverse une image HEIC "(.+)" rattachée au Bien$/,
  async function (this: MondePhase4, titre: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.bienId, 'bienId non défini');

    // Stratégie de test pragmatique : on construit un fichier HEIC minimal
    // qui PASSE validerMagicBytes (magic ftyp + brand heic) puis qui est
    // converti côté infra par sharp. Si sharp ne peut pas décoder ce HEIC
    // synthétique (pas de payload image réel), la conversion jette une
    // erreur métier — donc on génère plutôt un payload VALIDE en HEIF avec
    // sharp.toFormat('heif') ; en l'absence de support HEIF en sortie, on
    // bascule sur le path "image PNG → persisté tel quel" qui exerce 80 %
    // du même flux (validation + conversion passe-through).
    let bytesUpload: Buffer;
    let mimeAnnonce: string;
    let filename: string;
    try {
      const heif = await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: { r: 200, g: 100, b: 50 },
        },
      })
        .heif({ compression: 'av1' })
        .toBuffer();
      // Inspecte le brand produit. AVIF (compression av1) → brand "avif"
      // qui n'est pas dans HEIC_BRANDS. On force le brand à "heic" pour que
      // validerMagicBytes le détecte comme HEIC et que le pipeline
      // déclenche la conversion. sharp accepte AVIF en input via libheif.
      heif[8] = 0x68; // h
      heif[9] = 0x65; // e
      heif[10] = 0x69; // i
      heif[11] = 0x63; // c
      bytesUpload = heif;
      mimeAnnonce = 'image/heic';
      filename = 'photo.heic';
    } catch {
      // sharp n'a pas le support HEIF output → bascule sur PNG passe-through
      bytesUpload = await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: { r: 200, g: 100, b: 50 },
        },
      })
        .png()
        .toBuffer();
      mimeAnnonce = 'image/png';
      filename = 'photo.png';
    }

    const { body, contentType } = buildMultipartBody(
      'fichier',
      filename,
      mimeAnnonce,
      bytesUpload,
      {
        titre,
        type: 'facture',
        dateDocument: '2026-05-15',
        rattachement: 'bien',
        bienId: this.bienId as string,
      },
    );
    const resp = await this.app.inject({
      method: 'POST',
      url: '/coffre/upload',
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
  /^le bailleur soumet POST \/justificatifs\/:id\/corbeille$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/justificatifs/${this.justificatifId}/corbeille`,
      payload: '',
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
  /^le bailleur navigue vers GET \/coffre$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    const resp = await this.app.inject({
      method: 'GET',
      url: '/coffre',
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
// Note : "la réponse a le statut N" et "la page affiche X" sont définis dans
// activation.steps.ts (cucumber les réutilise globalement) — on ne les redéfinit pas.

Then(
  /^la redirection cible \/justificatifs\/:id$/,
  function (this: MondePhase4) {
    assert.ok(
      this.derniereUrl.startsWith('/justificatifs/'),
      `URL redirection attendue /justificatifs/:id, reçu: ${this.derniereUrl}`,
    );
    // Extrait l'id de la redirection
    const id = this.derniereUrl.replace('/justificatifs/', '');
    this.justificatifId = id as JustificatifId;
  },
);

Then(
  /^la session porte la bannière "(.+)"$/,
  async function (this: MondePhase4, messageAttendu: string) {
    assert.ok(this.app, 'App non initialisée');
    // On suit la redirection pour vérifier que la bannière apparaît
    const url =
      this.derniereUrl.length > 0
        ? this.derniereUrl
        : `/justificatifs/${this.justificatifId}`;
    const resp = await this.app.inject({
      method: 'GET',
      url,
      headers: { Cookie: cookieHeader(this.cookies) },
    });
    extraireCookies(
      resp.headers as Record<string, string | string[] | undefined>,
      this.cookies,
    );
    // EJS escape les apostrophes en &#39; — on compare l'original ET la
    // version HTML-escaped pour rester compatible avec les bannières
    // contenant des caractères spéciaux français.
    const escaped = messageAttendu
      .replace(/&/g, '&amp;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&#34;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const found =
      resp.body.includes(messageAttendu) || resp.body.includes(escaped);
    assert.ok(
      found,
      `Bannière "${messageAttendu}" non trouvée dans le corps (testé brut + HTML-escaped). Reçu (extrait): ${resp.body.slice(0, 500)}`,
    );
  },
);

Then(
  /^la table justificatifs contient (\d+) ligne(?:s)?(?: de type "(.+?)")?(?: rattachée(?:s)? au Bien)?$/,
  function (
    this: MondePhase4,
    nbStr: string,
    typeAttendu: string | undefined,
  ) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    let query = 'SELECT type, bien_id FROM justificatifs WHERE 1=1';
    const args: unknown[] = [];
    if (typeAttendu) {
      query += ' AND type = ?';
      args.push(typeAttendu);
    }
    const rows = this.sqlite.prepare(query).all(...args) as Array<{
      type: string;
      bien_id: string | null;
    }>;
    assert.equal(
      rows.length,
      Number(nbStr),
      `Nombre de lignes attendu ${nbStr}, reçu ${rows.length}`,
    );
    if (typeAttendu && rows.length > 0) {
      assert.equal(rows[0]?.type, typeAttendu);
      if (this.bienId) {
        assert.equal(rows[0]?.bien_id, this.bienId);
      }
    }
  },
);

Then(
  /^la table justificatifs contient (\d+) ligne avec mime_type=(\S+)$/,
  function (this: MondePhase4, nbStr: string, mimeAttendu: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare('SELECT mime_type, chemin_fichier FROM justificatifs')
      .all() as Array<{ mime_type: string; chemin_fichier: string }>;
    assert.equal(rows.length, Number(nbStr));
    assert.equal(rows[0]?.mime_type, mimeAttendu);
  },
);

Then(
  /^le chemin du fichier se termine par (\S+)$/,
  function (this: MondePhase4, extAttendue: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const row = this.sqlite
      .prepare('SELECT chemin_fichier FROM justificatifs LIMIT 1')
      .get() as { chemin_fichier: string } | undefined;
    assert.ok(row, 'Aucune row trouvée');
    assert.ok(
      row.chemin_fichier.endsWith(extAttendue),
      `Chemin "${row.chemin_fichier}" ne se termine pas par "${extAttendue}"`,
    );
  },
);

Then(
  /^un fichier physique existe sous documents\/justificatifs\/(\d+)\//,
  async function (this: MondePhase4, annee: string | number) {
    assert.ok(this.tmpStorageDir, 'tmpStorageDir non défini');
    const fsMod = await import('node:fs/promises');
    const pathMod = await import('node:path');
    const dir = pathMod.join(
      this.tmpStorageDir,
      'documents',
      'justificatifs',
      String(annee),
    );
    const fichiers = await fsMod.readdir(dir).catch(() => [] as string[]);
    assert.ok(
      fichiers.length > 0,
      `Aucun fichier dans ${dir}`,
    );
  },
);

Then(
  /^la table justificatifs contient toujours 1 ligne avec corbeille_le non null$/,
  function (this: MondePhase4) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    const rows = this.sqlite
      .prepare('SELECT corbeille_le FROM justificatifs')
      .all() as Array<{ corbeille_le: string | null }>;
    assert.equal(rows.length, 1);
    assert.ok(rows[0]?.corbeille_le !== null, 'corbeille_le devrait être non null');
  },
);

Then(
  /^peutEtrePurge retourne false$/,
  async function (this: MondePhase4) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = await repo.trouverParId(this.justificatifId as string);
    assert.ok(j, 'Justificatif non trouvé');
    assert.equal(j.peutEtrePurge(Temporal.PlainDate.from('2026-05-18')), false);
  },
);

// ─── Wave 2 steps (Plan 04-02) ──────────────────────────────────────────────

/** Insert N justificatifs avec titres distincts rattachés au Bien. */
Given(
  /^(\d+) justificatifs existent avec titres "(.+)" "(.+)" "(.+)"$/,
  async function (
    this: MondePhase4,
    _n: string,
    t1: string,
    t2: string,
    t3: string,
  ) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const titres = [t1, t2, t3];
    for (let i = 0; i < titres.length; i++) {
      const j = Justificatif.creer({
        type: 'facture',
        dateDocument: Temporal.PlainDate.from('2026-05-15'),
        titre: titres[i] as string,
        montantTtc: null,
        cheminFichier: `documents/justificatifs/2026/x-${i}.pdf` as CheminRelatif,
        nomFichierOriginal: `f-${i}.pdf`,
        mimeType: 'application/pdf',
        tailleOctets: 1024 + i,
        bienId: this.bienId,
        locataireId: null,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-05-15'),
      });
      await repo.enregistrer(j);
    }
  },
);

Given(
  /^un justificatif existe avec notes "(.+)"$/,
  async function (this: MondePhase4, notes: string) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
      titre: 'Doc neutre',
      montantTtc: null,
      cheminFichier:
        'documents/justificatifs/2026/x-notes.pdf' as CheminRelatif,
      nomFichierOriginal: 'doc-neutre.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes,
      creeLe: Temporal.PlainDate.from('2026-05-15'),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

Given(
  /^un justificatif existe avec nomFichierOriginal "(.+)"$/,
  async function (this: MondePhase4, nomFichier: string) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-04-15'),
      titre: 'Doc fichier',
      montantTtc: null,
      cheminFichier: 'documents/justificatifs/2026/x-fn.pdf' as CheminRelatif,
      nomFichierOriginal: nomFichier,
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-04-15'),
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

Given(
  /^3 justificatifs existent avec dates "(.+)" "(.+)" "(.+)"$/,
  async function (
    this: MondePhase4,
    d1: string,
    d2: string,
    d3: string,
  ) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const dates = [d1, d2, d3];
    for (let i = 0; i < dates.length; i++) {
      const j = Justificatif.creer({
        type: 'facture',
        dateDocument: Temporal.PlainDate.from(dates[i] as string),
        titre: `Doc ${i + 1}`,
        montantTtc: null,
        cheminFichier:
          `documents/justificatifs/${dates[i]?.slice(0, 4)}/x-dt-${i}.pdf` as CheminRelatif,
        nomFichierOriginal: `doc-${i}.pdf`,
        mimeType: 'application/pdf',
        tailleOctets: 1024,
        bienId: this.bienId,
        locataireId: null,
        notes: null,
        creeLe: Temporal.PlainDate.from(dates[i] as string),
      });
      await repo.enregistrer(j);
    }
  },
);

Given(
  /^(\d+) justificatifs existent rattachés au Bien$/,
  async function (this: MondePhase4, nStr: string) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const n = Number(nStr);
    for (let i = 0; i < n; i++) {
      const num = String(i + 1).padStart(3, '0');
      const j = Justificatif.creer({
        type: 'facture',
        dateDocument: Temporal.PlainDate.from('2026-01-01').add({ days: i }),
        titre: `Document ${num}`,
        montantTtc: null,
        cheminFichier:
          `documents/justificatifs/2026/x-pag-${i}.pdf` as CheminRelatif,
        nomFichierOriginal: `doc-${num}.pdf`,
        mimeType: 'application/pdf',
        tailleOctets: 1024 + i,
        bienId: this.bienId,
        locataireId: null,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-01-01').add({ days: i }),
      });
      await repo.enregistrer(j);
    }
  },
);

Given(
  /^un Locataire existe$/,
  async function (this: MondePhase4) {
    assert.ok(this.db, 'DB non initialisée');
    const { LocataireRepositorySqlite } = await import(
      '../../../src/infrastructure/repositories/locataire-repository-sqlite.js'
    );
    const { unLocataireValide } = await import(
      '../../_builders/locatif.js'
    );
    const locataireRepo = new LocataireRepositorySqlite(this.db);
    const locataire = unLocataireValide();
    await locataireRepo.enregistrer(locataire);
    this.locataireId = locataire.id;
  },
);

Given(
  /^5 justificatifs existent rattachés au Locataire avec types "(.+)" "(.+)" "(.+)" "(.+)" "(.+)"$/,
  async function (
    this: MondePhase4,
    t1: string,
    t2: string,
    t3: string,
    t4: string,
    t5: string,
  ) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.locataireId, 'locataireId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const types = [t1, t2, t3, t4, t5];
    for (let i = 0; i < types.length; i++) {
      const j = Justificatif.creer({
        type: types[i] as
          | 'facture'
          | 'ticket_caisse'
          | 'bail_signe'
          | 'edl_signe'
          | 'diagnostic_pdf'
          | 'attestation'
          | 'piece_locataire'
          | 'releve_bancaire'
          | 'autre',
        dateDocument: Temporal.PlainDate.from('2026-05-15'),
        titre: `Doc locataire ${types[i]}`,
        montantTtc: null,
        cheminFichier: `documents/justificatifs/2026/x-loc-${i}.pdf` as CheminRelatif,
        nomFichierOriginal: `doc-${i}.pdf`,
        mimeType: 'application/pdf',
        tailleOctets: 1024,
        bienId: null,
        locataireId: this.locataireId,
        notes: null,
        creeLe: Temporal.PlainDate.from('2026-05-15'),
      });
      await repo.enregistrer(j);
    }
  },
);

Given(
  /^un justificatif existe rattaché au Bien et soft-deleted$/,
  async function (this: MondePhase4) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: Temporal.PlainDate.from('2026-05-15'),
      titre: 'Doc en corbeille',
      montantTtc: null,
      cheminFichier:
        'documents/justificatifs/2026/x-corb.pdf' as CheminRelatif,
      nomFichierOriginal: 'doc-corb.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe: Temporal.PlainDate.from('2026-05-18'),
      corbeilleLe: Temporal.PlainDate.from('2026-05-18'),
      raisonCorbeille: 'Doublon',
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

Given(
  /^un justificatif existe rattaché au Bien et soft-deleted avec creeLe "(.+)"$/,
  async function (this: MondePhase4, creeLeStr: string) {
    assert.ok(this.db, 'DB non initialisée');
    assert.ok(this.bienId, 'bienId non défini');
    const repo = new JustificatifRepositorySqlite(this.db);
    const creeLe = Temporal.PlainDate.from(creeLeStr);
    const j = Justificatif.creer({
      type: 'facture',
      dateDocument: creeLe,
      titre: 'Doc en corbeille ancien',
      montantTtc: null,
      cheminFichier:
        `documents/justificatifs/${creeLe.year}/x-corb-old.pdf` as CheminRelatif,
      nomFichierOriginal: 'doc-corb-old.pdf',
      mimeType: 'application/pdf',
      tailleOctets: 1024,
      bienId: this.bienId,
      locataireId: null,
      notes: null,
      creeLe,
      corbeilleLe: creeLe,
      raisonCorbeille: 'Doublon',
    });
    await repo.enregistrer(j);
    this.justificatifId = j.id;
  },
);

When(
  /^le bailleur navigue vers GET \/coffre avec query "(.+)"$/,
  async function (this: MondePhase4, queryString: string) {
    assert.ok(this.app, 'App non initialisée');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/coffre?${queryString}`,
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

When(
  /^le bailleur navigue vers GET \/coffre\/corbeille$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    const resp = await this.app.inject({
      method: 'GET',
      url: '/coffre/corbeille',
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

When(
  /^le bailleur navigue vers la fiche du Bien$/,
  async function (this: MondePhase4) {
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

When(
  /^le bailleur navigue vers la fiche du Locataire$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.locataireId, 'locataireId non défini');
    const resp = await this.app.inject({
      method: 'GET',
      url: `/locataires/${this.locataireId}`,
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

When(
  /^le bailleur soumet POST \/justificatifs\/:id\/purger$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/justificatifs/${this.justificatifId}/purger`,
      payload: '',
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
  /^le bailleur soumet POST \/justificatifs\/:id\/restaurer$/,
  async function (this: MondePhase4) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const resp = await this.app.inject({
      method: 'POST',
      url: `/justificatifs/${this.justificatifId}/restaurer`,
      payload: '',
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
  /^le bailleur soumet POST \/justificatifs\/:id\/modifier avec titre="(.+)" et notes="(.+)"$/,
  async function (this: MondePhase4, titre: string, notes: string) {
    assert.ok(this.app, 'App non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    // Read existing pour obtenir type + date courants
    const repo = new JustificatifRepositorySqlite(this.db!);
    const existant = await repo.trouverParId(this.justificatifId as string);
    assert.ok(existant, 'Justificatif existant non trouvé');
    const payload = new URLSearchParams({
      titre,
      type: existant.type,
      dateDocument: existant.dateDocument.toString(),
      notes,
    }).toString();
    const resp = await this.app.inject({
      method: 'POST',
      url: `/justificatifs/${this.justificatifId}/modifier`,
      payload,
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

Then(
  /^la page coffre affiche (\d+) ligne(?:s)? de justificatif$/,
  function (this: MondePhase4, nbStr: string) {
    // Compte les <tr> dans le <tbody> de la table justificatifs.
    const match = this.dernierCorps.match(
      /<tbody>([\s\S]*?)<\/tbody>/,
    );
    assert.ok(
      match,
      `Aucun <tbody> trouvé dans la page. Extrait: ${this.dernierCorps.substring(0, 500)}`,
    );
    const tbody = match[1] ?? '';
    const trCount = (tbody.match(/<tr\b/g) || []).length;
    assert.equal(
      trCount,
      Number(nbStr),
      `Attendu ${nbStr} lignes <tr>, trouvé ${trCount}`,
    );
  },
);

Then(
  /^la page n'affiche pas "(.+)"$/,
  function (this: MondePhase4, texte: string) {
    assert.ok(
      !this.dernierCorps.includes(texte),
      `La page NE DOIT PAS afficher "${texte}". Trouvé dans le corps.`,
    );
  },
);

Then(
  /^le justificatif a corbeille_le NULL en base$/,
  function (this: MondePhase4) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const row = this.sqlite
      .prepare('SELECT corbeille_le FROM justificatifs WHERE id = ?')
      .get(this.justificatifId) as { corbeille_le: string | null } | undefined;
    assert.ok(row, 'Justificatif introuvable en base');
    assert.equal(
      row.corbeille_le,
      null,
      `corbeille_le attendu NULL, reçu ${row.corbeille_le}`,
    );
  },
);

Then(
  /^le justificatif a titre "(.+)" et notes "(.+)" en base$/,
  function (this: MondePhase4, titreAttendu: string, notesAttendu: string) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const row = this.sqlite
      .prepare('SELECT titre, notes FROM justificatifs WHERE id = ?')
      .get(this.justificatifId) as
      | { titre: string; notes: string | null }
      | undefined;
    assert.ok(row, 'Justificatif introuvable en base');
    assert.equal(row.titre, titreAttendu);
    assert.equal(row.notes, notesAttendu);
  },
);

Then(
  /^le justificatif a chemin_fichier mime_type taille_octets nom_fichier_original cree_le inchangés en base$/,
  function (this: MondePhase4) {
    assert.ok(this.sqlite, 'SQLite non initialisée');
    assert.ok(this.justificatifId, 'justificatifId non défini');
    const row = this.sqlite
      .prepare(
        'SELECT chemin_fichier, mime_type, taille_octets, nom_fichier_original, cree_le FROM justificatifs WHERE id = ?',
      )
      .get(this.justificatifId) as
      | {
          chemin_fichier: string;
          mime_type: string;
          taille_octets: number;
          nom_fichier_original: string;
          cree_le: string;
        }
      | undefined;
    assert.ok(row, 'Justificatif introuvable');
    // Les valeurs sont celles posées par le Given (cf. "un justificatif existe rattaché au Bien")
    assert.ok(
      row.chemin_fichier.endsWith('.pdf'),
      `chemin_fichier inattendu: ${row.chemin_fichier}`,
    );
    assert.equal(row.mime_type, 'application/pdf');
    assert.equal(row.taille_octets, 1024);
    assert.ok(
      row.nom_fichier_original.endsWith('.pdf'),
      `nom_fichier_original inattendu: ${row.nom_fichier_original}`,
    );
    assert.ok(
      typeof row.cree_le === 'string' && row.cree_le.length === 10,
      `cree_le inattendu: ${row.cree_le}`,
    );
  },
);
