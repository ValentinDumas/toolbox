/**
 * Route racine fiscalité — GET /fiscalite.
 *
 * PLACEHOLDER MINIMAL Plan 06 :
 *   La vue index.ejs complète (bandeau verdict S7, compteur S2, CTA, liste déclarations, empty-state)
 *   est LOCKED dans Plan 08. Ce plan (06) rend un HTML inline sans EJS.
 *
 * Trace fiscalitePremierAcces si null → D-FIS-G5.4 (premier accès à la fiscalité).
 *
 * Sources :
 *   D-FIS-G5.4 — traçage premier accès fiscalité
 *   Plan 08 — index.ejs full UI finalisé
 */

import type { FastifyInstance } from 'fastify';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { DeclarationAnnuelleRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import { Temporal } from '@js-temporal/polyfill';

export interface RacineRouteDeps {
  bailleurRepo: BailleurRepository;
  declRepo: DeclarationAnnuelleRepository;
  clock: Clock;
}

export async function registerFiscaliteRacineRoute(
  app: FastifyInstance,
  deps: RacineRouteDeps,
): Promise<void> {
  const { bailleurRepo, declRepo, clock } = deps;

  app.get('/fiscalite', async (req, reply) => {
    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) {
      return reply.type('text/html').send(
        `<!doctype html><html lang=fr><head><meta charset=utf-8><title>Fiscalité LMNP</title></head>
         <body><h1>Fiscalité LMNP</h1><p>Bailleur non configuré.</p></body></html>`,
      );
    }

    // D-FIS-G5.4 : traçage premier accès fiscalité
    if (!bailleur.fiscalitePremierAcces) {
      const bailleurMaj = bailleur.modifier({
        fiscalitePremierAcces: Temporal.PlainDateTime.from(
          clock.aujourdhui().toString() + 'T00:00:00',
        ),
      });
      await bailleurRepo.enregistrer(bailleurMaj);
    }

    const anneeCourante = clock.aujourdhui().year;
    const declarations = await declRepo.listerParBailleur(bailleur.id);

    // PLACEHOLDER MINIMAL — vue index.ejs locked Plan 08
    const listeDeclarations = declarations
      .map(
        (d) =>
          `<li><a href="/fiscalite/declarations/${d.id}">Exercice ${d.exercice}</a></li>`,
      )
      .join('');

    return reply.type('text/html').send(
      `<!doctype html><html lang=fr><head><meta charset=utf-8><title>Fiscalité LMNP</title></head>
       <body>
         <h1>Fiscalité LMNP — Exercice ${anneeCourante}</h1>
         <p>Page d'accueil en cours de finalisation (Plan 08).</p>
         <ul>
           <li><a href="/fiscalite/cloturer/${anneeCourante}/etape/1">Clôturer l'exercice ${anneeCourante}</a></li>
           <li><a href="/fiscalite/revenus-foyer">Revenus du foyer</a></li>
           ${listeDeclarations}
         </ul>
       </body></html>`,
    );
  });
}
