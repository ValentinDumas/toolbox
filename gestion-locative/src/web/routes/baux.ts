import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailId, BienId, LocataireId, LotId } from '../../domain/_shared/identifiants.js';
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
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
import { bailCreationSchema, mobilierVersInventaireItems } from '../schemas/bail-schemas.js';
import type { Bien } from '../../domain/patrimoine/bien.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { modifierBailActif } from '../../application/locatif/modifier-bail-actif.js';
import { ClockSysteme } from '../../domain/_shared/clock.js';

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
    echeanceLoyerRepo?: EcheanceLoyerRepository;
    encaissementRepo?: EncaissementRepository;
    edlRepo?: EtatDesLieuxRepository;
    clock?: Clock;
  },
): Promise<void> {
  const clock = opts.clock ?? new ClockSysteme();

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

      const mobilierItems = mobilierVersInventaireItems(data.mobilier ?? []);
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
          mobilier: mobilierItems,
        },
        opts.bailRepo,
        opts.bienRepo,
        opts.locataireRepo,
      );

      // Warning LOC-06 : mobilier incomplet
      const bailCree = await opts.bailRepo.trouverParId(bailId);
      if (bailCree) {
        const { warning } = bailCree.verifierChecklistMobilier();
        if (warning) req.session.banniereWarning = warning;
      }

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

    // Phase 3-03 D-90 — calcul indexabilité + date dernier anniversaire pour banner.
    const today = clock.aujourdhui();
    let bailIndexable = false;
    let dateAnniversaire: Temporal.PlainDate | null = null;
    if (bail.actifDepuis !== null) {
      const premierAnniversaire = bail.dateDebut.add({ years: 1 });
      if (Temporal.PlainDate.compare(today, premierAnniversaire) >= 0) {
        bailIndexable = true;
        dateAnniversaire = bail.dateAnniversaireProchaine(today).subtract({ years: 1 });
      }
    }

    // Lire et vider les bannières de session
    const banniereSuccess = req.session.banniereSuccess ?? null;
    let banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    // Avertissement passé en query param (ex : activation rétroactive D-72)
    const query = req.query as Record<string, string>;
    if (query['avertissement']) {
      banniereWarning = decodeURIComponent(query['avertissement']);
    }

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
      bailIndexable,
      dateAnniversaire,
      navActive: 'baux',
      formatDate,
    });
  });

  // GET /baux/:id/modifier — formulaire édition (redirige vers /modifier-actif si bail actif)
  app.get('/baux/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Ce bail n\'existe pas ou a été supprimé.');
    }

    // D-73 : rediriger vers la route dédiée si le bail est actif
    if (bail.actifDepuis !== null) {
      return reply.redirect('/baux/' + id + '/modifier-actif');
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

      const mobilierItemsModif = mobilierVersInventaireItems(data.mobilier ?? []);
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
          mobilier: mobilierItemsModif,
        },
        opts.bailRepo,
        opts.bienRepo,
      );

      // Warning LOC-06 : mobilier incomplet après modification
      const bailModifie = await opts.bailRepo.trouverParId(id as BailId);
      if (bailModifie) {
        const { warning } = bailModifie.verifierChecklistMobilier();
        if (warning) req.session.banniereWarning = warning;
      }

      return reply.redirect('/baux/' + id);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // GET /baux/:id/modifier-actif — formulaire modification bail actif (D-73)
  app.get('/baux/:id/modifier-actif', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Ce bail n\'existe pas ou a été supprimé.');
    }

    // Bail brouillon : rediriger vers la route standard
    if (bail.actifDepuis === null) {
      return reply.redirect('/baux/' + id + '/modifier');
    }

    const [biens, locataires] = await Promise.all([
      opts.bienRepo.listerTous(),
      opts.locataireRepo.listerTous(),
    ]);

    const bienDuBail = await opts.bienRepo.trouverParId(bail.bienId);
    const lotsDisponibles = bienDuBail
      ? bienDuBail.lots.map((l) => ({ id: l.id, designation: l.designation, surface: l.surface }))
      : [];

    // Preview avec patch vide pour afficher les compteurs actuels
    let preview = { aRegenererCount: 0, aPreserverCount: 0, aRegenererIds: [] as import('../../domain/_shared/identifiants.js').EcheanceLoyerId[] };
    if (opts.echeanceLoyerRepo && opts.encaissementRepo) {
      const result = await modifierBailActif(
        { bailId: id as BailId, patch: {}, confirmation: 'previsualiser' },
        opts.bailRepo,
        opts.echeanceLoyerRepo,
        opts.encaissementRepo,
        clock,
      );
      if (result.kind === 'preview') {
        preview = result.preview;
      }
    }

    return reply.view('pages/baux/modifier.ejs', {
      bail,
      biens,
      locataires,
      lotsDisponibles,
      preview,
      mode: 'modifier-actif',
      erreurs: {},
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
      },
      navActive: 'baux',
      formatDate,
    });
  });

  // POST /baux/:id/modifier-actif — exécuter modification bail actif (D-73)
  app.post('/baux/:id/modifier-actif', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    if (!opts.echeanceLoyerRepo || !opts.encaissementRepo) {
      return reply.code(500).send('Dépendances manquantes pour modifier un bail actif.');
    }

    const parsed = bailCreationSchema.safeParse(body);
    const confirmation = body['confirmation'] as 'oui' | undefined;

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      const [biens, locataires] = await Promise.all([
        opts.bienRepo.listerTous(),
        opts.locataireRepo.listerTous(),
      ]);
      const bienDuBail = bail ? await opts.bienRepo.trouverParId(bail.bienId) : null;
      const lotsDisponibles = bienDuBail
        ? bienDuBail.lots.map((l) => ({ id: l.id, designation: l.designation, surface: l.surface }))
        : [];

      // Recalculer preview avec les nouvelles valeurs
      let preview = { aRegenererCount: 0, aPreserverCount: 0, aRegenererIds: [] as import('../../domain/_shared/identifiants.js').EcheanceLoyerId[] };
      if (bail && bail.actifDepuis !== null) {
        const result = await modifierBailActif(
          { bailId: id as BailId, patch: {}, confirmation: 'previsualiser' },
          opts.bailRepo,
          opts.echeanceLoyerRepo,
          opts.encaissementRepo,
          clock,
        );
        if (result.kind === 'preview') preview = result.preview;
      }

      return reply.view('pages/baux/modifier.ejs', {
        bail,
        biens,
        locataires,
        lotsDisponibles,
        preview,
        mode: 'modifier-actif',
        erreurs,
        valeurs: body,
        navActive: 'baux',
        formatDate,
      });
    }

    const data = parsed.data;

    // Si pas de confirmation : afficher preview avec les nouvelles valeurs du patch
    if (confirmation !== 'oui') {
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      if (!bail) return reply.code(404).send('Bail introuvable.');

      const [biens, locataires] = await Promise.all([
        opts.bienRepo.listerTous(),
        opts.locataireRepo.listerTous(),
      ]);
      const bienDuBail = await opts.bienRepo.trouverParId(bail.bienId);
      const lotsDisponibles = bienDuBail
        ? bienDuBail.lots.map((l) => ({ id: l.id, designation: l.designation, surface: l.surface }))
        : [];

      // Preview avec le patch simulé
      const result = await modifierBailActif(
        { bailId: id as BailId, patch: {}, confirmation: 'previsualiser' },
        opts.bailRepo,
        opts.echeanceLoyerRepo,
        opts.encaissementRepo,
        clock,
      );
      const preview = result.kind === 'preview' ? result.preview : { aRegenererCount: 0, aPreserverCount: 0, aRegenererIds: [] };

      return reply.view('pages/baux/modifier.ejs', {
        bail,
        biens,
        locataires,
        lotsDisponibles,
        preview,
        mode: 'modifier-actif',
        erreurs: {},
        valeurs: body,
        navActive: 'baux',
        formatDate,
      });
    }

    // Confirmation=oui : exécuter la modification
    try {
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

      const { Cautionnement } = await import('../../domain/locatif/cautionnement.js');
      const cautionnement = cautionnementCommande
        ? Cautionnement.creer(cautionnementCommande)
        : null;

      const result = await modifierBailActif(
        {
          bailId: id as BailId,
          patch: {
            loyerHc: Money.fromEuros(data.loyerHcEuros),
            modeCharges: data.modeCharges,
            montantCharges: Money.fromEuros(data.montantChargesEuros),
            depotGarantie: Money.fromEuros(data.depotGarantieEuros),
            irlReference: IRL.creer({ trimestre: data.irlTrimestre, valeur: data.irlValeur }),
            ...(cautionnement !== undefined && { cautionnement }),
          },
          confirmation: 'oui',
        },
        opts.bailRepo,
        opts.echeanceLoyerRepo,
        opts.encaissementRepo,
        clock,
      );

      if (result.kind === 'result') {
        req.session.banniereSuccess = `Bail modifié. ${result.echeancesRegenerees} échéances futures régénérées, ${result.echeancesPreservees} préservées.`;
      }

      return reply.redirect('/baux/' + id + '/echeances');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const bail = await opts.bailRepo.trouverParId(id as BailId);
      const biens = await opts.bienRepo.listerTous();
      const locataires = await opts.locataireRepo.listerTous();
      return reply.view('pages/baux/modifier.ejs', {
        bail,
        biens,
        locataires,
        lotsDisponibles: [],
        preview: { aRegenererCount: 0, aPreserverCount: 0, aRegenererIds: [] },
        mode: 'modifier-actif',
        erreurs: { _global: message },
        valeurs: body,
        navActive: 'baux',
        formatDate,
      });
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
