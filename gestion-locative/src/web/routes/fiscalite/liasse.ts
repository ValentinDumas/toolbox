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
} from '../../../application/fiscalite/generer-brouillon-liasse.js';

export interface LiasseRouteDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  mappingProvider: MappingLiasseProvider;
  // Plan 06-03 — facultatifs : si fournis, activent la traçabilité + la réconciliation
  recettesRepo?: import('../../../domain/fiscalite/recettes-repository.js').RecettesRepository;
  chargesRepo?: import('../../../domain/fiscalite/charges-repository.js').ChargesRepository;
  tableauAmortRepo?: import('../../../domain/fiscalite/tableau-amortissement-repository.js').TableauAmortissementRepository;
  bienRepo?: import('../../../domain/patrimoine/bien-repository.js').BienRepository;
  // Plan 06-04 — facultatif (requis pour la route /declarations-corrigees/:id/liasse)
  declCorrigeeRepo?: import('../../../domain/fiscalite/declaration-annuelle-repository.js').DeclarationCorrigeeRepository;
  // Plan 06-05 — facultatifs (requis pour les routes .pdf et .csv)
  brouillonLiasseBuilder?: import('../../../domain/fiscalite/liasse/brouillon-liasse-builder.js').BrouillonLiasseBuilder;
  pdfRenderer?: import('../../../domain/encaissements/pdf-renderer.js').PdfRenderer;
}

export async function registerFiscaliteLiasseRoutes(
  app: FastifyInstance,
  deps: LiasseRouteDeps,
): Promise<void> {
  const { declRepo, bailleurRepo, mappingProvider, recettesRepo, chargesRepo, tableauAmortRepo, bienRepo } = deps;

  /**
   * GET /fiscalite/declarations/:id/liasse
   * Rend la vue HTML brouillon liasse (régime réel Wave 1).
   *
   * Codes de retour :
   *   - 200 : DTO résolu, vue rendue.
   *   - 404 : déclaration introuvable ou bailleur singleton non configuré.
   *           Message générique sans révéler `req.params.id` (T-06-LIASSE-W1-01).
   *   - 422 : mapping millésime non couvert (D-L6.3).
   *           Page d'erreur dédiée avec copywriting UI-SPEC.
   */
  const handleErreurs = (err: unknown, reply: import('fastify').FastifyReply) => {
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
  };

  // Helper : deps complets pour appeler les use cases.
  const useCaseDeps = {
    declRepo,
    bailleurRepo,
    mappingProvider,
    recettesRepo,
    chargesRepo,
    tableauAmortRepo,
    bienRepo,
    declCorrigeeRepo: deps.declCorrigeeRepo,
  };

  app.get<{ Params: { id: string } }>(
    '/fiscalite/declarations/:id/liasse',
    async (req, reply) => {
      const declarationId = req.params.id as DeclarationAnnuelleId;
      try {
        const dto = await genererBrouillonLiasse({ declarationId }, useCaseDeps);
        return reply.view('pages/fiscalite/brouillon-liasse.ejs', {
          dto,
          dtoId: declarationId,
          dtoIsRectificative: false,
          navActive: 'fiscalite',
        });
      } catch (err) {
        return handleErreurs(err, reply);
      }
    },
  );

  // Plan 06-04 — Route liasse rectificative depuis DeclarationCorrigee.
  app.get<{ Params: { id: string } }>(
    '/fiscalite/declarations-corrigees/:id/liasse',
    async (req, reply) => {
      const declarationCorrigeeId = req.params.id as import('../../../domain/_shared/identifiants.js').DeclarationCorrigeeId;
      try {
        const dto = await genererBrouillonLiasse({ declarationCorrigeeId }, useCaseDeps);
        return reply.view('pages/fiscalite/brouillon-liasse.ejs', {
          dto,
          dtoId: declarationCorrigeeId,
          dtoIsRectificative: true,
          navActive: 'fiscalite',
        });
      } catch (err) {
        return handleErreurs(err, reply);
      }
    },
  );

  // Plan 06-05 — Exports PDF + CSV (originale + rectificative) si deps PDF câblées.
  if (deps.brouillonLiasseBuilder && deps.pdfRenderer) {
    const { exporterPdfBrouillonLiasse } = await import(
      '../../../application/fiscalite/exporter-pdf-brouillon-liasse.js'
    );
    const { exporterCsvBrouillonLiasse } = await import(
      '../../../application/fiscalite/exporter-csv-brouillon-liasse.js'
    );
    const { encodeFilenameRFC6266 } = await import('../../helpers/content-disposition.js');

    const pdfDeps = {
      ...useCaseDeps,
      brouillonLiasseBuilder: deps.brouillonLiasseBuilder,
      pdfRenderer: deps.pdfRenderer,
    };

    app.get<{ Params: { id: string } }>(
      '/fiscalite/declarations/:id/liasse.pdf',
      async (req, reply) => {
        const declarationId = req.params.id as DeclarationAnnuelleId;
        try {
          const { buffer, nomFichier } = await exporterPdfBrouillonLiasse({ declarationId }, pdfDeps);
          return reply
            .type('application/pdf')
            .header('Content-Disposition', encodeFilenameRFC6266(nomFichier))
            .send(buffer);
        } catch (err) {
          return handleErreurs(err, reply);
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      '/fiscalite/declarations/:id/liasse.csv',
      async (req, reply) => {
        const declarationId = req.params.id as DeclarationAnnuelleId;
        try {
          const { contenu, nomFichier } = await exporterCsvBrouillonLiasse({ declarationId }, useCaseDeps);
          return reply
            .type('text/csv; charset=utf-8')
            .header('Content-Disposition', encodeFilenameRFC6266(nomFichier))
            .send(contenu);
        } catch (err) {
          return handleErreurs(err, reply);
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      '/fiscalite/declarations-corrigees/:id/liasse.pdf',
      async (req, reply) => {
        const declarationCorrigeeId = req.params.id as import('../../../domain/_shared/identifiants.js').DeclarationCorrigeeId;
        try {
          const { buffer, nomFichier } = await exporterPdfBrouillonLiasse({ declarationCorrigeeId }, pdfDeps);
          return reply
            .type('application/pdf')
            .header('Content-Disposition', encodeFilenameRFC6266(nomFichier))
            .send(buffer);
        } catch (err) {
          return handleErreurs(err, reply);
        }
      },
    );

    app.get<{ Params: { id: string } }>(
      '/fiscalite/declarations-corrigees/:id/liasse.csv',
      async (req, reply) => {
        const declarationCorrigeeId = req.params.id as import('../../../domain/_shared/identifiants.js').DeclarationCorrigeeId;
        try {
          const { contenu, nomFichier } = await exporterCsvBrouillonLiasse({ declarationCorrigeeId }, useCaseDeps);
          return reply
            .type('text/csv; charset=utf-8')
            .header('Content-Disposition', encodeFilenameRFC6266(nomFichier))
            .send(contenu);
        } catch (err) {
          return handleErreurs(err, reply);
        }
      },
    );
  }
}
