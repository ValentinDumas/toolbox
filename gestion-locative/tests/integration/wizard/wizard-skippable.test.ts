import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { creerApp } from '../../../src/main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

const PAYLOAD_BIEN_VALIDE = new URLSearchParams({
  rue: '12 rue des Lilas',
  codePostal: '75020',
  ville: 'Paris',
  surface: '45',
  type: 'appartement',
  anneeConstruction: '1985',
  'lots[0].designation': 'Appartement principal',
  'lots[0].type': 'appartement',
  'lots[0].surface': '45',
  'lots[0].etage': '',
}).toString();

const PAYLOAD_LOCATAIRE_VALIDE = new URLSearchParams({
  nom: 'Dupont',
  prenom: 'Marie',
  email: 'marie@example.fr',
  dateNaissance: '1985-06-15',
  communeNaissance: 'Paris',
  paysNaissance: 'France',
  nationalite: 'française',
  telephone: '',
  rue: '12 rue des Lilas',
  codePostal: '75020',
  ville: 'Paris',
}).toString();

function extraireCookies(headers: Record<string, string | string[] | undefined>): string {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return '';
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  return cookies.map((c) => c.split(';')[0]).filter(Boolean).join('; ');
}

describe('wizard skippable — terminer après Bien ou Locataire', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaa';
    const sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    app = await creerApp(db);
  });

  afterEach(async () => {
    await app.close();
    await db.destroy();
  });

  it('POST /wizard/bien?terminer=1 → 302 /biens + Bien persisté + meta.wizard_complete posé + 0 locataire + 0 bail', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/wizard/bien?terminer=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe('/biens');

    // Bien créé
    const countBien = await db.selectFrom('bien').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countBien.count)).toBe(1);

    // Locataire absent
    const countLoc = await db.selectFrom('locataire').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countLoc.count)).toBe(0);

    // Bail absent
    const countBail = await db.selectFrom('bail').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countBail.count)).toBe(0);

    // meta.wizard_complete posé
    const meta = await db.selectFrom('meta').selectAll().where('cle', '=', 'wizard_complete').executeTakeFirst();
    expect(meta, 'meta.wizard_complete doit être posé').toBeTruthy();
    expect(meta?.valeur).toBe('1');
  });

  it('POST /wizard/locataire?terminer=1 → 302 /biens + 1 Bien + 1 Locataire + 0 Bail + meta.wizard_complete posé', async () => {
    // Étape 1 : créer le bien en session
    const r1 = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });
    const cookie = extraireCookies(r1.headers as Record<string, string | string[]>);
    expect(r1.statusCode).toBe(302);

    // Étape 2 : soumettre locataire avec ?terminer=1
    const response = await app.inject({
      method: 'POST',
      url: '/wizard/locataire?terminer=1',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        cookie,
      },
      payload: PAYLOAD_LOCATAIRE_VALIDE,
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers['location']).toBe('/biens');

    // 1 bien
    const countBien = await db.selectFrom('bien').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countBien.count)).toBe(1);

    // 1 locataire
    const countLoc = await db.selectFrom('locataire').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countLoc.count)).toBe(1);

    // 0 bail
    const countBail = await db.selectFrom('bail').select((eb) => eb.fn.countAll<number>().as('count')).executeTakeFirstOrThrow();
    expect(Number(countBail.count)).toBe(0);

    // meta.wizard_complete posé
    const meta = await db.selectFrom('meta').selectAll().where('cle', '=', 'wizard_complete').executeTakeFirst();
    expect(meta?.valeur).toBe('1');
  });

  it('Après skip wizard depuis étape Bien (1 Bien, 0 Locataire), GET /baux → empty state "Impossible de créer un bail" + CTA "Créer un locataire"', async () => {
    // Skip après étape Bien
    await app.inject({
      method: 'POST',
      url: '/wizard/bien?terminer=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });

    // Accéder à /baux
    const response = await app.inject({
      method: 'GET',
      url: '/baux',
      headers: {},
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('Impossible de créer un bail');
    expect(response.body).toContain('Créer un locataire');
  });

  it('Après skip wizard depuis étape Locataire (1 Bien, 1 Locataire, 0 Bail), GET /baux → empty state "Aucun bail pour l\'instant" + CTA "Créer un bail"', async () => {
    // Étape 1 : créer le bien
    const r1 = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });
    const cookie = extraireCookies(r1.headers as Record<string, string | string[]>);

    // Étape 2 : créer locataire + terminer
    await app.inject({
      method: 'POST',
      url: '/wizard/locataire?terminer=1',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie },
      payload: PAYLOAD_LOCATAIRE_VALIDE,
    });

    // Accéder à /baux
    const response = await app.inject({
      method: 'GET',
      url: '/baux',
      headers: {},
    });

    expect(response.statusCode).toBe(200);
    // EJS <%= %> encode l'apostrophe en &#39; — chercher la version encodée
    expect(response.body).toContain('Aucun bail pour l&#39;instant');
    expect(response.body).toContain('Créer un bail');
  });
});
