import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type _multipartTypes from '@fastify/multipart';
import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type {
  BienId,
  JustificatifId,
  LocataireId,
} from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import type { ConvertisseurImage } from '../../domain/documents/convertisseur-image.js';
import {
  ConversionHeicIndisponible,
  DocumentDejaEnCorbeille,
  DocumentNonEnCorbeille,
  FichierIntrouvable,
  FichierTropVolumineux,
  FormatNonAccepte,
  JustificatifIntrouvable,
  MimeMismatch,
  PurgeAvantDixAnsRefusee,
} from '../../domain/documents/erreurs.js';
import type {
  JustificatifRepository,
} from '../../domain/documents/justificatif-repository.js';
import type {
  TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import { listerCorbeille } from '../../application/documents/lister-corbeille.js';
import { modifierJustificatif } from '../../application/documents/modifier-justificatif.js';
import { purgerJustificatif } from '../../application/documents/purger-justificatif.js';
import { rechercherJustificatifs } from '../../application/documents/rechercher-justificatifs.js';
import { restaurerJustificatif } from '../../application/documents/restaurer-justificatif.js';
import {
  BienAttacheIntrouvable,
  LocataireAttacheIntrouvable,
  uploaderJustificatif,
} from '../../application/documents/uploader-justificatif.js';
import { mettreJustificatifEnCorbeille } from '../../application/documents/mettre-justificatif-en-corbeille.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import {
  corbeilleJustificatifFormSchema,
  filtresCoffreSchema,
  modifierJustificatifSchema,
  uploadJustificatifFormSchema,
} from '../schemas/justificatif-schemas.js';
import { encodeFilenameRFC6266 } from '../helpers/content-disposition.js';

