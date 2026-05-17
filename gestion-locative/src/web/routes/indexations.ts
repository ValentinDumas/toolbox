import type { FastifyInstance } from 'fastify';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';
import {
  BailIntrouvable,
  GelLoyerClimatActif,
} from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { simulerIndexationIRL } from '../../application/locatif/simuler-indexation-irl.js';
import { indexationSaisieSchema } from '../schemas/indexation-schemas.js';
import { formaterTrimestreIRL } from '../../helpers/format-trimestre-irl.js';

declare module 'fastify' {
  interface Session {
    indexationDraft?: { irlTrimestre: string; irlValeur: string };
  }
}

function extraireErreurs(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}

export async function plugin(
  app: FastifyInstance,
  opts: {
    bailRepo: BailRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
  },
): Promise<void> {
  // ── GET /baux/:id/indexer — étape 2 (saisie OU gel) ────────────────────────
  app.get('/baux/:id/indexer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) {
      return reply.code(404).send("Ce bail n'existe pas.");
    }
    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    if (!bien) {
      return reply.code(404).send('Bien associé introuvable.');
    }
    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);

    const breadcrumbs = [
      { url: '/baux', label: 'Baux' },
      { url: `/baux/${bail.id}`, label: 'Bail' },
      { label: 'Révision IRL' },
    ];

    if (bien.estGelLoyer()) {
      return reply.view('pages/baux/indexer/gel-loyer.ejs', {
        bail,
        bien,
        locataire,
        classeDpe: bien.classeDpe,
        currentStep: 2,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    }

    return reply.view('pages/baux/indexer/saisie.ejs', {
      bail,
      bien,
      locataire,
      valeurs: req.session.indexationDraft ?? {},
      erreurs: {},
      currentStep: 2,
      breadcrumbs,
      navActive: 'baux',
      formaterTrimestreIRL,
    });
  });

  // ── POST /baux/:id/indexer/simuler — étape 3 ────────────────────────────────
  app.post('/baux/:id/indexer/simuler', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");
    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    if (!bien) return reply.code(404).send('Bien associé introuvable.');
    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);

    const breadcrumbs = [
      { url: '/baux', label: 'Baux' },
      { url: `/baux/${bail.id}`, label: 'Bail' },
      { label: 'Révision IRL' },
    ];

    const body = req.body as Record<string, unknown>;
    const parsed = indexationSaisieSchema.safeParse(body);
    if (!parsed.success) {
      return reply.view('pages/baux/indexer/saisie.ejs', {
        bail,
        bien,
        locataire,
        valeurs: body,
        erreurs: extraireErreurs(parsed.error.issues),
        currentStep: 2,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    }

    try {
      const result = await simulerIndexationIRL(
        {
          bailId: bail.id,
          irlTrimestre: parsed.data.irl_trimestre,
          irlValeur: parsed.data.irl_valeur,
        },
        { bailRepo: opts.bailRepo, bienRepo: opts.bienRepo },
      );
      req.session.indexationDraft = {
        irlTrimestre: parsed.data.irl_trimestre,
        irlValeur: parsed.data.irl_valeur,
      };
      return reply.view('pages/baux/indexer/simulation.ejs', {
        bail,
        bien,
        locataire,
        result,
        currentStep: 3,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    } catch (err) {
      // Defense en profondeur — gel rejeté côté serveur.
      if (err instanceof GelLoyerClimatActif) {
        return reply.code(403).view('pages/baux/indexer/gel-loyer.ejs', {
          bail,
          bien,
          locataire,
          classeDpe: bien.classeDpe,
          currentStep: 2,
          breadcrumbs,
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      if (
        err instanceof InvariantViolated ||
        err instanceof BailIntrouvable ||
        err instanceof BienIntrouvable
      ) {
        return reply.view('pages/baux/indexer/saisie.ejs', {
          bail,
          bien,
          locataire,
          valeurs: body,
          erreurs: { _global: err.message },
          currentStep: 2,
          breadcrumbs,
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      throw err;
    }
  });

  // ── POST /baux/:id/indexer/confirmer — étape 4 (stub 03-03, livré 03-04) ────
  app.post('/baux/:id/indexer/confirmer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");

    if (!req.session.indexationDraft) {
      return reply.redirect(`/baux/${bail.id}/indexer`);
    }
    // Stub 03-03 : la route POST /baux/:id/indexer/appliquer est livrée en 03-04.
    // On affiche un message minimal.
    return reply
      .code(501)
      .send(
        "Application de l'indexation : à venir dans le plan 03-04. La simulation a été enregistrée en session.",
      );
  });
}
