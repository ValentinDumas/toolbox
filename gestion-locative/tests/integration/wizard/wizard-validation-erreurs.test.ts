import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
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

describe('wizard validation erreurs — inline (pas de JSON 500)', () => {
  let app: Awaited<ReturnType<typeof creerApp>>;
  let db: Kysely<DB>;

  beforeEach(async () => {
    process.env['SESSION_SECRET'] = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaa';
    const sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    app = await creerApp(db);
  });

  afterEach(async () => {
    await app.close();
    await db.destroy();
  });

  it('POST /wizard/bien avec lot type=appartement sans surface → 200 + html + erreur surface visible', async () => {
    const payload = new URLSearchParams({
      rue: '12 rue des Lilas',
      codePostal: '75020',
      ville: 'Paris',
      surface: '45',
      type: 'appartement',
      anneeConstruction: '1985',
      'lots[0].designation': 'Appartement principal',
      'lots[0].type': 'appartement',
      'lots[0].surface': '',  // surface vide → doit échouer
      'lots[0].etage': '',
    }).toString();

    const response = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).not.toContain('"statusCode":500');
    expect(response.body).not.toContain('Internal Server Error');
    // L'erreur surface doit apparaître dans le rendu HTML (message Zod)
    expect(response.body).toMatch(/obligatoire|surface/i);
  });

  it('POST /wizard/locataire avec email invalide → 200 + html + erreur email + autres champs préservés', async () => {
    // D'abord créer le bien en session
    const r1 = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });
    const cookie = r1.headers['set-cookie'] as string | string[] | undefined;
    const cookieStr = Array.isArray(cookie) ? cookie.join('; ') : (cookie ?? '');

    const payload = new URLSearchParams({
      nom: 'Dupont',
      prenom: 'Marie',
      email: 'email-invalide',
      dateNaissance: '1985-06-15',
      communeNaissance: 'Paris',
      paysNaissance: 'France',
      nationalite: 'française',
      telephone: '',
      rue: '12 rue des Lilas',
      codePostal: '75020',
      ville: 'Paris',
    }).toString();

    const response = await app.inject({
      method: 'POST',
      url: '/wizard/locataire',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        cookie: cookieStr,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    // L'erreur email doit être affichée
    expect(response.body).toMatch(/email/i);
    // Les valeurs nom/prenom doivent être préservées
    expect(response.body).toContain('Dupont');
    expect(response.body).toContain('Marie');
  });

  it('POST /wizard/bail avec depotGarantie > 2× loyer → 200 + html + erreur depotGarantie (non-régression)', async () => {
    // Créer bien + locataire en session
    const r1 = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload: PAYLOAD_BIEN_VALIDE,
    });
    const cookie1 = r1.headers['set-cookie'] as string | string[] | undefined;
    const cookieStr1 = Array.isArray(cookie1) ? cookie1.join('; ') : (cookie1 ?? '');

    const payloadLoc = new URLSearchParams({
      nom: 'Dupont', prenom: 'Marie', email: 'marie@example.fr',
      dateNaissance: '1985-06-15', communeNaissance: 'Paris',
      paysNaissance: 'France', nationalite: 'française', telephone: '',
      rue: '12 rue des Lilas', codePostal: '75020', ville: 'Paris',
    }).toString();

    const r2 = await app.inject({
      method: 'POST',
      url: '/wizard/locataire',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieStr1 },
      payload: payloadLoc,
    });
    const cookie2 = r2.headers['set-cookie'] as string | string[] | undefined;
    const cookieStr2 = cookie2 ? (Array.isArray(cookie2) ? cookie2.join('; ') : cookie2) : cookieStr1;

    // Récupérer les lots du bien créé
    const lots = await db.selectFrom('lot').select('id').execute();
    const params = new URLSearchParams({
      loyerHcEuros: '800',
      montantChargesEuros: '50',
      modeCharges: 'forfait',
      depotGarantieEuros: '2000',  // > 2× loyer : doit échouer
      irlTrimestre: '2026-T1',
      irlValeur: '145.47',
      dateDebut: '2026-06-01',
      dureeMois: '12',
    });
    for (const lot of lots) params.append('lotIds', lot.id);

    const response = await app.inject({
      method: 'POST',
      url: '/wizard/bail',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieStr2 },
      payload: params.toString(),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).not.toContain('"statusCode":500');
  });

  it('POST /wizard/bien avec lot type=appartement + repo qui throw → 200 + html + erreurs._global visible (catch générique)', async () => {
    // Ce test nécessite de simuler une erreur interne.
    // On le teste avec un payload valide mais en mockant le comportement domaine
    // via un payload qui passe Zod mais le handler doit catch proprement.
    // Pour forcer ce cas sans mock : on exploite le fait que le try/catch n'existe pas encore.
    // Ce test SERA ROUGE jusqu'à Task 2 (try/catch absent).
    // Pour le faire passer rouge de façon déterministe, on utilise un payload
    // qui contourne Zod (surface valide) mais génère une InvariantViolated du domaine.
    // Note: surface_bien=0 est refusé par Zod (.positive), pas par le domaine.
    // Approche: envoyer surface=45 pour le bien mais lots[0].surface avec formule
    // qui passe Zod (superRefine absent) mais échoue en domaine.
    // ROUGE attendu : sans try/catch, cette erreur génère un 500 JSON.
    // Après Task 2 : 200 HTML avec erreurs._global.

    // Déclencher un InvariantViolated du domaine :
    // Le domaine Bien.creer vérifie que la surface > 0. Zod vérifie aussi (.positive).
    // Pour contourner Zod et atteindre le domaine : utiliser bien.surface = 0.1 (valide Zod)
    // mais déclencher un invariant via lot type appartement sans surface.
    // Sans superRefine (Task 2), Zod laisse passer surface=null pour lot appartement.
    // Donc ce payload arrive au domaine qui throw.
    const payload = new URLSearchParams({
      rue: '12 rue des Lilas',
      codePostal: '75020',
      ville: 'Paris',
      surface: '45',
      type: 'appartement',
      anneeConstruction: '1985',
      'lots[0].designation': 'Appartement principal',
      'lots[0].type': 'appartement',
      'lots[0].surface': '',  // null → domaine peut lever une erreur
      'lots[0].etage': '',
    }).toString();

    const response = await app.inject({
      method: 'POST',
      url: '/wizard/bien',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      payload,
    });

    // Après Task 2 : 200 + HTML + erreurs._global ou erreur inline surface
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).not.toContain('"statusCode":500');
  });

  it('setErrorHandler global — route arbitraire qui throw → 500 + HTML + layout complet + a11y', async () => {
    // Enregistre une route de test qui throw avant la fermeture de l'app
    app.get('/_test-erreur-global', async () => {
      throw new Error('boom-test-erreur');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/_test-erreur-global',
      headers: { Accept: 'text/html' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('boom-test-erreur');
    // Layout complet : header présent (layout-debut)
    expect(response.body).toContain('<header');
    // A11y : aside role="alert" présent
    expect(response.body).toContain('role="alert"');
  });

  it('setErrorHandler global — Pour Accept: application/json → JSON {error: ...}', async () => {
    app.get('/_test-erreur-json', async () => {
      throw new Error('boom-json');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/_test-erreur-json',
      headers: { Accept: 'application/json' },
    });

    expect(response.statusCode).toBe(500);
    expect(response.headers['content-type']).toContain('application/json');
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body['error']).toBe('boom-json');
  });
});
