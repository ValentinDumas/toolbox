import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { ZodIssue } from 'zod';

import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BienId } from '../../domain/_shared/identifiants.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { ajouterDiagnostic } from '../../application/patrimoine/ajouter-diagnostic.js';
import { diagnosticCreationSchema } from '../schemas/diagnostic-schemas.js';

function extraireErreurs(issues: ZodIssue[]): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}

export async function plugin(
  app: FastifyInstance,
  opts: { bienRepo: BienRepository },
): Promise<void> {
  // GET /biens/:id/diagnostics/nouveau — formulaire d'ajout
  // IMPORTANT : Déclaré avant le POST pour éviter capture du segment "nouveau" comme id diagnostic futur.
  app.get('/biens/:id/diagnostics/nouveau', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bien = await opts.bienRepo.trouverParId(id as BienId);
    if (!bien) {
      return reply
        .code(404)
        .send("Ce bien n'existe pas ou a été supprimé.");
    }
    return reply.view('pages/biens/diagnostics/formulaire.ejs', {
      bien,
      valeurs: {},
      erreurs: {},
      navActive: 'biens',
      breadcrumbs: [
        { url: '/biens', label: 'Biens' },
        { url: '/biens/' + id, label: bien.adresse.enLigne() },
        { label: 'Ajouter un diagnostic' },
      ],
    });
  });

  // POST /biens/:id/diagnostics — créer un Diagnostic
  app.post('/biens/:id/diagnostics', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, string>;
    const parsed = diagnosticCreationSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bien = await opts.bienRepo.trouverParId(id as BienId);
      if (!bien) return reply.code(404).send("Ce bien n'existe pas ou a été supprimé.");
      return reply.view('pages/biens/diagnostics/formulaire.ejs', {
        bien,
        valeurs: body,
        erreurs,
        navActive: 'biens',
        breadcrumbs: [
          { url: '/biens', label: 'Biens' },
          { url: '/biens/' + id, label: bien.adresse.enLigne() },
          { label: 'Ajouter un diagnostic' },
        ],
      });
    }

    try {
      await ajouterDiagnostic(
        {
          bienId: id as BienId,
          type: parsed.data.type,
          dateEmission: Temporal.PlainDate.from(parsed.data.date_emission),
          classeDpe: parsed.data.classe_dpe ?? null,
        },
        opts.bienRepo,
      );
      req.session.banniereSuccess = 'Diagnostic enregistré.';
      return reply.redirect('/biens/' + id);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof InvariantViolated) {
        const bien = await opts.bienRepo.trouverParId(id as BienId);
        if (!bien) return reply.code(404).send("Ce bien n'existe pas ou a été supprimé.");
        return reply.view('pages/biens/diagnostics/formulaire.ejs', {
          bien,
          valeurs: body,
          erreurs: { _global: err.message },
          navActive: 'biens',
          breadcrumbs: [
            { url: '/biens', label: 'Biens' },
            { url: '/biens/' + id, label: bien.adresse.enLigne() },
            { label: 'Ajouter un diagnostic' },
          ],
        });
      }
      throw err;
    }
  });
}
