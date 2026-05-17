/**
 * Routes EDL — LOC-03.
 * GET  /baux/:id/edl/entree/nouveau  — formulaire EDL entrée
 * POST /baux/:id/edl/entree          — enregistrer EDL entrée
 * GET  /baux/:id/edl/entree          — fiche EDL entrée actif
 * POST /baux/:id/edl/entree/:edlId/annuler — annuler EDL entrée
 * GET  /baux/:id/edl/sortie/nouveau  — formulaire EDL sortie
 * POST /baux/:id/edl/sortie          — enregistrer EDL sortie
 * GET  /baux/:id/edl/sortie          — fiche EDL sortie actif (+ delta warnings)
 * POST /baux/:id/edl/sortie/:edlId/annuler — annuler EDL sortie
 */
import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
import type { BailId, EtatDesLieuxId } from '../../domain/_shared/identifiants.js';
import { TYPES_ITEM_INVENTAIRE } from '../../domain/_shared/inventaire-item.js';
import { comparerInventaires } from '../../domain/locatif/comparer-inventaires.js';
import { enregistrerEDLEntree } from '../../application/locatif/enregistrer-edl-entree.js';
import { enregistrerEDLSortie } from '../../application/locatif/enregistrer-edl-sortie.js';
import { listerEDL } from '../../application/locatif/lister-edl.js';
import {
  BailIntrouvable,
  EDLEntreeExisteDeja,
  EDLSortieExisteDeja,
  EDLDejaAnnule,
  EtatDesLieuxIntrouvable,
} from '../../domain/locatif/erreurs.js';
import { edlFormSchema, normaliserInventaireFormBody } from '../schemas/edl-schemas.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    bailRepo: BailRepository;
    edlRepo: EtatDesLieuxRepository;
  },
): Promise<void> {
  // ─── GET /baux/:id/edl/entree/nouveau — formulaire EDL entrée ────────────────
  // IMPORTANT: déclaré avant GET /baux/:id/edl/entree pour éviter "nouveau" capturé comme id
  app.get('/baux/:id/edl/entree/nouveau', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send('Bail introuvable.');

    return reply.view('pages/baux/edl/formulaire.ejs', {
      bail,
      typeEdl: 'entree',
      typesItemInventaire: TYPES_ITEM_INVENTAIRE,
      formAction: `/baux/${id}/edl/entree`,
      valeurs: {},
      erreurs: {},
      navActive: 'baux',
    });
  });

  // ─── POST /baux/:id/edl/entree — enregistrer EDL entrée ──────────────────────
  app.post('/baux/:id/edl/entree', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const parsed = edlFormSchema.safeParse(body);
    const inventaire = normaliserInventaireFormBody(body);

    if (!parsed.success) {
      const erreurs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const cle = issue.path.join('.') || '_global';
        if (!erreurs[cle]) erreurs[cle] = issue.message;
      }
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      if (!bail) return reply.code(404).send('Bail introuvable.');
      return reply.view('pages/baux/edl/formulaire.ejs', {
        bail,
        typeEdl: 'entree',
        typesItemInventaire: TYPES_ITEM_INVENTAIRE,
        formAction: `/baux/${id}/edl/entree`,
        valeurs: body,
        erreurs,
        navActive: 'baux',
      });
    }

    const data = parsed.data;

    try {
      const { edlId, warnings } = await enregistrerEDLEntree(
        {
          bailId: id as BailId,
          dateEdl: Temporal.PlainDate.from(data.date_edl),
          contradictoire: data.contradictoire,
          dateSignature: data.date_signature ? Temporal.PlainDate.from(data.date_signature) : null,
          inventaire,
        },
        opts.bailRepo,
        opts.edlRepo,
      );

      if (warnings.length > 0) {
        req.session.banniereWarning = warnings.join(' | ');
      } else {
        req.session.banniereSuccess = "EDL d'entrée enregistré.";
      }

      return reply.redirect(`/baux/${id}/edl/entree`);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof EDLEntreeExisteDeja) {
        const bail = await opts.bailRepo.trouverParId(id as BailId);
        return reply.view('pages/baux/edl/formulaire.ejs', {
          bail,
          typeEdl: 'entree',
          typesItemInventaire: TYPES_ITEM_INVENTAIRE,
          formAction: `/baux/${id}/edl/entree`,
          valeurs: body,
          erreurs: { _global: "Un EDL d'entrée existe déjà pour ce bail." },
          navActive: 'baux',
        });
      }
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      return reply.view('pages/baux/edl/formulaire.ejs', {
        bail,
        typeEdl: 'entree',
        typesItemInventaire: TYPES_ITEM_INVENTAIRE,
        formAction: `/baux/${id}/edl/entree`,
        valeurs: body,
        erreurs: { _global: message },
        navActive: 'baux',
      });
    }
  });

  // ─── GET /baux/:id/edl/entree — fiche EDL entrée actif ───────────────────────
  app.get('/baux/:id/edl/entree', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send('Bail introuvable.');

    const edl = await opts.edlRepo.trouverActifParBailEtType(id as BailId, 'entree');
    const banniereWarning = req.session.banniereWarning ?? null;
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereWarning) req.session.banniereWarning = undefined;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    return reply.view('pages/baux/edl/entree.ejs', {
      bail,
      edl,
      banniereWarning,
      banniereSuccess,
      navActive: 'baux',
    });
  });

  // ─── POST /baux/:id/edl/entree/:edlId/annuler ────────────────────────────────
  app.post('/baux/:id/edl/entree/:edlId/annuler', async (req, reply) => {
    const { id, edlId } = req.params as { id: string; edlId: string };
    const body = req.body as Record<string, string>;
    const raison = (body['raison'] ?? '').trim();

    if (!raison) {
      req.session.banniereWarning = "La raison d'annulation est requise.";
      return reply.redirect(`/baux/${id}/edl/entree`);
    }

    try {
      const edl = await opts.edlRepo.trouverParId(edlId as EtatDesLieuxId);
      if (!edl) throw new EtatDesLieuxIntrouvable(edlId as EtatDesLieuxId);

      const annule = edl.annuler(raison, Temporal.Now.plainDateISO());
      await opts.edlRepo.enregistrer(annule);
      req.session.banniereSuccess = "EDL d'entrée annulé.";
      return reply.redirect(`/baux/${id}/edl/entree`);
    } catch (err) {
      if (err instanceof EDLDejaAnnule || err instanceof EtatDesLieuxIntrouvable) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/baux/${id}/edl/entree`);
      }
      throw err;
    }
  });

  // ─── GET /baux/:id/edl/sortie/nouveau — formulaire EDL sortie ────────────────
  app.get('/baux/:id/edl/sortie/nouveau', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send('Bail introuvable.');

    return reply.view('pages/baux/edl/formulaire.ejs', {
      bail,
      typeEdl: 'sortie',
      typesItemInventaire: TYPES_ITEM_INVENTAIRE,
      formAction: `/baux/${id}/edl/sortie`,
      valeurs: {},
      erreurs: {},
      navActive: 'baux',
    });
  });

  // ─── POST /baux/:id/edl/sortie — enregistrer EDL sortie ──────────────────────
  app.post('/baux/:id/edl/sortie', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const parsed = edlFormSchema.safeParse(body);
    const inventaire = normaliserInventaireFormBody(body);

    if (!parsed.success) {
      const erreurs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const cle = issue.path.join('.') || '_global';
        if (!erreurs[cle]) erreurs[cle] = issue.message;
      }
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      if (!bail) return reply.code(404).send('Bail introuvable.');
      return reply.view('pages/baux/edl/formulaire.ejs', {
        bail,
        typeEdl: 'sortie',
        typesItemInventaire: TYPES_ITEM_INVENTAIRE,
        formAction: `/baux/${id}/edl/sortie`,
        valeurs: body,
        erreurs,
        navActive: 'baux',
      });
    }

    const data = parsed.data;

    try {
      const { edlId, warnings, deltaWarnings } = await enregistrerEDLSortie(
        {
          bailId: id as BailId,
          dateEdl: Temporal.PlainDate.from(data.date_edl),
          contradictoire: data.contradictoire,
          dateSignature: data.date_signature ? Temporal.PlainDate.from(data.date_signature) : null,
          inventaire,
        },
        opts.bailRepo,
        opts.edlRepo,
      );

      const allWarnings = [...warnings, ...deltaWarnings.map((w) => w.message)];
      if (allWarnings.length > 0) {
        req.session.banniereWarning = allWarnings.join(' | ');
      } else {
        req.session.banniereSuccess = 'EDL de sortie enregistré.';
      }

      return reply.redirect(`/baux/${id}/edl/sortie`);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof EDLSortieExisteDeja) {
        const bail = await opts.bailRepo.trouverParId(id as BailId);
        return reply.view('pages/baux/edl/formulaire.ejs', {
          bail,
          typeEdl: 'sortie',
          typesItemInventaire: TYPES_ITEM_INVENTAIRE,
          formAction: `/baux/${id}/edl/sortie`,
          valeurs: body,
          erreurs: { _global: 'Un EDL de sortie existe déjà pour ce bail.' },
          navActive: 'baux',
        });
      }
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      return reply.view('pages/baux/edl/formulaire.ejs', {
        bail,
        typeEdl: 'sortie',
        typesItemInventaire: TYPES_ITEM_INVENTAIRE,
        formAction: `/baux/${id}/edl/sortie`,
        valeurs: body,
        erreurs: { _global: message },
        navActive: 'baux',
      });
    }
  });

  // ─── GET /baux/:id/edl/sortie — fiche EDL sortie + delta warnings ─────────────
  app.get('/baux/:id/edl/sortie', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send('Bail introuvable.');

    const { entree, sortie } = await listerEDL(id as BailId, opts.edlRepo);
    const banniereWarning = req.session.banniereWarning ?? null;
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereWarning) req.session.banniereWarning = undefined;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    // Calcul warnings contextuels
    const warningsTexte: string[] = [];
    let deltaWarnings: ReturnType<typeof comparerInventaires> = [];

    if (!entree) {
      warningsTexte.push("Aucun EDL d'entrée enregistré — la comparaison entrée/sortie n'est pas possible.");
    }

    if (sortie && entree) {
      deltaWarnings = comparerInventaires(entree, sortie);
    }

    return reply.view('pages/baux/edl/sortie.ejs', {
      bail,
      edl: sortie,
      warningsTexte,
      deltaWarnings,
      banniereWarning,
      banniereSuccess,
      navActive: 'baux',
    });
  });

  // ─── POST /baux/:id/edl/sortie/:edlId/annuler ────────────────────────────────
  app.post('/baux/:id/edl/sortie/:edlId/annuler', async (req, reply) => {
    const { id, edlId } = req.params as { id: string; edlId: string };
    const body = req.body as Record<string, string>;
    const raison = (body['raison'] ?? '').trim();

    if (!raison) {
      req.session.banniereWarning = "La raison d'annulation est requise.";
      return reply.redirect(`/baux/${id}/edl/sortie`);
    }

    try {
      const edl = await opts.edlRepo.trouverParId(edlId as EtatDesLieuxId);
      if (!edl) throw new EtatDesLieuxIntrouvable(edlId as EtatDesLieuxId);

      const annule = edl.annuler(raison, Temporal.Now.plainDateISO());
      await opts.edlRepo.enregistrer(annule);
      req.session.banniereSuccess = 'EDL de sortie annulé.';
      return reply.redirect(`/baux/${id}/edl/sortie`);
    } catch (err) {
      if (err instanceof EDLDejaAnnule || err instanceof EtatDesLieuxIntrouvable) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/baux/${id}/edl/sortie`);
      }
      throw err;
    }
  });
}
