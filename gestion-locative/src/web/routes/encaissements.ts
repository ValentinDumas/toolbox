import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { EncaissementId, EcheanceLoyerId } from '../../domain/_shared/identifiants.js';
import { creerEncaissement } from '../../application/encaissements/creer-encaissement.js';
import { annulerEncaissement } from '../../application/encaissements/annuler-encaissement.js';
import { listerEncaissements } from '../../application/encaissements/lister-encaissements.js';
import { EcheanceAnnulee, EcheanceLoyerIntrouvable, BailNonActif } from '../../domain/encaissements/erreurs.js';
import { encaissementFormSchema, annulationFormSchema } from '../schemas/encaissement-schemas.js';

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
    encaissementRepo: EncaissementRepository;
    echeanceLoyerRepo: EcheanceLoyerRepository;
    bailRepo: BailRepository;
    locataireRepo: LocataireRepository;
    bienRepo: BienRepository;
    clock: Clock;
  },
): Promise<void> {

  // GET /encaissements — liste tous les encaissements
  app.get('/encaissements', async (req, reply) => {
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const encaissements = await listerEncaissements({ inclureAnnules: true }, opts.encaissementRepo);

    return reply.view('pages/encaissements/liste.ejs', {
      encaissements,
      navActive: 'encaissements',
      banniereSuccess,
      banniereWarning,
    });
  });

  // GET /encaissements/nouveau — formulaire de saisie
  app.get('/encaissements/nouveau', async (req, reply) => {
    const query = req.query as { echeance?: string };

    if (query.echeance) {
      // Mode pré-rempli depuis la page échéances
      const echeance = await opts.echeanceLoyerRepo.trouverParId(query.echeance as EcheanceLoyerId);
      if (!echeance) {
        return reply.code(404).send('Échéance introuvable.');
      }
      const bail = await opts.bailRepo.trouverParId(echeance.bailId);
      const locataire = bail ? await opts.locataireRepo.trouverParId(bail.locataireId) : null;

      return reply.view('pages/encaissements/formulaire.ejs', {
        echeance,
        echeancesOuvertes: [],
        bail,
        locataire,
        dateParDefaut: opts.clock.aujourdhui().toString(),
        navActive: 'encaissements',
        erreurs: {},
        valeurs: {},
      });
    }

    // Mode liste des échéances ouvertes
    const echeancesOuvertes = await opts.echeanceLoyerRepo.listerNonPayees();

    // M1 — Empty state quand toutes les échéances sont payées
    if (echeancesOuvertes.length === 0) {
      return reply.view('pages/encaissements/formulaire.ejs', {
        echeance: null,
        echeancesOuvertes: [],
        bail: null,
        locataire: null,
        dateParDefaut: opts.clock.aujourdhui().toString(),
        navActive: 'encaissements',
        erreurs: {},
        valeurs: {},
      });
    }

    return reply.view('pages/encaissements/formulaire.ejs', {
      echeance: null,
      echeancesOuvertes,
      bail: null,
      locataire: null,
      dateParDefaut: opts.clock.aujourdhui().toString(),
      navActive: 'encaissements',
      erreurs: {},
      valeurs: {},
    });
  });

  // POST /encaissements — créer un encaissement
  app.post('/encaissements', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    // Handle checkbox: if signe not in body, default to 'positif'
    const bodyWithSigne = { ...body, signe: body['signe'] ?? 'positif' };
    const parsed = encaissementFormSchema.safeParse(bodyWithSigne);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const echeancesOuvertes = await opts.echeanceLoyerRepo.listerNonPayees();

      let echeance = null;
      if (body['echeanceId'] && typeof body['echeanceId'] === 'string') {
        echeance = await opts.echeanceLoyerRepo.trouverParId(body['echeanceId'] as EcheanceLoyerId);
      }

      return reply.view('pages/encaissements/formulaire.ejs', {
        echeance,
        echeancesOuvertes,
        bail: null,
        locataire: null,
        dateParDefaut: opts.clock.aujourdhui().toString(),
        navActive: 'encaissements',
        erreurs,
        valeurs: body,
      });
    }

    try {
      const { echeanceId, montantEuros, signe, date, mode } = parsed.data;
      const montantCentimes = BigInt(Math.round(montantEuros * 100));

      const resultat = await creerEncaissement(
        {
          echeanceId: echeanceId as EcheanceLoyerId,
          montantCentimesPositifs: montantCentimes,
          signe,
          date: Temporal.PlainDate.from(date),
          mode,
        },
        opts.echeanceLoyerRepo,
        opts.encaissementRepo,
        opts.bailRepo,
        opts.clock,
      );

      req.session.banniereSuccess = 'Encaissement enregistré.';

      // Bannière warning pour sur-paiement et warnings D-61
      const warningParts: string[] = [];
      if (resultat.surPaiement) {
        warningParts.push(`Trop-perçu de ${resultat.surPaiement.enEuros()}. Pense à ajuster la prochaine échéance.`);
      }
      if (resultat.warnings.length > 0) {
        warningParts.push(...resultat.warnings);
      }
      if (warningParts.length > 0) {
        req.session.banniereWarning = warningParts.join(' ');
      }

      return reply.redirect('/encaissements/' + resultat.encaissementId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      const echeancesOuvertes = await opts.echeanceLoyerRepo.listerNonPayees();

      let echeance = null;
      if (body['echeanceId'] && typeof body['echeanceId'] === 'string') {
        echeance = await opts.echeanceLoyerRepo.trouverParId(body['echeanceId'] as EcheanceLoyerId);
      }

      if (err instanceof EcheanceAnnulee || err instanceof BailNonActif || err instanceof EcheanceLoyerIntrouvable) {
        return reply.view('pages/encaissements/formulaire.ejs', {
          echeance,
          echeancesOuvertes,
          bail: null,
          locataire: null,
          dateParDefaut: opts.clock.aujourdhui().toString(),
          navActive: 'encaissements',
          erreurs: { _global: message },
          valeurs: body,
        });
      }

      throw err;
    }
  });

  // GET /encaissements/:id — fiche d'un encaissement
  app.get('/encaissements/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const encaissement = await opts.encaissementRepo.trouverParId(id as EncaissementId);

    if (!encaissement) {
      return reply.code(404).send('Encaissement introuvable. <a href="/encaissements">Retour</a>');
    }

    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const echeance = await opts.echeanceLoyerRepo.trouverParId(encaissement.echeanceId);

    return reply.view('pages/encaissements/fiche.ejs', {
      encaissement,
      echeance,
      navActive: 'encaissements',
      banniereSuccess,
      banniereWarning,
      erreurs: {},
    });
  });

  // POST /encaissements/:id/annuler — annulation soft-delete
  app.post('/encaissements/:id/annuler', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const parsed = annulationFormSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const encaissement = await opts.encaissementRepo.trouverParId(id as EncaissementId);
      if (!encaissement) {
        return reply.code(404).send('Encaissement introuvable.');
      }
      const echeance = await opts.echeanceLoyerRepo.trouverParId(encaissement.echeanceId);

      return reply.view('pages/encaissements/fiche.ejs', {
        encaissement,
        echeance,
        navActive: 'encaissements',
        banniereSuccess: null,
        banniereWarning: null,
        erreurs,
      });
    }

    const result = await annulerEncaissement(
      { id: id as EncaissementId, raison: parsed.data.raison },
      opts.encaissementRepo,
      opts.echeanceLoyerRepo,
      opts.clock,
    );

    req.session.banniereSuccess = `Encaissement annulé.${result.rebasculee ? ` Le statut de l'échéance a été recalculé (${result.nouveauStatut}).` : ''}`;

    return reply.redirect('/encaissements/' + id);
  });
}
