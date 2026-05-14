import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailId, BienId, LocataireId, LotId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import { creerBail } from '../../application/locatif/creer-bail.js';
import { modifierBail } from '../../application/locatif/modifier-bail.js';
import { supprimerBail } from '../../application/locatif/supprimer-bail.js';
import { desactiverBail } from '../../application/locatif/desactiver-bail.js';
import { listerBaux } from '../../application/locatif/lister-baux.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { ActiviteBailDetector } from '../../domain/locatif/activite-bail-detector.js';
import { bailCreationSchema } from '../schemas/bail-schemas.js';
import type { Bien } from '../../domain/patrimoine/bien.js';

/** Formate un Temporal.PlainDate en DD/MM/YYYY (format légal français). */
function formatDate(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}

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
  opts: {
    bailRepo: BailRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    activiteBailDetector: ActiviteBailDetector;
  },
): Promise<void> {

  // GET /baux — liste avec empty state prérequis
  app.get('/baux', async (_req, reply) => {
    const [baux, biens, locataires] = await Promise.all([
      listerBaux(opts.bailRepo),
      opts.bienRepo.listerTous(),
      opts.locataireRepo.listerTous(),
    ]);

    // Maps pour résolution dans les vues
    const biensMap: Record<string, Bien> = {};
    for (const b of biens) biensMap[b.id] = b;
    const locatairesMap: Record<string, string> = {};
    for (const l of locataires) locatairesMap[l.id] = `${l.prenom} ${l.nom}`;

    return reply.view('pages/baux/liste.ejs', {
      baux,
      biensCount: biens.length,
      locatairesCount: locataires.length,
      biensMap,
      locatairesMap,
      banniereSuccess: null,
      navActive: 'baux',
      formatDate,
    });
  });

  // GET /baux/nouveau — formulaire création
  app.get('/baux/nouveau', async (req, reply) => {
    const [biens, locataires] = await Promise.all([
      opts.bienRepo.listerTous(),
      opts.locataireRepo.listerTous(),
    ]);

    // Prérequis : ≥1 bien ET ≥1 locataire
    if (biens.length === 0 || locataires.length === 0) {
      return reply.redirect('/baux');
    }

    const query = req.query as { bienId?: string; locataireId?: string };
    let lotsDisponibles: Array<{ id: string; designation: string; surface: number | null }> = [];

    if (query.bienId) {
      const bien = await opts.bienRepo.trouverParId(query.bienId as BienId);
      if (bien) {
        lotsDisponibles = bien.lots.map((l) => ({
          id: l.id,
          designation: l.designation,
          surface: l.surface,
        }));
      }
    }

    return reply.view('pages/baux/formulaire.ejs', {
      mode: 'creation',
      bail: null,
      biens,
      locataires,
      lotsDisponibles,
      valeurs: {
        bienId: query.bienId ?? '',
        locataireId: query.locataireId ?? '',
      },
      erreurs: {},
      navActive: 'baux',
      formatDate,
    });
  });

  // POST /baux — créer un Bail
  app.post('/baux', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const parsed = bailCreationSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const [biens, locataires] = await Promise.all([
        opts.bienRepo.listerTous(),
        opts.locataireRepo.listerTous(),
      ]);

      let lotsDisponibles: Array<{ id: string; designation: string; surface: number | null }> = [];
      if (body['bienId'] && typeof body['bienId'] === 'string') {
        const bien = await opts.bienRepo.trouverParId(body['bienId'] as BienId);
        if (bien) {
          lotsDisponibles = bien.lots.map((l) => ({ id: l.id, designation: l.designation, surface: l.surface }));
        }
      }

      return reply.view('pages/baux/formulaire.ejs', {
        mode: 'creation',
        bail: null,
        biens,
        locataires,
        lotsDisponibles,
        valeurs: body,
        erreurs,
        navActive: 'baux',
        formatDate,
      });
    }

    try {
      const data = parsed.data;
      const cautionnementCommande = data.cautionnementType && data.cautionnementDateSignature && data.cautionnementDureeMois
        ? {
            type: data.cautionnementType,
            garant: data.cautionnementType === 'physique' && data.garantNom && data.garantPrenom && data.garantEmail
              ? {
                  nom: data.garantNom,
                  prenom: data.garantPrenom,
                  email: data.garantEmail,
                  telephone: data.garantTelephone ?? '',
                  adresse: Adresse.creer({
                    rue: data.garantRue ?? '',
                    codePostal: data.garantCodePostal ?? '00000',
                    ville: data.garantVille ?? '',
                  }),
                }
              : null,
            montantGaranti: data.cautionnementMontantGarantiEuros
              ? Money.fromEuros(data.cautionnementMontantGarantiEuros)
              : null,
            dateSignature: Temporal.PlainDate.from(data.cautionnementDateSignature),
            dureeEngagement: data.cautionnementDureeMois,
          }
        : null;

      const bailId = await creerBail(
        {
          bienId: data.bienId as BienId,
          locataireId: data.locataireId as LocataireId,
          lotIds: data.lotIds as LotId[],
          dateDebut: Temporal.PlainDate.from(data.dateDebut),
          dureeMois: data.dureeMois,
          loyerHc: Money.fromEuros(data.loyerHcEuros),
          modeCharges: data.modeCharges,
          montantCharges: Money.fromEuros(data.montantChargesEuros),
          depotGarantie: Money.fromEuros(data.depotGarantieEuros),
          irlReference: IRL.creer({ trimestre: data.irlTrimestre, valeur: data.irlValeur }),
          cautionnement: cautionnementCommande,
        },
        opts.bailRepo,
        opts.bienRepo,
        opts.locataireRepo,
      );

      return reply.redirect('/baux/' + bailId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const [biens, locataires] = await Promise.all([
        opts.bienRepo.listerTous(),
        opts.locataireRepo.listerTous(),
      ]);
      return reply.view('pages/baux/formulaire.ejs', {
        mode: 'creation',
        bail: null,
        biens,
        locataires,
        lotsDisponibles: [],
        valeurs: body,
        erreurs: { _global: message },
        navActive: 'baux',
        formatDate,
      });
    }
  });

  // GET /baux/:id — détail
  app.get('/baux/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Ce bail n\'existe pas ou a été supprimé. <a href="/baux">Retour aux baux</a>');
    }

    const [bien, locataire, aDeLActivite] = await Promise.all([
      opts.bienRepo.trouverParId(bail.bienId),
      opts.locataireRepo.trouverParId(bail.locataireId),
      opts.activiteBailDetector.aDeLActivite(bail.id),
    ]);

    if (!bien || !locataire) {
      return reply.code(404).send('Données du bail incomplètes (bien ou locataire introuvable).');
    }

    // Lire et vider les bannières de session
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    // Résoudre les lots concernés par ce bail
    const lotsduBail = bien.lots.filter((l) => bail.lotIds.includes(l.id as LotId));

    return reply.view('pages/baux/detail.ejs', {
      bail,
      bien,
      locataire,
      lotsduBail,
      aDeLActivite,
      banniereSuccess,
      banniereWarning,
      navActive: 'baux',
      formatDate,
    });
  });

  // GET /baux/:id/modifier — formulaire édition
  app.get('/baux/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Ce bail n\'existe pas ou a été supprimé.');
    }

    const [biens, locataires] = await Promise.all([
      opts.bienRepo.listerTous(),
      opts.locataireRepo.listerTous(),
    ]);

    const bienDuBail = await opts.bienRepo.trouverParId(bail.bienId);
    const lotsDisponibles = bienDuBail
      ? bienDuBail.lots.map((l) => ({ id: l.id, designation: l.designation, surface: l.surface }))
      : [];

    return reply.view('pages/baux/formulaire.ejs', {
      mode: 'edition',
      bail,
      biens,
      locataires,
      lotsDisponibles,
      valeurs: {
        bienId: bail.bienId,
        locataireId: bail.locataireId,
        lotIds: [...bail.lotIds],
        dateDebut: bail.dateDebut.toString(),
        dureeMois: bail.dureeMois,
        loyerHcEuros: Number(bail.loyerHc.toCentimes()) / 100,
        modeCharges: bail.modeCharges,
        montantChargesEuros: Number(bail.montantCharges.toCentimes()) / 100,
        depotGarantieEuros: Number(bail.depotGarantie.toCentimes()) / 100,
        irlTrimestre: bail.irlReference.trimestre,
        irlValeur: bail.irlReference.valeur,
        cautionnementType: bail.cautionnement?.type ?? '',
        cautionnementDateSignature: bail.cautionnement?.dateSignature.toString() ?? '',
        cautionnementDureeMois: bail.cautionnement?.dureeEngagement ?? '',
      },
      erreurs: {},
      navActive: 'baux',
      formatDate,
    });
  });

  // POST /baux/:id/modifier — persister modifications
  app.post('/baux/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const parsed = bailCreationSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      const [biens, locataires] = await Promise.all([
        opts.bienRepo.listerTous(),
        opts.locataireRepo.listerTous(),
      ]);
      return reply.view('pages/baux/formulaire.ejs', {
        mode: 'edition',
        bail,
        biens,
        locataires,
        lotsDisponibles: [],
        valeurs: body,
        erreurs,
        navActive: 'baux',
        formatDate,
      });
    }

    try {
      const data = parsed.data;
      const cautionnementCommande = data.cautionnementType && data.cautionnementDateSignature && data.cautionnementDureeMois
        ? {
            type: data.cautionnementType,
            garant: data.cautionnementType === 'physique' && data.garantNom && data.garantPrenom && data.garantEmail
              ? {
                  nom: data.garantNom,
                  prenom: data.garantPrenom,
                  email: data.garantEmail,
                  telephone: data.garantTelephone ?? '',
                  adresse: Adresse.creer({
                    rue: data.garantRue ?? '',
                    codePostal: data.garantCodePostal ?? '00000',
                    ville: data.garantVille ?? '',
                  }),
                }
              : null,
            montantGaranti: data.cautionnementMontantGarantiEuros
              ? Money.fromEuros(data.cautionnementMontantGarantiEuros)
              : null,
            dateSignature: Temporal.PlainDate.from(data.cautionnementDateSignature),
            dureeEngagement: data.cautionnementDureeMois,
          }
        : null;

      await modifierBail(
        {
          id: id as BailId,
          bienId: data.bienId as BienId,
          lotIds: data.lotIds as LotId[],
          dateDebut: Temporal.PlainDate.from(data.dateDebut),
          dureeMois: data.dureeMois,
          loyerHc: Money.fromEuros(data.loyerHcEuros),
          modeCharges: data.modeCharges,
          montantCharges: Money.fromEuros(data.montantChargesEuros),
          depotGarantie: Money.fromEuros(data.depotGarantieEuros),
          irlReference: IRL.creer({ trimestre: data.irlTrimestre, valeur: data.irlValeur }),
          cautionnement: cautionnementCommande,
        },
        opts.bailRepo,
        opts.bienRepo,
      );

      return reply.redirect('/baux/' + id);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // POST /baux/:id/supprimer — soft-delete (D-74 : refusé si activité)
  app.post('/baux/:id/supprimer', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await supprimerBail(id as BailId, opts.bailRepo, opts.activiteBailDetector);
      return reply.redirect('/baux');
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof InvariantViolated && err.message === 'Bail avec activité ne peut être supprimé') {
        req.session.banniereWarning = "Ce bail a déjà de l'activité, il ne peut plus être supprimé. Vous pouvez en revanche le désactiver.";
        return reply.redirect('/baux/' + id);
      }
      throw err;
    }
  });

  // POST /baux/:id/desactiver — désactivation non-destructive (D-74)
  app.post('/baux/:id/desactiver', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await desactiverBail(id as BailId, opts.bailRepo);
      req.session.banniereSuccess = 'Bail désactivé. Vous pouvez le réactiver depuis la fiche.';
      return reply.redirect('/baux/' + id);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });
}
