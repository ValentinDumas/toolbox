import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienId, LocataireId, LotId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import { creerBien } from '../../application/patrimoine/creer-bien.js';
import { creerLocataire } from '../../application/locatif/creer-locataire.js';
import { creerBail } from '../../application/locatif/creer-bail.js';
import {
  estPremierLancement,
  marquerWizardComplete,
} from '../../infrastructure/lifecycle/premier-lancement.js';
import {
  bienCreationSchema,
  normaliserLotsFormBody,
  locataireCreationSchema,
  wizardBailSchema,
} from '../schemas/wizard-schemas.js';

interface WizardSession {
  bienId?: string;
  locataireId?: string;
}

declare module 'fastify' {
  interface Session {
    wizard?: WizardSession;
    banniereSuccess?: string;
    banniereWarning?: string;
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
    db: Kysely<DB>;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    bailRepo: BailRepository;
  },
): Promise<void> {
  // Guard : si wizard déjà complété, toutes les pages /wizard/* redirigent vers /biens
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/wizard/')) return;
    const premier = await estPremierLancement(opts.db);
    if (!premier) {
      return reply.redirect('/biens');
    }
  });

  // ── Étape 1 : Bien ──────────────────────────────────────────────────────────

  app.get('/wizard/bien', async (_req, reply) => {
    return reply.view('pages/wizard/bien.ejs', {
      currentStep: 1,
      totalSteps: 3,
      valeurs: {},
      erreurs: {},
    });
  });

  app.post('/wizard/bien', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const lotsRaw = normaliserLotsFormBody(body);
    const parsed = bienCreationSchema.safeParse({ ...body, lots: lotsRaw });

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/wizard/bien.ejs', {
        currentStep: 1,
        totalSteps: 3,
        valeurs: body,
        erreurs,
      });
    }

    const data = parsed.data;
    const bienId = await creerBien(
      {
        adresse: { rue: data.rue, codePostal: data.codePostal, ville: data.ville },
        surface: data.surface,
        type: data.type,
        anneeConstruction: data.anneeConstruction,
        lots: data.lots,
      },
      opts.bienRepo,
    );

    req.session.wizard = { ...(req.session.wizard ?? {}), bienId };
    return reply.redirect('/wizard/locataire');
  });

  // ── Étape 2 : Locataire ──────────────────────────────────────────────────────

  app.get('/wizard/locataire', async (req, reply) => {
    if (!req.session.wizard?.bienId) {
      return reply.redirect('/wizard/bien');
    }
    return reply.view('pages/wizard/locataire.ejs', {
      currentStep: 2,
      totalSteps: 3,
      valeurs: {},
      erreurs: {},
    });
  });

  app.post('/wizard/locataire', async (req, reply) => {
    if (!req.session.wizard?.bienId) {
      return reply.redirect('/wizard/bien');
    }

    const body = req.body as Record<string, string>;
    const parsed = locataireCreationSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/wizard/locataire.ejs', {
        currentStep: 2,
        totalSteps: 3,
        valeurs: body,
        erreurs,
      });
    }

    const data = parsed.data;
    const locataireId = await creerLocataire(
      {
        nom: data.nom,
        prenom: data.prenom,
        dateNaissance: data.dateNaissance,
        communeNaissance: data.communeNaissance,
        paysNaissance: data.paysNaissance,
        nationalite: data.nationalite,
        email: data.email,
        telephone: data.telephone ?? null,
        adresseActuelle: { rue: data.rue, codePostal: data.codePostal, ville: data.ville },
      },
      opts.locataireRepo,
    );

    req.session.wizard = { ...req.session.wizard, locataireId };
    return reply.redirect('/wizard/bail');
  });

  // ── Étape 3 : Bail ───────────────────────────────────────────────────────────

  app.get('/wizard/bail', async (req, reply) => {
    const wizardSession = req.session.wizard;
    if (!wizardSession?.bienId || !wizardSession.locataireId) {
      return reply.redirect('/wizard/bien');
    }

    const [bien, locataire] = await Promise.all([
      opts.bienRepo.trouverParId(wizardSession.bienId as BienId),
      opts.locataireRepo.trouverParId(wizardSession.locataireId as LocataireId),
    ]);

    if (!bien || !locataire) {
      return reply.redirect('/wizard/bien');
    }

    return reply.view('pages/wizard/bail.ejs', {
      currentStep: 3,
      totalSteps: 3,
      bien,
      locataire,
      valeurs: {},
      erreurs: {},
    });
  });

  app.post('/wizard/bail', async (req, reply) => {
    const wizardSession = req.session.wizard;
    if (!wizardSession?.bienId || !wizardSession.locataireId) {
      return reply.redirect('/wizard/bien');
    }

    const body = req.body as Record<string, unknown>;
    const parsed = wizardBailSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const [bien, locataire] = await Promise.all([
        opts.bienRepo.trouverParId(wizardSession.bienId as BienId),
        opts.locataireRepo.trouverParId(wizardSession.locataireId as LocataireId),
      ]);
      return reply.view('pages/wizard/bail.ejs', {
        currentStep: 3,
        totalSteps: 3,
        bien,
        locataire,
        valeurs: body,
        erreurs,
      });
    }

    const data = parsed.data;
    const cautionnementCommande =
      data.cautionnementType && data.cautionnementDateSignature && data.cautionnementDureeMois
        ? {
            type: data.cautionnementType,
            garant:
              data.cautionnementType === 'physique' &&
              data.garantNom &&
              data.garantPrenom &&
              data.garantEmail
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
        bienId: wizardSession.bienId as BienId,
        locataireId: wizardSession.locataireId as LocataireId,
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

    await marquerWizardComplete(opts.db);
    app.log.info({ event: 'wizard_complete', bienId: wizardSession.bienId, locataireId: wizardSession.locataireId, bailId });

    req.session.wizard = undefined;
    req.session.banniereSuccess = 'Bail enregistré avec succès. Bienvenue !';
    return reply.redirect('/biens');
  });
}
