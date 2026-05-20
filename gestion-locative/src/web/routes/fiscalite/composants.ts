/**
 * Routes "Activer la fiscalité réelle" d'un Bien (D-FIS-G1.4).
 *
 * GET  /biens/:bienId/fiscalite/activer — formulaire S3 (ou redirect si VF déjà active)
 * POST /biens/:bienId/fiscalite/activer — activation use case + redirect /biens/:id/fiscalite
 *
 * Sécurité :
 *   T-05-03-01 : idempotence via lookup préalable + UNIQUE DB (double défense)
 *   T-05-03-02 : Σ validé côté serveur (ComposantsSommeIncoherente)
 *   T-05-03-03 : quotePartTerrainRatio [0,0.30] — Zod + domain invariant
 */
import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../../infrastructure/db/kysely-types.js';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type {
  ComposantRepository,
  ValorisationFiscaleRepository,
} from '../../../domain/fiscalite/composant-repository.js';
import type { BienId } from '../../../domain/_shared/identifiants.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { RegleFiscale2026 } from '../../../domain/fiscalite/regles/regles-2026.js';
import { Money } from '../../../domain/_shared/money.js';
import { activerFiscaliteBien, BienDejaActifFiscalement } from '../../../application/fiscalite/activer-fiscalite-bien.js';
import { ComposantsSommeIncoherente } from '../../../domain/fiscalite/erreurs.js';
import { activerFiscaliteSchema } from '../../schemas/fiscalite-schemas.js';
import { REGLES_2026 } from '../../../domain/fiscalite/regles/regles-2026.js';

interface ComposantsDeps {
  bienRepo: BienRepository;
  composantRepo: ComposantRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  clock: Clock;
  regleFiscale?: RegleFiscale2026;
  db: Kysely<DB>;
}

/** Labels français des types de composant BOFIP (UI S3) */
export const LABELS_COMPOSANT: Record<string, string> = {
  gros_oeuvre: 'Gros-oeuvre',
  toiture_facade: 'Toiture et façade',
  installations_techniques: 'Installations techniques',
  agencements_interieurs: 'Agencements intérieurs',
  mobilier: 'Mobilier',
};

/**
 * Plugin Fastify — routes activation fiscalité composants (Plan 03).
 */
