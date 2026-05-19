import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type {
  BienId,
  JustificatifId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import type { ConvertisseurImage } from '../../domain/documents/convertisseur-image.js';
import {
  FichierTropVolumineux,
  FormatNonAccepte,
  JustificatifIntrouvable,
  MimeMismatch,
} from '../../domain/documents/erreurs.js';
import type {
  TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import {
  PJIncoherenteBien,
  TicketIntrouvable,
  TransitionInvalide,
} from '../../domain/travaux/erreurs.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import { ajouterPJTicket } from '../../application/travaux/ajouter-pj-ticket.js';
import { annulerTicketTravaux } from '../../application/travaux/annuler-ticket-travaux.js';
import { cloreTicketTravaux } from '../../application/travaux/clore-ticket-travaux.js';
import { creerTicketTravaux } from '../../application/travaux/creer-ticket-travaux.js';
import { delierPJTicket } from '../../application/travaux/delier-pj-ticket.js';
import { lireTicket } from '../../application/travaux/lire-ticket.js';
import { listerTicketsParBien } from '../../application/travaux/lister-tickets-par-bien.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import {
  ajouterPJExistantSchema,
  ajouterPJUploadSchema,
  annulerTicketSchema,
  cloreTicketSchema,
  creerTicketSchema,
} from '../schemas/ticket-travaux-schemas.js';

interface TravauxPluginOpts {
  ticketRepo: TicketTravauxRepository;
  bienRepo: BienRepository;
  locataireRepo: LocataireRepository;
  justificatifRepo: JustificatifRepository;
  stockage: StockageJustificatifs;
  convertisseurImage: ConvertisseurImage;
  clock: Clock;
  db: Kysely<DB>;
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

function readField(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'value' in value) {
    const v = (value as { value: unknown }).value;
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

export async function plugin(
  app: FastifyInstance,
  opts: TravauxPluginOpts,
): Promise<void> {
  // ─── GET /biens/:id/travaux — liste tickets d'un Bien ────────────────────
  app.get('/biens/:id/travaux', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bien = await opts.bienRepo.trouverParId(id as BienId);
    if (!bien) {
      return reply.code(404).send('Bien introuvable.');
    }
    const tickets = await listerTicketsParBien(
      { bienId: bien.id },
      { ticketRepo: opts.ticketRepo },
    );
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;
    return reply.view('pages/travaux/liste.ejs', {
      bien,
      tickets,
      navActive: 'biens',
      banniereSuccess,
      banniereWarning,
    });
  });

  // ─── GET /travaux/nouveau — formulaire création ──────────────────────────
  // IMPORTANT : déclaré AVANT GET /travaux/:id pour éviter capture du segment
  // "nouveau" comme id (analog diagnostics.ts:27-46).
  app.get('/travaux/nouveau', async (req, reply) => {
    const { bienId } = req.query as { bienId?: string };
    if (!bienId) {
      return reply.code(400).send('bienId manquant.');
    }
    const bien = await opts.bienRepo.trouverParId(bienId as BienId);
    if (!bien) {
      return reply.code(404).send('Bien introuvable.');
    }
    return reply.view('pages/travaux/nouveau.ejs', {
      bien,
      erreurs: {},
      valeurs: {},
      navActive: 'biens',
    });
  });

  // ─── POST /biens/:id/travaux — créer un ticket ────────────────────────────
  app.post('/biens/:id/travaux', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) ?? {};
    const parsed = creerTicketSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bien = await opts.bienRepo.trouverParId(id as BienId);
      if (!bien) {
        return reply.code(404).send('Bien introuvable.');
      }
      return reply.code(400).view('pages/travaux/nouveau.ejs', {
        bien,
        erreurs,
        valeurs: body,
        navActive: 'biens',
      });
    }

    try {
      const coutEstime =
        parsed.data.coutEstimeTtcEuros === undefined
          ? null
          : Money.fromEuros(parsed.data.coutEstimeTtcEuros);
      const { ticketId } = await creerTicketTravaux(
        {
          bienId: id as BienId,
          titre: parsed.data.titre,
          description: parsed.data.description,
          dateOuverture: Temporal.PlainDate.from(parsed.data.dateOuverture),
          coutEstimeTtc: coutEstime,
          notes: parsed.data.notes ?? null,
        },
        {
          ticketRepo: opts.ticketRepo,
          bienRepo: opts.bienRepo,
          clock: opts.clock,
        },
      );
      req.session.banniereSuccess = 'Ticket créé.';
      return reply.redirect(`/travaux/${ticketId}`);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send('Bien introuvable.');
      }
      if (err instanceof InvariantViolated) {
        const bien = await opts.bienRepo.trouverParId(id as BienId);
        if (!bien) {
          return reply.code(404).send('Bien introuvable.');
        }
        return reply.code(400).view('pages/travaux/nouveau.ejs', {
          bien,
          erreurs: { _global: err.message },
          valeurs: body,
          navActive: 'biens',
        });
      }
      throw err;
    }
  });

  // ─── GET /travaux/:id — fiche détail ─────────────────────────────────────
  app.get('/travaux/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;
    try {
      const { ticket, bien, justificatifs } = await lireTicket(
        { id },
        {
          ticketRepo: opts.ticketRepo,
          bienRepo: opts.bienRepo,
          justificatifRepo: opts.justificatifRepo,
        },
      );
      return reply.view('pages/travaux/detail.ejs', {
        ticket,
        bien,
        justificatifs,
        navActive: 'biens',
        banniereSuccess,
        banniereWarning,
      });
    } catch (err) {
      if (err instanceof TicketIntrouvable) {
        return reply.code(404).send('Ticket introuvable.');
      }
      throw err;
    }
  });

  // ─── POST /travaux/:id/clore ─────────────────────────────────────────────
  app.post('/travaux/:id/clore', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) ?? {};
    const parsed = cloreTicketSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      // G-DATE-01 : on passe les erreurs Zod à la vue pour affichage inline
      // (dateCloture → span#dateCloture-error, coutReelTtcEuros → bannière)
      const messageVerbatim =
        erreurs['coutReelTtcEuros'] ?? erreurs['_global'] ?? undefined;
      try {
        const { ticket, bien, justificatifs } = await lireTicket(
          { id },
          {
            ticketRepo: opts.ticketRepo,
            bienRepo: opts.bienRepo,
            justificatifRepo: opts.justificatifRepo,
          },
        );
        return reply.code(400).view('pages/travaux/detail.ejs', {
          ticket,
          bien,
          justificatifs,
          navActive: 'biens',
          banniereWarning: messageVerbatim,
          erreurs,
          valeurs: body,
        });
      } catch (err) {
        if (err instanceof TicketIntrouvable) {
          return reply.code(404).send('Ticket introuvable.');
        }
        throw err;
      }
    }

    try {
      await cloreTicketTravaux(
        {
          id,
          dateCloture: Temporal.PlainDate.from(parsed.data.dateCloture),
          coutReelTtc: Money.fromEuros(parsed.data.coutReelTtcEuros as number),
        },
        { ticketRepo: opts.ticketRepo, clock: opts.clock },
      );
    } catch (err) {
      if (err instanceof TicketIntrouvable) {
        return reply.code(404).send('Ticket introuvable.');
      }
      if (err instanceof TransitionInvalide) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/travaux/${id}`);
      }
      if (err instanceof InvariantViolated) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/travaux/${id}`);
      }
      throw err;
    }

    req.session.banniereSuccess = 'Ticket clôturé.';
    return reply.redirect(`/travaux/${id}`);
  });

  // ─── POST /travaux/:id/annuler ───────────────────────────────────────────
  app.post('/travaux/:id/annuler', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) ?? {};
    const parsed = annulerTicketSchema.safeParse(body);

    if (!parsed.success) {
      req.session.banniereWarning =
        parsed.error.issues[0]?.message ?? 'Raison invalide.';
      return reply.redirect(`/travaux/${id}`);
    }

    let ticketBienId: BienId | null = null;
    try {
      const before = await opts.ticketRepo.trouverParId(id);
      if (before) ticketBienId = before.bienId;
      await annulerTicketTravaux(
        { id, raison: parsed.data.raison },
        { ticketRepo: opts.ticketRepo, clock: opts.clock },
      );
    } catch (err) {
      if (err instanceof TicketIntrouvable) {
        return reply.code(404).send('Ticket introuvable.');
      }
      throw err;
    }

    req.session.banniereSuccess = 'Ticket annulé.';
    if (ticketBienId) {
      return reply.redirect(`/biens/${ticketBienId}/travaux`);
    }
    return reply.redirect(`/travaux/${id}`);
  });

  // ─── POST /travaux/:id/justificatifs — dual-mode (upload OR attach) ──────
  app.post('/travaux/:id/justificatifs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { justificatifId?: string };
    const contentType = req.headers['content-type'] ?? '';

    // ─── Mode attach (query string ?justificatifId=...) ────────────────────
    if (query.justificatifId !== undefined && query.justificatifId !== '') {
      const parsed = ajouterPJExistantSchema.safeParse(query);
      if (!parsed.success) {
        req.session.banniereWarning =
          parsed.error.issues[0]?.message ?? 'Justificatif invalide.';
        return reply.redirect(`/travaux/${id}`);
      }
      try {
        await ajouterPJTicket(
          {
            ticketId: id as TicketTravauxId,
            justificatifId: parsed.data.justificatifId as JustificatifId,
          },
          opts,
        );
      } catch (err) {
        if (err instanceof TicketIntrouvable) {
          return reply.code(404).send('Ticket introuvable.');
        }
        if (err instanceof JustificatifIntrouvable) {
          req.session.banniereWarning = err.message;
          return reply.redirect(`/travaux/${id}`);
        }
        if (err instanceof PJIncoherenteBien) {
          req.session.banniereWarning = err.message;
          return reply.redirect(`/travaux/${id}`);
        }
        throw err;
      }
      req.session.banniereSuccess = 'Pièce jointe ajoutée au ticket.';
      return reply.redirect(`/travaux/${id}`);
    }

    // ─── Mode upload (multipart/form-data) ─────────────────────────────────
    if (!contentType.startsWith('multipart/')) {
      req.session.banniereWarning =
        'Aucun fichier ni justificatifId fourni.';
      return reply.redirect(`/travaux/${id}`);
    }

    let fichierBuffer: Buffer | null = null;
    let fichierNom = '';
    let fichierMimeAnnonce = '';
    const fields: Record<string, string> = {};

    // G-UX-02-bis : re-render fiche ticket avec erreur inline sous l'input fichier
    // (pattern identique à coffre.ts:199-222 — pas de session.banniereWarning + redirect)
    const renderErreurFichier = async (
      collectedFields: Record<string, string>,
    ) => {
      try {
        const { ticket, bien, justificatifs } = await lireTicket(
          { id },
          {
            ticketRepo: opts.ticketRepo,
            bienRepo: opts.bienRepo,
            justificatifRepo: opts.justificatifRepo,
          },
        );
        return reply.code(400).view('pages/travaux/detail.ejs', {
          ticket,
          bien,
          justificatifs,
          navActive: 'biens',
          erreurs: { fichier: 'Aucun fichier reçu.' },
          valeurs: collectedFields,
        });
      } catch (lireErr) {
        if (lireErr instanceof TicketIntrouvable) {
          return reply.code(404).send('Ticket introuvable.');
        }
        throw lireErr;
      }
    };

    try {
      const data = await req.file();
      if (!data) {
        return await renderErreurFichier({});
      }
      fichierBuffer = await data.toBuffer();
      fichierNom = data.filename;
      fichierMimeAnnonce = data.mimetype;
      const allFields = data.fields as Record<string, unknown>;
      for (const [k, v] of Object.entries(allFields)) {
        const value = readField(v);
        if (value !== undefined && k !== 'fichier') {
          fields[k] = value;
        }
      }
      // G-UX-02-bis : fichier présent mais 0 octet (multipart sans sélection réelle)
      if (fichierBuffer.length === 0) {
        return await renderErreurFichier(fields);
      }
    } catch (err) {
      const errMsg = (err as Error & { code?: string }).code;
      if (errMsg === 'FST_REQ_FILE_TOO_LARGE') {
        req.session.banniereWarning =
          'Fichier trop volumineux. La taille maximale est 50 Mo.';
        return reply.redirect(`/travaux/${id}`);
      }
      throw err;
    }

    const parsedFields = ajouterPJUploadSchema.safeParse(fields);
    if (!parsedFields.success) {
      const erreurs = extraireErreurs(parsedFields.error.issues);
      req.session.banniereWarning =
        Object.values(erreurs).join(' ') || 'Champs invalides.';
      return reply.redirect(`/travaux/${id}`);
    }

    if (!fichierBuffer) {
      throw new Error('Fichier manquant après parsing multipart');
    }

    try {
      const montantTtc =
        parsedFields.data.montantTtcEuros === undefined
          ? null
          : Money.fromEuros(parsedFields.data.montantTtcEuros);
      await ajouterPJTicket(
        {
          ticketId: id as TicketTravauxId,
          fichier: {
            buffer: fichierBuffer,
            nomOriginal: fichierNom,
            mimeAnnonce: fichierMimeAnnonce,
            titre: parsedFields.data.titre,
            type: parsedFields.data.type as TypeJustificatif,
            dateDocument: Temporal.PlainDate.from(parsedFields.data.dateDocument),
            montantTtc,
            notes: parsedFields.data.notes ?? null,
          },
        },
        opts,
      );
    } catch (err) {
      if (err instanceof TicketIntrouvable) {
        return reply.code(404).send('Ticket introuvable.');
      }
      if (
        err instanceof FormatNonAccepte ||
        err instanceof FichierTropVolumineux ||
        err instanceof MimeMismatch
      ) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/travaux/${id}`);
      }
      if (err instanceof InvariantViolated) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/travaux/${id}`);
      }
      throw err;
    }

    req.session.banniereSuccess = 'Pièce jointe ajoutée au ticket.';
    return reply.redirect(`/travaux/${id}`);
  });

  // ─── POST /travaux/:id/justificatifs/:jid/delier ─────────────────────────
  app.post(
    '/travaux/:id/justificatifs/:jid/delier',
    async (req, reply) => {
      const { id, jid } = req.params as { id: string; jid: string };
      try {
        await delierPJTicket(
          {
            ticketId: id as TicketTravauxId,
            justificatifId: jid as JustificatifId,
          },
          { ticketRepo: opts.ticketRepo },
        );
      } catch (err) {
        if (err instanceof TicketIntrouvable) {
          return reply.code(404).send('Ticket introuvable.');
        }
        throw err;
      }
      req.session.banniereSuccess = 'Pièce jointe retirée du ticket.';
      return reply.redirect(`/travaux/${id}`);
    },
  );
}
