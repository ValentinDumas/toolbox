/**
 * Routes onboarding fiscalité — GET/POST /fiscalite/onboarding.
 *
 * D-FIS-G5.4 : traçage premier accès fiscalité + onboarding progressif (UI-SPEC §S1).
 *
 * Actions POST (T-05-07-07 : Zod enum strict) :
 *   - 'commencer' → trace fiscalitePremierAcces + redirect /fiscalite/revenus-foyer
 *   - 'plus_tard' → redirect /
 *   - 'ignorer' → redirect / + bannière info
 *
 * Sources :
 *   - D-FIS-G5.4 : traçage premier accès fiscalité
 *   - T-05-07-07 : action onboarding validée via Zod enum
 *   - Hick's Law : 3 choix maximum
 */

import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import { onboardingActionSchema } from '../../schemas/fiscalite-schemas.js';

export interface OnboardingRouteDeps {
  bailleurRepo: BailleurRepository;
  clock: Clock;
}

export async function registerFiscaliteOnboardingRoute(
  app: FastifyInstance,
  deps: OnboardingRouteDeps,
): Promise<void> {
  const { bailleurRepo, clock } = deps;

  /** GET /fiscalite/onboarding */
  app.get('/fiscalite/onboarding', async (_req, reply) => {
    return reply.view('pages/fiscalite/onboarding.ejs', {
      titre: 'Bienvenue dans Fiscalité LMNP',
      navActive: 'fiscalite',
    });
  });

  /** POST /fiscalite/onboarding */
  app.post('/fiscalite/onboarding', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const parsed = onboardingActionSchema.safeParse(body);

    if (!parsed.success) {
      // Valeur inconnue — redirect safe vers racine (T-05-07-07)
      return reply.redirect('/');
    }

    const { action } = parsed.data;

    // Tracer fiscalitePremierAcces si pas encore posé
    const bailleur = await bailleurRepo.trouver();
    if (bailleur && !bailleur.fiscalitePremierAcces) {
      const now = clock.aujourdhui().toPlainDateTime({ hour: 0, minute: 0, second: 0 });
      const bailleurMaj = bailleur.modifier({
        fiscalitePremierAcces: Temporal.PlainDateTime.from(now.toString()),
      });
      await bailleurRepo.enregistrer(bailleurMaj);
    }

    if (action === 'commencer') {
      return reply.redirect('/fiscalite/revenus-foyer');
    }

    if (action === 'ignorer') {
      req.session.banniereSuccess =
        "Onboarding ignoré. Vous pourrez réactiver la fiscalité depuis la page Fiscalité.";
    }

    return reply.redirect('/');
  });
}