export async function registerFiscaliteComposantsRoutes(
  app: FastifyInstance,
  deps: ComposantsDeps,
): Promise<void> {
  const { bienRepo, composantRepo, valorisationRepo, clock, db } = deps;
  const regleFiscale = deps.regleFiscale ?? REGLES_2026;

  /** GET /biens/:bienId/fiscalite/activer */
  app.get('/biens/:bienId/fiscalite/activer', async (req, reply) => {
    const { bienId } = req.params as { bienId: string };

    const bien = await bienRepo.trouverParId(bienId as BienId);
    if (!bien) {
      return reply.code(404).send("Ce bien n'existe pas ou a été supprimé.");
    }

    // Idempotence : si VF déjà active, redirect vers détail
    const vfExistante = await valorisationRepo.trouverParBien(bienId as BienId);
    if (vfExistante !== null) {
      return reply.redirect(`/biens/${bienId}/fiscalite`);
    }

    return reply.view('pages/fiscalite/activer-fiscalite.ejs', {
      bien,
      valeurs: {},
      erreurs: {},
      erreurSomme: null,
      regleFiscale,
      navActive: 'fiscalite',
      breadcrumbs: [
        { url: '/biens', label: 'Biens' },
        { url: '/biens/' + bienId, label: bien.adresse.enLigne() },
        { url: '/biens/' + bienId + '/fiscalite', label: 'Fiscalité' },
        { label: 'Activer la fiscalité réelle' },
      ],
    });
  });

  /** POST /biens/:bienId/fiscalite/activer */
  app.post('/biens/:bienId/fiscalite/activer', async (req, reply) => {
    const { bienId } = req.params as { bienId: string };

    const bien = await bienRepo.trouverParId(bienId as BienId);
    if (!bien) {
      return reply.code(404).send("Ce bien n'existe pas ou a été supprimé.");
    }

    const body = req.body as Record<string, unknown>;
    const parsed = activerFiscaliteSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const cle = issue.path.join('.') || '_global';
        if (!erreurs[cle]) erreurs[cle] = issue.message;
      }
      return reply.code(400).view('pages/fiscalite/activer-fiscalite.ejs', {
        bien,
        valeurs: body,
        erreurs,
        erreurSomme: null,
        regleFiscale,
        navActive: 'fiscalite',
        breadcrumbs: [
          { url: '/biens', label: 'Biens' },
          { url: '/biens/' + bienId, label: bien.adresse.enLigne() },
          { url: '/biens/' + bienId + '/fiscalite', label: 'Fiscalité' },
          { label: 'Activer la fiscalité réelle' },
        ],
      });
    }

    const data = parsed.data;
    const prixCentimes = BigInt(Math.round(data.prixAcquisitionEuros * 100));
    const notaireCentimes = BigInt(Math.round(data.fraisNotaireEuros * 100));
    const agenceCentimes = BigInt(Math.round(data.fraisAgenceEuros * 100));

    try {
      await activerFiscaliteBien(
        {
          bienId: bienId as BienId,
          prixAcquisition: Money.fromCentimes(prixCentimes),
          dateAcquisition: Temporal.PlainDate.from(data.dateAcquisition),
          fraisNotaire: Money.fromCentimes(notaireCentimes),
          fraisAgence: Money.fromCentimes(agenceCentimes),
          quotePartTerrainRatio: data.quotePartTerrainRatio,
          composantsAmortissables: [
            { type: 'gros_oeuvre', montantHt: Money.fromCentimes(BigInt(Math.round(data.gros_oeuvre * 100))) },
            { type: 'toiture_facade', montantHt: Money.fromCentimes(BigInt(Math.round(data.toiture_facade * 100))) },
            { type: 'installations_techniques', montantHt: Money.fromCentimes(BigInt(Math.round(data.installations_techniques * 100))) },
            { type: 'agencements_interieurs', montantHt: Money.fromCentimes(BigInt(Math.round(data.agencements_interieurs * 100))) },
            { type: 'mobilier', montantHt: Money.fromCentimes(BigInt(Math.round(data.mobilier * 100))) },
          ],
        },
        { bienRepo, valorisationRepo, composantRepo },
        clock,
        regleFiscale,
        db,
      );

      req.session.banniereSuccess = 'Fiscalité réelle activée avec succès. 6 composants créés.';
      return reply.redirect(`/biens/${bienId}/fiscalite`);
    } catch (err) {
      if (err instanceof BienDejaActifFiscalement) {
        req.session.banniereErreur = 'Ce bien a déjà une valorisation fiscale active.';
        return reply.redirect(`/biens/${bienId}/fiscalite`);
      }
      if (err instanceof ComposantsSommeIncoherente) {
        const attenduEuros = err.attendu.enEuros();
        const obtenuEuros = err.obtenu.enEuros();
        const erreurSomme = `Le total des composants (${obtenuEuros} €) ne correspond pas au prix d'acquisition (${attenduEuros} €). Ajustez les montants avant d'activer.`;
        return reply.code(400).view('pages/fiscalite/activer-fiscalite.ejs', {
          bien,
          valeurs: body,
          erreurs: {},
          erreurSomme,
          regleFiscale,
          navActive: 'fiscalite',
          breadcrumbs: [
            { url: '/biens', label: 'Biens' },
            { url: '/biens/' + bienId, label: bien.adresse.enLigne() },
            { url: '/biens/' + bienId + '/fiscalite', label: 'Fiscalité' },
            { label: 'Activer la fiscalité réelle' },
          ],
        });
      }
      throw err;
    }
  });
}
