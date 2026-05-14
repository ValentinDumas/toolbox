import type { FastifyInstance } from 'fastify';

import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import { creerOuMajBailleur } from '../../application/identite/creer-ou-maj-bailleur.js';
import { bailleurFormSchema } from '../schemas/bailleur-schemas.js';

/** Extrait les erreurs Zod en un dictionnaire chemin → premier message. */
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
  opts: { bailleurRepo: BailleurRepository },
): Promise<void> {

  // GET /bailleur — formulaire (vide ou pré-rempli)
  app.get('/bailleur', async (req, reply) => {
    const bailleur = await opts.bailleurRepo.trouver();

    // Lire et vider la bannière succès de la session (Phase 1 LEARNING — pas de preHandler)
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) {
      req.session.banniereSuccess = undefined;
    }

    return reply.view('pages/bailleur/profil.ejs', {
      bailleur,
      navActive: 'bailleur',
      erreurs: {},
      valeurs: {},
      banniereSuccess,
    });
  });

  // POST /bailleur — créer ou mettre à jour le profil
  app.post('/bailleur', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const parsed = bailleurFormSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bailleur = await opts.bailleurRepo.trouver();

      return reply.view('pages/bailleur/profil.ejs', {
        bailleur,
        navActive: 'bailleur',
        erreurs,
        valeurs: body,
        banniereSuccess: null,
      });
    }

    try {
      const data = parsed.data;
      await creerOuMajBailleur(
        {
          nomComplet: data.nomComplet,
          adresse: Adresse.creer({
            rue: data.rue,
            codePostal: data.codePostal,
            ville: data.ville,
          }),
        },
        opts.bailleurRepo,
      );

      // Bannière succès via session (lue et vidée dans GET /bailleur)
      req.session.banniereSuccess = 'Profil bailleur enregistré.';
      return reply.redirect('/bailleur');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const bailleur = await opts.bailleurRepo.trouver();

      return reply.view('pages/bailleur/profil.ejs', {
        bailleur,
        navActive: 'bailleur',
        erreurs: { _global: message },
        valeurs: body,
        banniereSuccess: null,
      });
    }
  });
}
