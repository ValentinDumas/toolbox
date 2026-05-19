/**
 * G-UX-02-bis — message d'erreur inline sous le champ fichier quand soumis vide
 * ou avec fichier 0 octet sur POST /travaux/:id/justificatifs (mode upload).
 *
 * Pattern identique à coffre-upload-erreurs.test.ts (G-UX-02).
 * Les deux cas doivent retourner HTTP 400 avec :
 *  - le message "Aucun fichier reçu." visible sous l'input fichier
 *  - id="fichier-error-ticket"
 *  - aria-invalid="true" sur l'input
 *  - valeurs des autres champs préservées
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import { Temporal } from '@js-temporal/polyfill';

import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { TicketTravaux } from '../../../src/domain/travaux/ticket-travaux.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unTicketTravauxValide } from '../../_builders/travaux.js';
import type { BienId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

const CRLF = '\r\n';
const BOUNDARY = '---TestBoundaryTicketPJ1234';

function buildMultipartBody(
  fileFieldName: string,
  fileName: string | null,
  mimeType: string | null,
  fileContent: Buffer | null,
  textFields: Record<string, string>,
): { body: Buffer; contentType: string } {
  const parts: Buffer[] = [];

  for (const [name, value] of Object.entries(textFields)) {
    parts.push(
      Buffer.from(
        `--${BOUNDARY}${CRLF}` +
        `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
        `${value}${CRLF}`,
        'utf-8',
      ),
    );
  }

  if (fileContent !== null && fileName !== null && mimeType !== null) {
    parts.push(
      Buffer.concat([
        Buffer.from(
          `--${BOUNDARY}${CRLF}` +
          `Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"${CRLF}` +
          `Content-Type: ${mimeType}${CRLF}${CRLF}`,
          'utf-8',
        ),
        fileContent,
        Buffer.from(CRLF, 'utf-8'),
      ]),
    );
  }

  parts.push(Buffer.from(`--${BOUNDARY}--${CRLF}`, 'utf-8'));
  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${BOUNDARY}`,
  };
}

describe('G-UX-02-bis — message erreur fichier vide visible (form upload PJ ticket)', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let tmpDir: string;
  let ticketId: string;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-ticket-pj-erreurs-32c!!';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-ticket-pj-'));
    process.env['GESTION_LOCATIVE_DATA_DIR'] = tmpDir;

    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    const clock = ClockFixe.du('2026-05-19');
    app = await creerApp(db, { clock });

    // Seed : Bien + Ticket ouvert
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);

    const ticketRepo = new TicketTravauxRepositorySqlite(db);
    const ticket = TicketTravaux.creer(
      unTicketTravauxValide({
        bienId: bien.id as BienId,
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
      }),
      Temporal.PlainDate.from('2026-05-19'),
    );
    await ticketRepo.enregistrer(ticket);
    ticketId = ticket.id;
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('POST /travaux/:id/justificatifs sans field fichier → 400 + "Aucun fichier reçu" + id fichier-error-ticket', async () => {
    const { body, contentType } = buildMultipartBody(
      'fichier',
      null, // pas de fichier
      null,
      null,
      {
        titre: 'Titre saisi par utilisateur',
        type: 'facture',
        dateDocument: '2026-05-19',
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: `/travaux/${ticketId}/justificatifs`,
      headers: { 'content-type': contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Aucun fichier reçu');
    expect(res.body).toContain('id="fichier-error-ticket"');
    expect(res.body).toMatch(/aria-invalid="true"/);
  });

  it('POST /travaux/:id/justificatifs avec fichier 0 octet → 400 + erreur visible + valeurs préservées', async () => {
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'vide.pdf',
      'application/pdf',
      Buffer.from(''), // 0 octet
      {
        titre: 'Titre saisi par utilisateur',
        type: 'facture',
        dateDocument: '2026-05-19',
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: `/travaux/${ticketId}/justificatifs`,
      headers: { 'content-type': contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Aucun fichier reçu');
    expect(res.body).toContain('id="fichier-error-ticket"');
    expect(res.body).toMatch(/aria-invalid="true"/);
    // Valeurs préservées
    expect(res.body).toContain('value="Titre saisi par utilisateur"');
  });
});
