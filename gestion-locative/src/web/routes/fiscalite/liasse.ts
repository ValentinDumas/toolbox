/**
 * Route HTML — GET /fiscalite/declarations/:id/liasse (Phase 6 / FIS-05 Wave 1).
 *
 * Rend la vue `pages/fiscalite/brouillon-liasse.ejs` pour une `DeclarationAnnuelle`
 * clôturée en régime réel (D-L6.1, D-L6.4 vue HTML primaire).
 *
 * Wave 1 ne câble que la vue HTML — exports PDF/CSV livrés Plan 05.
 *
 * Pattern miroir : `src/web/routes/fiscalite/exports.ts` (try/catch erreurs typées).
 *
 * Sources :
 *   - D-L6.4 : vue HTML = interface principale consultée *pendant* la saisie impots.gouv.fr.
 *   - UI-SPEC §S1/S2/S3 : bandeau brouillon + tableau case-par-case + bandeau postes manuels.
 *   - Threat T-06-LIASSE-W1-01 : message d'erreur 404 ne révèle pas `req.params.id`.
 */

import type { FastifyInstance } from 'fastify';

import type { DeclarationAnnuelleRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { MappingLiasseProvider } from '../../../domain/fiscalite/liasse/mapping-liasse-provider.js';
import type { DeclarationAnnuelleId } from '../../../domain/_shared/identifiants.js';
import { MappingLiasseAbsent } from '../../../domain/fiscalite/erreurs.js';
import {
  genererBrouillonLiasse,
  DeclarationIntrouvableLiasse,
  BailleurIntrouvableLiasse,
  RegimeMicroBicNonSupporteWave1,
} from '../../../application/fiscalite/generer-brouillon-liasse.js';

export interface LiasseRouteDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  mappingProvider: MappingLiasseProvider;
}

export async function registerFiscaliteLiasseRoutes(
  app: FastifyInstance,
  deps: LiasseRouteDeps,
): Promise<void> {
  const { declRepo, bailleurRepo, mappingProvider } = deps;

  /**
   * GET /fiscalite/declarations/:id/liasse
   * Rend la vue HTML brouillon liasse (régime réel Wave 1).
   *
   * Codes de retour :
   *   - 200 : DTO résolu, vue rendue.
   *   - 404 : déclaration introuvable ou bailleur singleton non configuré.
   *           Message générique sans révéler `req.params.id` (T-06-LIASSE-W1-01).
   *   - 422 : régime micro-BIC (Plan 02) ou mapping millésime non couvert (D-L6.3).
   *           Page d'erreur dédiée avec copywriting UI-SPEC.
   */
  app.get<{ Params: { id: string } }>(
    '/fiscalite/declarations/:id/liasse',
    async (req, reply) => {
      const declarationId = req.params.id as DeclarationAnnuelleId;

      try {
        const dto = await genererBrouillonLiasse(
          { declarationId },
          { declRepo, bailleurRepo, mappingProvider },
        );

        return reply.view('pages/fiscalite/brouillon-liasse.ejs', {
          dto,
          navActive: 'fiscalite',
        });
      } catch (err) {
        if (err instanceof DeclarationIntrouvableLiasse) {
          return reply.code(404).view('pages/erreur.ejs', {
            message: 'Déclaration introuvable.',
            navActive: 'fiscalite',
          });
        }
        if (err instanceof BailleurIntrouvableLiasse) {
          return reply.code(404).view('pages/erreur.ejs', {
            message: 'Bailleur non configuré — configurez votre profil avant de consulter une liasse.',
            navActive: 'fiscalite',
          });
        }
        if (err instanceof RegimeMicroBicNonSupporteWave1) {
          return reply.code(422).view('pages/erreur.ejs', {
            message:
              "Brouillon liasse micro-BIC : disponible avec le Plan 02 (FIS-05 micro). "
              + 'Pour l\'instant cette page ne supporte que les déclarations en régime réel.',
            navActive: 'fiscalite',
          });
        }
        if (err instanceof MappingLiasseAbsent) {
          return reply.code(422).view('pages/erreur.ejs', {
            message:
              `Mapping de la liasse non disponible pour l'année ${err.millesime}. `
              + "Mettez à jour l'application — le mapping est revu chaque janvier après "
              + 'publication des nouveautés fiscales (loi de finances).',
            navActive: 'fiscalite',
          });
        }
        throw err;
      }
    },
  );
}
