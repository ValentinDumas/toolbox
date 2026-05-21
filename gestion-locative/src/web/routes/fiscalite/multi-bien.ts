/**
 * Route vue consolidée multi-bien — GET /fiscalite/multi-bien.
 *
 * D-FIS-G5.1 : Vue consolidée avec ventilation RÉELLE par bien.
 * D-LOCK-2 : seuils LMP et micro-BIC appréciés sur le total consolidé.
 *
 * Sources :
 *   - D-FIS-G5.1 : vue consolidée multi-bien
 *   - D-LOCK-2 : seuils consolidés
 *   - CGI art. 50-0 : seuil micro-BIC
 *   - CGI art. 155 IV : bascule LMP
 */

import type { FastifyInstance } from 'fastify';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type { RecettesRepository } from '../../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../../domain/fiscalite/charges-repository.js';
import type {
  ComposantRepository,
  ValorisationFiscaleRepository,
} from '../../../domain/fiscalite/composant-repository.js';
import type { TableauAmortissementRepository } from '../../../domain/fiscalite/tableau-amortissement-repository.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { RegleFiscale2026 } from '../../../domain/fiscalite/regles/regles-2026.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { BailleurId } from '../../../domain/_shared/identifiants.js';
import { listerVueConsolidee } from '../../../application/fiscalite/lister-vue-consolidee.js';
import { REGLES_2026 } from '../../../domain/fiscalite/regles/regles-2026.js';

export interface MultiBienRouteDeps {
  bienRepo: BienRepository;
  recettesRepo: RecettesRepository;
  chargesRepo: ChargesRepository;
  composantRepo: ComposantRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  tableauAmortRepo: TableauAmortissementRepository;
  bailleurRepo: BailleurRepository;
  regleFiscale?: RegleFiscale2026;
  clock: Clock;
}

export async function registerFiscaliteMultiBienRoute(
  app: FastifyInstance,
  deps: MultiBienRouteDeps,
): Promise<void> {
  const {
    bienRepo, recettesRepo, chargesRepo, composantRepo,
    valorisationRepo, tableauAmortRepo, bailleurRepo, clock,
  } = deps;
  const regleFiscale = deps.regleFiscale ?? REGLES_2026;

  /** GET /fiscalite/multi-bien?annee={N} */
  app.get<{ Querystring: { annee?: string } }>(
    '/fiscalite/multi-bien',
    async (req, reply) => {
      const anneeCourante = req.query.annee
        ? parseInt(req.query.annee, 10)
        : clock.aujourdhui().year;

      const bailleur = await bailleurRepo.trouver();
      const bailleurId = bailleur?.id ?? ('' as BailleurId);

      const vue = await listerVueConsolidee(
        bailleurId,
        anneeCourante,
        {
          bienRepo,
          recettesRepo,
          chargesRepo,
          composantRepo,
          valorisationRepo,
          tableauAmortRepo,
          bailleurRepo,
          regleFiscale,
        },
        clock,
      );

      return reply.view('pages/fiscalite/vue-consolidee.ejs', {
        vue,
        anneeCourante,
        navActive: 'fiscalite',
        breadcrumbs: [
          { url: '/fiscalite', label: 'Fiscalité' },
          { label: `Vue consolidée ${anneeCourante}` },
        ],
      });
    },
  );
}
