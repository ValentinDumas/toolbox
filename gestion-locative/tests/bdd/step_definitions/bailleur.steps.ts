import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import type { MondePhase2 } from '../../_world/monde-phase2.js';
import { extraireCookies, cookieHeader } from '../../_world/monde-phase2.js';

// ─── Given ────────────────────────────────────────────────────────────────────

Given("l'application est prête pour la phase 2", async function (this: MondePhase2) {
  // Initialisation faite dans le Before hook de monde-phase2.ts
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.app, 'App doit être initialisée');
});

Given(
  'un profil bailleur existe avec nomComplet {string}',
  async function (this: MondePhase2, nomComplet: string) {
    assert.ok(this.app, 'App doit être initialisée');
    const payload = new URLSearchParams({
      nomComplet,
      rue: '12 rue de la Paix',
      codePostal: '75002',
      ville: 'Paris',
    }).toString();

    const reponse = await this.app.inject({
      method: 'POST',
      url: '/bailleur',
      payload,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
      },
    });
    extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
    assert.equal(reponse.statusCode, 302, `POST /bailleur devrait retourner 302, reçu ${reponse.statusCode}`);
  },
);

// ─── When ─────────────────────────────────────────────────────────────────────

When(/^le bailleur visite GET \/bailleur$/, async function (this: MondePhase2) {
  assert.ok(this.app, 'App doit être initialisée');
  const headers: Record<string, string> = {};
  if (Object.keys(this.cookies).length > 0) {
    headers['cookie'] = cookieHeader(this.cookies);
  }
  const reponse = await this.app.inject({ method: 'GET', url: '/bailleur', headers });
  extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
  this.dernierStatut = reponse.statusCode;
  this.dernierCorps = reponse.body;
});

When(
  'le bailleur soumet le formulaire profil avec nomComplet {string}, rue {string}, codePostal {string}, ville {string}',
  async function (
    this: MondePhase2,
    nomComplet: string,
    rue: string,
    codePostal: string,
    ville: string,
  ) {
    assert.ok(this.app, 'App doit être initialisée');
    const payload = new URLSearchParams({ nomComplet, rue, codePostal, ville }).toString();

    const reponse = await this.app.inject({
      method: 'POST',
      url: '/bailleur',
      payload,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        ...(Object.keys(this.cookies).length > 0 ? { cookie: cookieHeader(this.cookies) } : {}),
      },
    });
    extraireCookies(reponse.headers as Record<string, string | string[]>, this.cookies);
    this.dernierStatut = reponse.statusCode;
    this.derniereUrl = (reponse.headers['location'] as string) || '';

    // Follow redirect if 302
    if (reponse.statusCode === 302 && this.derniereUrl) {
      const suivi = await this.app.inject({
        method: 'GET',
        url: this.derniereUrl,
        headers: { cookie: cookieHeader(this.cookies) },
      });
      extraireCookies(suivi.headers as Record<string, string | string[]>, this.cookies);
      this.dernierCorps = suivi.body;
    }
  },
);

When(
  "on tente d'insérer un 2e bailleur directement en base",
  async function (this: MondePhase2) {
    assert.ok(this.db, 'DB doit être initialisée');
    try {
      await this.db
        .insertInto('bailleur')
        .values({
          id: 'second-bailleur-id',
          singleton_marker: 'unique_bailleur',
          nom_complet: 'Second Bailleur',
          rue: '1 rue Test',
          code_postal: '75001',
          ville: 'Paris',
        })
        .execute();
      // Store that no error was thrown
      (this as unknown as Record<string, unknown>)['dernierErreurUnique'] = null;
    } catch (e) {
      (this as unknown as Record<string, unknown>)['dernierErreurUnique'] = e;
    }
  },
);

// ─── Then ─────────────────────────────────────────────────────────────────────

Then('le formulaire profil bailleur est vide', function (this: MondePhase2) {
  assert.equal(this.dernierStatut, 200, `GET /bailleur doit retourner 200, reçu ${this.dernierStatut}`);
  // Le formulaire doit exister mais les champs doivent être vides (pas de valeur pré-remplie)
  assert.ok(
    this.dernierCorps.includes('Profil bailleur'),
    'La page doit afficher "Profil bailleur"',
  );
});

Then('il est redirigé vers {string}', function (this: MondePhase2, urlAttendue: string) {
  assert.equal(
    this.derniereUrl,
    urlAttendue,
    `Attendu redirect vers "${urlAttendue}", obtenu "${this.derniereUrl}"`,
  );
});

Then('la page affiche {string}', function (this: MondePhase2, texte: string) {
  assert.ok(
    this.dernierCorps.includes(texte),
    `La page doit afficher "${texte}". Corps reçu (extrait) : ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('le formulaire est pré-rempli avec {string}', function (this: MondePhase2, nomComplet: string) {
  assert.ok(
    this.dernierCorps.includes(nomComplet),
    `Le formulaire doit contenir "${nomComplet}". Corps reçu (extrait) : ${this.dernierCorps.substring(0, 500)}`,
  );
});

Then('la table SQLite bailleur contient exactement 1 ligne', async function (this: MondePhase2) {
  assert.ok(this.db, 'DB doit être initialisée');
  const count = await this.db
    .selectFrom('bailleur')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  assert.equal(Number(count.count), 1, `Table bailleur doit contenir 1 ligne, contient ${count.count}`);
});

Then(
  "l'insertion est rejetée avec une erreur UNIQUE constraint",
  function (this: MondePhase2) {
    const erreur = (this as unknown as Record<string, unknown>)['dernierErreurUnique'] as Error | null;
    assert.ok(erreur !== null, "Une erreur UNIQUE constraint doit avoir été levée");
    assert.ok(
      erreur!.message.includes('UNIQUE constraint failed'),
      `L'erreur doit contenir 'UNIQUE constraint failed', reçu: ${erreur!.message}`,
    );
  },
);
