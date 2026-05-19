/**
 * G-UX-02 — message d'erreur sous le champ fichier quand soumis vide ou avec fichier 0 octet.
 *
 * Route POST /coffre/upload :
 *  - Cas 1 : pas de field "fichier" dans le multipart → déjà géré par !data (HTTP 400)
 *  - Cas 2 : fichier présent mais 0 octet → détection par fichierBuffer.length === 0 (HTTP 400)
 *
 * Les deux cas doivent retourner HTTP 400 avec le message "Aucun fichier reçu."
 * visible sous l'input fichier (id="fichier-error", aria-invalid="true").
 */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { creerApp } from '../../../src/main.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

const CRLF = '\r\n';
const BOUNDARY = '---TestBoundary1234567890';

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

describe('G-UX-02 — message erreur fichier vide visible', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let tmpDir: string;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-coffre-upload-32chars!!';
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'glo-coffre-upload-'));
    process.env['GESTION_LOCATIVE_DATA_DIR'] = tmpDir;

    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    const clock = ClockFixe.du('2026-05-19');
    app = await creerApp(db, { clock });
  });

  afterEach(async () => {
    if (app) await app.close();
    if (db) await db.destroy();
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('POST /coffre/upload sans field fichier → 400 + message "Aucun fichier reçu"', async () => {
    // Pas de field "fichier" du tout dans le multipart
    const { body, contentType } = buildMultipartBody(
      'fichier',
      null, // pas de fichier
      null,
      null,
      {
        titre: 'Test sans fichier',
        type: 'facture',
        dateDocument: '2026-05-19',
        rattachement: 'bien',
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/coffre/upload',
      headers: { 'content-type': contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Aucun fichier reçu');
  });

  it('POST /coffre/upload avec fichier 0 octet → 400 + "Aucun fichier reçu" + id fichier-error', async () => {
    const { body, contentType } = buildMultipartBody(
      'fichier',
      'vide.pdf',
      'application/pdf',
      Buffer.from(''), // 0 octet
      {
        titre: 'Test fichier vide',
        type: 'facture',
        dateDocument: '2026-05-19',
        rattachement: 'bien',
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/coffre/upload',
      headers: { 'content-type': contentType },
      payload: body,
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('Aucun fichier reçu');
    expect(res.body).toContain('id="fichier-error"');
    expect(res.body).toMatch(/aria-invalid="true"/);
  });
});
