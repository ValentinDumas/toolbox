import type { FastifyInstance } from 'fastify';

import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BienId, LotId } from '../../domain/_shared/identifiants.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import { creerBien } from '../../application/patrimoine/creer-bien.js';
import { modifierBien } from '../../application/patrimoine/modifier-bien.js';
import { supprimerBien } from '../../application/patrimoine/supprimer-bien.js';
import { listerBiens } from '../../application/patrimoine/lister-biens.js';
import { ajouterLot } from '../../application/patrimoine/ajouter-lot.js';
import { supprimerLot } from '../../application/patrimoine/supprimer-lot.js';
import { listerJustificatifsParBien } from '../../application/documents/lister-justificatifs-par-bien.js';
import { listerTicketsParBien } from '../../application/travaux/lister-tickets-par-bien.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import {
  bienCreationSchema,
  bienModificationSchema,
  lotCreationSchema,
  normaliserLotsFormBody,
} from '../schemas/bien-schemas.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    repo: BienRepository;
    justificatifRepo?: JustificatifRepository;
    ticketRepo?: TicketTravauxRepository;
  },
): Promise<void> {

  // GET /biens — liste tabulée
  app.get('/biens', async (req, reply) => {
    const biens = await listerBiens(opts.repo);
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    return reply.view('pages/biens/liste.ejs', { biens, banniereSuccess, navActive: 'biens' });
  });

  // GET /biens/nouveau — formulaire création
  // Doit être déclaré AVANT /biens/:id pour éviter que "nouveau" soit capturé comme id
  app.get('/biens/nouveau', async (_req, reply) => {
    return reply.view('pages/biens/formulaire.ejs', {
      mode: 'creation',
      bien: null,
      lots: [{ designation: '', type: 'appartement', surface: '', etage: '' }],
      valeurs: {},
      erreurs: {},
    });
  });

  // POST /biens — créer un Bien avec N lots
  app.post('/biens', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const lotsRaw = normaliserLotsFormBody(body);
    const parsed = bienCreationSchema.safeParse({ ...body, lots: lotsRaw });

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const lots = lotsRaw.length > 0
        ? lotsRaw
        : [{ designation: '', type: 'appartement', surface: '', etage: '' }];
      return reply.view('pages/biens/formulaire.ejs', {
        mode: 'creation',
        bien: null,
        lots,
        valeurs: body,
        erreurs,
      });
    }

    try {
      const { rue, codePostal, ville, surface, type, anneeConstruction, lots } = parsed.data;
      const bienId = await creerBien(
        { adresse: { rue, codePostal, ville }, surface, type, anneeConstruction, lots },
        opts.repo,
      );
      return reply.redirect('/biens/' + bienId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      return reply.view('pages/biens/formulaire.ejs', {
        mode: 'creation',
        bien: null,
        lots: lotsRaw,
        valeurs: body,
        erreurs: { _global: message },
      });
    }
  });

  // GET /biens/:id — détail (+ section Documents UI-5.4 si justificatifRepo dispo)
  app.get('/biens/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bien = await opts.repo.trouverParId(id as BienId);
    if (!bien) {
      return reply.code(404).send(
        'Ce bien n\'existe pas ou a été supprimé. Retournez à la liste des biens.',
      );
    }
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    // Phase 4 — UI-5.4 : section "Documents" sur la fiche Bien
    const documentsBien = opts.justificatifRepo
      ? await listerJustificatifsParBien(
          { bienId: bien.id, pageSize: 5 },
          { justificatifRepo: opts.justificatifRepo },
        )
      : { items: [], total: 0 };

    // Phase 4 — UI-5.4 : section "Travaux" sur la fiche Bien
    let ticketsBien: { items: unknown[]; total: number } = {
      items: [],
      total: 0,
    };
    if (opts.ticketRepo) {
      const ouverts = await listerTicketsParBien(
        { bienId: bien.id, statuts: ['ouvert', 'en_cours'] },
        { ticketRepo: opts.ticketRepo },
      );
      const tous = await listerTicketsParBien(
        { bienId: bien.id, inclureAnnules: true },
        { ticketRepo: opts.ticketRepo },
      );
      ticketsBien = { items: ouverts, total: tous.length };
    }

    return reply.view('pages/biens/detail.ejs', {
      bien,
      banniereSuccess,
      documentsBien,
      ticketsBien,
    });
  });

  // GET /biens/:id/modifier — formulaire édition
  app.get('/biens/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bien = await opts.repo.trouverParId(id as BienId);
    if (!bien) {
      return reply.code(404).send('Ce bien n\'existe pas ou a été supprimé.');
    }
    return reply.view('pages/biens/formulaire.ejs', {
      mode: 'edition',
      bien,
      lots: bien.lots.map((l) => ({
        id: l.id,
        designation: l.designation,
        type: l.type,
        surface: l.surface ?? '',
        etage: l.etage ?? '',
      })),
      valeurs: {
        rue: bien.adresse.rue,
        codePostal: bien.adresse.codePostal,
        ville: bien.adresse.ville,
        surface: bien.surface,
        type: bien.type,
        anneeConstruction: bien.anneeConstruction,
      },
      erreurs: {},
    });
  });

  // POST /biens/:id/modifier — persister modifications
  app.post('/biens/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, string>;
    const parsed = bienModificationSchema.safeParse(body);

    if (!parsed.success) {
      const bien = await opts.repo.trouverParId(id as BienId);
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/biens/formulaire.ejs', {
        mode: 'edition',
        bien,
        lots: bien ? bien.lots.map((l) => ({
          id: l.id,
          designation: l.designation,
          type: l.type,
          surface: l.surface ?? '',
          etage: l.etage ?? '',
        })) : [],
        valeurs: body,
        erreurs,
      });
    }

    try {
      await modifierBien(
        {
          id: id as BienId,
          adresse: {
            rue: parsed.data.rue,
            codePostal: parsed.data.codePostal,
            ville: parsed.data.ville,
          },
          surface: parsed.data.surface,
          type: parsed.data.type,
          anneeConstruction: parsed.data.anneeConstruction,
        },
        opts.repo,
      );
      return reply.redirect('/biens/' + id);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // POST /biens/:id/supprimer — soft-delete
  app.post('/biens/:id/supprimer', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await supprimerBien(id as BienId, opts.repo);
      return reply.redirect('/biens');
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // POST /biens/:id/lots — ajouter un lot
  app.post('/biens/:id/lots', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, string>;
    const parsed = lotCreationSchema.safeParse(body);

    if (!parsed.success) {
      const bien = await opts.repo.trouverParId(id as BienId);
      if (!bien) return reply.code(404).send('Bien introuvable');
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/biens/detail.ejs', {
        bien,
        banniereSuccess: null,
        erreurAjoutLot: erreurs['designation'] || erreurs['_global'] || 'Données invalides',
      });
    }

    try {
      await ajouterLot(
        {
          bienId: id as BienId,
          designation: parsed.data.designation,
          surface: parsed.data.surface,
          type: parsed.data.type,
          etage: parsed.data.etage,
        },
        opts.repo,
      );
      return reply.redirect('/biens/' + id);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // POST /biens/:id/lots/:lotId/supprimer — supprimer un lot
  app.post('/biens/:id/lots/:lotId/supprimer', async (req, reply) => {
    const { id, lotId } = req.params as { id: string; lotId: string };
    try {
      await supprimerLot(id as BienId, lotId as LotId, opts.repo);
      return reply.redirect('/biens/' + id);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof InvariantViolated) {
        // Invariant ≥1 lot : re-render détail avec message d'erreur (400)
        const bien = await opts.repo.trouverParId(id as BienId);
        if (!bien) return reply.code(404).send('Bien introuvable');
        return reply.code(400).view('pages/biens/detail.ejs', {
          bien,
          banniereSuccess: null,
          erreurAjoutLot: err.message,
        });
      }
      throw err;
    }
  });
}

/** Extrait les erreurs Zod en un dictionnaire chemin → premier message. */
function extraireErreurs(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}