interface CoffrePluginOpts {
  justificatifRepo: JustificatifRepository;
  bienRepo: BienRepository;
  locataireRepo: LocataireRepository;
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

interface UploadFields {
  titre: string | undefined;
  type: string | undefined;
  dateDocument: string | undefined;
  bienId: string | undefined;
  locataireId: string | undefined;
  rattachement: string | undefined;
  montantTtcCentimes: string | undefined;
  notes: string | undefined;
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
  opts: CoffrePluginOpts,
): Promise<void> {
  // GET /coffre — liste des justificatifs avec 5 filtres facettés (D-110, UI-3.2)
  app.get('/coffre', async (req, reply) => {
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const parsed = filtresCoffreSchema.safeParse(req.query);
    // En cas d'erreur de parse (UUID invalide, etc.), on retombe sur les
    // valeurs par défaut au lieu de renvoyer 400 — les filtres invalides
    // sont silencieusement ignorés (UX dégradée mais pas crash).
    const filtres = parsed.success ? parsed.data : { page: 1 };

    const result = await rechercherJustificatifs(
      {
        search: filtres.search,
        bienId: filtres.bien,
        locataireId: filtres.locataire,
        anneeFiscale: filtres.annee,
        type: filtres.type as TypeJustificatif | undefined,
        page: filtres.page ?? 1,
        pageSize: 20,
      },
      { justificatifRepo: opts.justificatifRepo },
    );

    const biens = await opts.bienRepo.listerTous();
    const locataires = await opts.locataireRepo.listerTous();
    const corbeille = await listerCorbeille({}, {
      justificatifRepo: opts.justificatifRepo,
    });

    return reply.view('pages/coffre/liste.ejs', {
      items: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      biens,
      locataires,
      filtres: {
        search: filtres.search ?? '',
        bien: filtres.bien ?? '',
        locataire: filtres.locataire ?? '',
        annee: filtres.annee ?? '',
        type: filtres.type ?? '',
      },
      nbCorbeille: corbeille.length,
      navActive: 'coffre',
      banniereSuccess,
      banniereWarning,
    });
  });

  // GET /coffre/corbeille — liste des justificatifs soft-deleted (UI-5.1)
  app.get('/coffre/corbeille', async (req, reply) => {
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const items = await listerCorbeille({}, {
      justificatifRepo: opts.justificatifRepo,
    });
    const biens = await opts.bienRepo.listerTous();
    const locataires = await opts.locataireRepo.listerTous();

    return reply.view('pages/coffre/corbeille.ejs', {
      items,
      biens,
      locataires,
      navActive: 'coffre',
      banniereSuccess,
      banniereWarning,
    });
  });

  // GET /coffre/upload — formulaire upload
  app.get('/coffre/upload', async (_req, reply) => {
    const biens = await opts.bienRepo.listerTous();
    const locataires = await opts.locataireRepo.listerTous();
    return reply.view('pages/coffre/upload.ejs', {
      biens,
      locataires,
      navActive: 'coffre',
      erreurs: {},
      valeurs: {},
    });
  });

  // POST /coffre/upload — upload justificatif (multipart)
  app.post('/coffre/upload', async (req, reply) => {
    let fichierBuffer: Buffer | null = null;
    let fichierNom = '';
    let fichierMimeAnnonce = '';
    const fields: Record<string, string> = {};

    try {
      const data = await req.file();
      if (!data) {
        const biens = await opts.bienRepo.listerTous();
        const locataires = await opts.locataireRepo.listerTous();
        return reply.code(400).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { fichier: 'Aucun fichier reçu.' },
          valeurs: {},
        });
      }
      fichierBuffer = await data.toBuffer();
      // G-UX-02 : fichier vide (0 octet) envoyé par multipart sans sélection
      if (fichierBuffer.length === 0) {
        const biens = await opts.bienRepo.listerTous();
        const locataires = await opts.locataireRepo.listerTous();
        return reply.code(400).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { fichier: 'Aucun fichier reçu.' },
          valeurs: {},
        });
      }
      fichierNom = data.filename;
      fichierMimeAnnonce = data.mimetype;
      // Récupère les fields (texte) du multipart
      const allFields = data.fields as Record<string, unknown>;
      for (const [k, v] of Object.entries(allFields)) {
        const value = readField(v);
        if (value !== undefined && k !== 'fichier') {
          fields[k] = value;
        }
      }
    } catch (err) {
      // FST_REQ_FILE_TOO_LARGE → 413
      const errMsg = (err as Error & { code?: string }).code;
      if (errMsg === 'FST_REQ_FILE_TOO_LARGE') {
        const biens = await opts.bienRepo.listerTous();
        const locataires = await opts.locataireRepo.listerTous();
        return reply.code(413).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: {
            fichier:
              'Fichier trop volumineux. La taille maximale est 50 Mo.',
          },
          valeurs: {},
        });
      }
      throw err;
    }

    // Parse fields via Zod
    const formBody: UploadFields = {
      titre: fields['titre'],
      type: fields['type'],
      dateDocument: fields['dateDocument'],
      bienId: fields['bienId'],
      locataireId: fields['locataireId'],
      rattachement: fields['rattachement'],
      montantTtcCentimes: fields['montantTtcCentimes'],
      notes: fields['notes'],
    };
    const parsed = uploadJustificatifFormSchema.safeParse(formBody);
    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const biens = await opts.bienRepo.listerTous();
      const locataires = await opts.locataireRepo.listerTous();
      return reply.code(400).view('pages/coffre/upload.ejs', {
        biens,
        locataires,
        navActive: 'coffre',
        erreurs,
        valeurs: formBody,
      });
    }

    if (!fichierBuffer) {
      throw new Error('Fichier manquant après parsing multipart');
    }

    try {
      const montantTtc =
        parsed.data.montantTtcCentimes === undefined
          ? null
          : Money.fromCentimes(BigInt(parsed.data.montantTtcCentimes));

      const { justificatifId } = await uploaderJustificatif(
        {
          titre: parsed.data.titre,
          type: parsed.data.type as never,
          dateDocument: Temporal.PlainDate.from(parsed.data.dateDocument),
          bienId: (parsed.data.bienId ?? null) as BienId | null,
          locataireId: (parsed.data.locataireId ?? null) as LocataireId | null,
          notes: parsed.data.notes ?? null,
          montantTtc,
          fichier: {
            buffer: fichierBuffer,
            nomOriginal: fichierNom,
            mimeAnnonce: fichierMimeAnnonce,
          },
        },
        opts,
      );
      req.session.banniereSuccess = 'Document ajouté.';
      return reply.redirect(`/justificatifs/${justificatifId}`);
    } catch (err) {
      const biens = await opts.bienRepo.listerTous();
      const locataires = await opts.locataireRepo.listerTous();
      const valeurs = formBody;

      if (err instanceof FormatNonAccepte) {
        return reply.code(415).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { fichier: err.message },
          valeurs,
        });
      }
      if (err instanceof FichierTropVolumineux) {
        return reply.code(413).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { fichier: err.message },
          valeurs,
        });
      }
      if (err instanceof MimeMismatch) {
        return reply.code(422).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { fichier: err.message },
          valeurs,
        });
      }
      if (err instanceof BienAttacheIntrouvable) {
        return reply.code(400).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { bienId: err.message },
          valeurs,
        });
      }
      if (err instanceof LocataireAttacheIntrouvable) {
        return reply.code(400).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { locataireId: err.message },
          valeurs,
        });
      }
      if (err instanceof InvariantViolated) {
        return reply.code(400).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: { _global: err.message },
          valeurs,
        });
      }
      // G-HEIC-02 : libheif présent sans plugin HEVC — 503 avec message actionable
      if (err instanceof ConversionHeicIndisponible) {
        return reply.code(503).view('pages/coffre/upload.ejs', {
          biens,
          locataires,
          navActive: 'coffre',
          erreurs: {
            fichier:
              "HEIC non supporté sur ce poste. Convertissez votre fichier en JPEG (Aperçu/Photos sur macOS) avant l'upload, ou installez le plugin libheif (cf. README §Dépendances système).",
          },
          valeurs,
        });
      }
      throw err;
    }
  });

  // GET /justificatifs/:id — fiche détail
  app.get('/justificatifs/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const j = await opts.justificatifRepo.trouverParId(id);
    if (!j) {
      return reply.code(404).view('pages/erreur.ejs', {
        message: 'Document introuvable.',
        navActive: 'coffre',
      });
    }
    if (j.corbeilleLe !== null) {
      req.session.banniereWarning = 'Ce document est en corbeille.';
      return reply.redirect('/coffre');
    }

    const bien = j.bienId
      ? await opts.bienRepo.trouverParId(j.bienId)
      : null;
    const locataire = j.locataireId
      ? await opts.locataireRepo.trouverParId(j.locataireId)
      : null;

    return reply.view('pages/justificatifs/detail.ejs', {
      justificatif: j,
      bien,
      locataire,
      navActive: 'coffre',
      banniereSuccess,
      banniereWarning,
    });
  });

  // GET /justificatifs/:id/fichier — télécharger / streamer le fichier
  app.get('/justificatifs/:id/fichier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const j = await opts.justificatifRepo.trouverParId(id);
    if (!j) {
      return reply.code(404).send('Document introuvable.');
    }
    if (j.corbeilleLe !== null) {
      return reply.code(410).send('Ce document est en corbeille.');
    }
    try {
      const buffer = await opts.stockage.lire(j.cheminFichier);
      return reply
        .header('Content-Type', j.mimeType)
        .header('Content-Disposition', encodeFilenameRFC6266(j.nomFichierOriginal))
        .send(buffer);
    } catch (err) {
      if (err instanceof FichierIntrouvable) {
        return reply.code(404).send('Fichier introuvable.');
      }
      throw err;
    }
  });

  // POST /justificatifs/:id/corbeille — soft-delete D-109
  app.post('/justificatifs/:id/corbeille', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) ?? {};
    const parsed = corbeilleJustificatifFormSchema.safeParse(body);
    if (!parsed.success) {
      req.session.banniereWarning =
        parsed.error.issues[0]?.message ?? 'Raison invalide.';
      return reply.redirect(`/justificatifs/${id}`);
    }

    try {
      await mettreJustificatifEnCorbeille(
        {
          id: id as JustificatifId,
          raison: parsed.data.raison ?? 'Mise en corbeille',
        },
        { justificatifRepo: opts.justificatifRepo, clock: opts.clock },
      );
    } catch (err) {
      if (err instanceof JustificatifIntrouvable) {
        return reply.code(404).send('Document introuvable.');
      }
      if (err instanceof DocumentDejaEnCorbeille) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/justificatifs/${id}`);
      }
      throw err;
    }

    req.session.banniereSuccess = 'Document déplacé vers la corbeille.';
    return reply.redirect('/coffre');
  });

  // POST /justificatifs/:id/restaurer — annule un soft-delete (UI-5.1)
  app.post('/justificatifs/:id/restaurer', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await restaurerJustificatif(
        { id: id as JustificatifId },
        { justificatifRepo: opts.justificatifRepo },
      );
    } catch (err) {
      if (err instanceof JustificatifIntrouvable) {
        return reply.code(404).send('Document introuvable.');
      }
      if (err instanceof DocumentNonEnCorbeille) {
        req.session.banniereWarning = "Ce document n'est pas en corbeille.";
        return reply.redirect('/coffre/corbeille');
      }
      throw err;
    }
    req.session.banniereSuccess = 'Document restauré.';
    return reply.redirect('/coffre/corbeille');
  });

  // POST /justificatifs/:id/purger — hard-delete D-109 (gate 10 ans)
  app.post('/justificatifs/:id/purger', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await purgerJustificatif(
        { id: id as JustificatifId },
        {
          justificatifRepo: opts.justificatifRepo,
          stockage: opts.stockage,
          clock: opts.clock,
          db: opts.db,
        },
      );
    } catch (err) {
      if (err instanceof JustificatifIntrouvable) {
        return reply.code(404).send('Document introuvable.');
      }
      if (err instanceof PurgeAvantDixAnsRefusee) {
        req.session.banniereWarning = err.message;
        return reply.redirect('/coffre/corbeille');
      }
      if (err instanceof InvariantViolated) {
        req.session.banniereWarning = err.message;
        return reply.redirect('/coffre/corbeille');
      }
      throw err;
    }
    req.session.banniereSuccess = 'Document supprimé définitivement.';
    return reply.redirect('/coffre/corbeille');
  });

  // GET /justificatifs/:id/modifier — form édition metadata (UI-4.4)
  app.get('/justificatifs/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const j = await opts.justificatifRepo.trouverParId(id);
    if (!j) {
      return reply.code(404).view('pages/erreur.ejs', {
        message: 'Document introuvable.',
        navActive: 'coffre',
      });
    }
    if (j.corbeilleLe !== null) {
      return reply.code(410).view('pages/erreur.ejs', {
        message: 'Ce document est en corbeille — restaurez-le pour le modifier.',
        navActive: 'coffre',
      });
    }
    return reply.view('pages/justificatifs/modifier.ejs', {
      justificatif: j,
      erreurs: {},
      valeurs: {},
      navActive: 'coffre',
    });
  });

  // POST /justificatifs/:id/modifier — patch metadata (UI-4.4)
  app.post('/justificatifs/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as Record<string, unknown>) ?? {};
    const parsed = modifierJustificatifSchema.safeParse(body);

    if (!parsed.success) {
      const j = await opts.justificatifRepo.trouverParId(id);
      if (!j) {
        return reply.code(404).send('Document introuvable.');
      }
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.code(400).view('pages/justificatifs/modifier.ejs', {
        justificatif: j,
        erreurs,
        valeurs: body,
        navActive: 'coffre',
      });
    }

    try {
      const montantTtc =
        parsed.data.montantTtcCentimes === undefined
          ? null
          : Money.fromCentimes(BigInt(parsed.data.montantTtcCentimes));

      await modifierJustificatif(
        {
          id: id as JustificatifId,
          patch: {
            titre: parsed.data.titre,
            type: parsed.data.type as TypeJustificatif,
            dateDocument: Temporal.PlainDate.from(parsed.data.dateDocument),
            montantTtc,
            notes: parsed.data.notes ?? null,
          },
        },
        { justificatifRepo: opts.justificatifRepo },
      );
    } catch (err) {
      if (err instanceof JustificatifIntrouvable) {
        return reply.code(404).send('Document introuvable.');
      }
      if (err instanceof InvariantViolated) {
        const j = await opts.justificatifRepo.trouverParId(id);
        if (!j) return reply.code(404).send('Document introuvable.');
        return reply.code(400).view('pages/justificatifs/modifier.ejs', {
          justificatif: j,
          erreurs: { _global: err.message },
          valeurs: body,
          navActive: 'coffre',
        });
      }
      throw err;
    }

    req.session.banniereSuccess = 'Document mis à jour.';
    return reply.redirect(`/justificatifs/${id}`);
  });
}
