import type { FastifyInstance } from 'fastify';
import type { JustificatifRepository } from '../../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../../domain/travaux/ticket-travaux-repository.js';
import type { DeclarationAnnuelleRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import { LABELS_TYPE_JUSTIFICATIF, type TypeJustificatif } from '../../../domain/documents/justificatif.js';
import { LABELS_QUALIFICATION, QUALIFICATIONS_VALIDES, type QualificationFiscale } from '../../../domain/fiscalite/qualification-fiscale.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { JustificatifId, TicketTravauxId } from '../../../domain/_shared/identifiants.js';
import { Money } from '../../../domain/_shared/money.js';
import { listerJustificatifsNonQualifies } from '../../../application/fiscalite/lister-justificatifs-non-qualifies.js';
import { qualifierTicketTravaux } from '../../../application/fiscalite/qualifier-ticket-travaux.js';
import { qualifierJustificatif } from '../../../application/fiscalite/qualifier-justificatif.js';
import { decomposerJustificatif } from '../../../application/fiscalite/decomposer-justificatif.js';
import { suggererQualification } from '../../../application/fiscalite/suggerer-qualification.js';
import {
  qualifierJustificatifSchema,
  qualifierTicketSchema,
  decomposerJustificatifSchema,
  normaliserEnfantsFormBody,
} from '../../schemas/fiscalite-schemas.js';
import { ComposantsSommeIncoherente, DeclarationFigeeException } from '../../../domain/fiscalite/erreurs.js';
import type { BienId } from '../../../domain/_shared/identifiants.js';

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

interface QualificationDeps {
  justificatifRepo: JustificatifRepository & { listerNonQualifiesPourAnnee(annee: number): Promise<ReturnType<JustificatifRepository['rechercher']>['then']> };
  ticketRepo: TicketTravauxRepository;
  /** D-FIS-G2.5 retrofit Plan 06 : lookup déclaration clôturée avant qualification */
  declRepo: Pick<DeclarationAnnuelleRepository, 'trouverParBailleurExercice'>;
  /** D-FIS-G2.5 retrofit Plan 06 : lookup bailleur pour le check figée */
  bailleurRepo: Pick<BailleurRepository, 'trouver'>;
  clock: Clock;
  db: { transaction(): { execute(fn: (trx: unknown) => Promise<void>): Promise<void> } };
}

/**
 * Routes de qualification fiscale des Justificatifs et TicketsTravaux (Plan 02).
 *
 * Endpoints :
 *   GET  /fiscalite/qualification?annee=N        → page S5 liste des justificatifs à qualifier
 *   POST /fiscalite/qualification/justificatif/:id → qualifie un justificatif individuel
 *   POST /fiscalite/qualification/ticket/:id      → qualifie un ticket entier + propagation
 *   POST /fiscalite/qualification/decomposer/:id  → split multi-biens
 *
 * Sécurité T-05-02-01 : CSRF protection héritée du plugin global @fastify/csrf-protection.
 */
export async function registerFiscaliteQualificationRoutes(
  app: FastifyInstance,
  deps: QualificationDeps,
): Promise<void> {
  const { justificatifRepo, ticketRepo, declRepo, bailleurRepo, clock, db } = deps;

  // GET /fiscalite/qualification → redirect vers l'année courante
  app.get('/fiscalite/qualification', async (req, reply) => {
    const query = req.query as { annee?: string };
    const annee = query.annee ? parseInt(query.annee, 10) : clock.aujourdhui().year;

    if (isNaN(annee)) {
      return reply.code(400).send('Paramètre annee invalide.');
    }

    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereErreur = req.session.banniereErreur ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereErreur) req.session.banniereErreur = undefined;

    const justificatifs = await listerJustificatifsNonQualifies(
      { annee },
      { justificatifRepo: justificatifRepo as never },
    );

    // Grouper par TypeJustificatif
    const justificatifsParType = new Map<TypeJustificatif, typeof justificatifs>();
    for (const j of justificatifs) {
      const groupe = justificatifsParType.get(j.type) ?? [];
      groupe.push(j);
      justificatifsParType.set(j.type, groupe);
    }

    // Pré-calculer la suggestion pour chaque justificatif
    const suggestions = new Map<string, QualificationFiscale>();
    for (const j of justificatifs) {
      suggestions.set(j.id, suggererQualification(j.type));
    }

    return reply.view('pages/fiscalite/qualifier-charges.ejs', {
      annee,
      justificatifs,
      justificatifsParType,
      suggestions,
      LABELS_TYPE_JUSTIFICATIF,
      LABELS_QUALIFICATION,
      QUALIFICATIONS_VALIDES,
      navActive: 'fiscalite',
      banniereSuccess,
      banniereErreur,
    });
  });

  // POST /fiscalite/qualification/justificatif/:id
  app.post('/fiscalite/qualification/justificatif/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const today = clock.aujourdhui();

    const parse = qualifierJustificatifSchema.safeParse(body);
    if (!parse.success) {
      const erreurs = extraireErreurs(parse.error.issues);
      req.log.warn({ erreurs, id }, 'Qualification justificatif invalide');
      req.session.banniereErreur = Object.values(erreurs).join(', ');
      const annee = today.year;
      return reply.redirect(`/fiscalite/qualification?annee=${annee}`);
    }

    // Lookup pour récupérer l'annee de redirection (avant le call use case)
    const justificatif = await justificatifRepo.trouverParId(id as JustificatifId);
    if (!justificatif) {
      return reply.code(404).send('Justificatif introuvable.');
    }

    const annee = (justificatif.datePaiement ?? justificatif.dateDocument).year;

    try {
      // Retrofit D-FIS-G2.5 Plan 06 : use case qualifierJustificatif avec figée check
      await qualifierJustificatif(
        { justificatifId: id as JustificatifId, qualification: parse.data.qualification as QualificationFiscale },
        { justificatifRepo, declRepo, bailleurRepo },
        clock,
      );
      const label = LABELS_QUALIFICATION[parse.data.qualification as QualificationFiscale];
      req.session.banniereSuccess = `"${justificatif.titre}" qualifié en ${label}`;
    } catch (err) {
      req.log.warn({ err, id }, 'Erreur qualification justificatif');
      if (err instanceof DeclarationFigeeException) {
        req.session.banniereErreur = `Cet exercice est déjà clôturé. Pour corriger, créez une déclaration corrigée.`;
      } else {
        req.session.banniereErreur = err instanceof Error ? err.message : 'Erreur interne';
      }
    }

    return reply.redirect(`/fiscalite/qualification?annee=${annee}`);
  });

  // POST /fiscalite/qualification/ticket/:id
  app.post('/fiscalite/qualification/ticket/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const today = clock.aujourdhui();

    const parse = qualifierTicketSchema.safeParse(body);
    if (!parse.success) {
      const erreurs = extraireErreurs(parse.error.issues);
      req.session.banniereErreur = Object.values(erreurs).join(', ');
      return reply.redirect(`/fiscalite/qualification?annee=${today.year}`);
    }

    try {
      await qualifierTicketTravaux(
        { ticketId: id as TicketTravauxId, natureFiscale: parse.data.natureFiscale as QualificationFiscale },
        { ticketRepo, justificatifRepo: justificatifRepo as never, bailleurRepo, declRepo },
        clock,
        db,
      );
      const label = LABELS_QUALIFICATION[parse.data.natureFiscale as QualificationFiscale];
      req.session.banniereSuccess = `Ticket qualifié en ${label} avec tous ses justificatifs`;
    } catch (err) {
      req.log.warn({ err, id }, 'Erreur qualification ticket');
      if (err instanceof DeclarationFigeeException) {
        req.session.banniereErreur = `Cet exercice est déjà clôturé. Pour corriger, créez une déclaration corrigée.`;
      } else {
        req.session.banniereErreur = err instanceof Error ? err.message : 'Erreur interne';
      }
    }

    return reply.redirect(`/fiscalite/qualification?annee=${today.year}`);
  });

  // POST /fiscalite/qualification/decomposer/:id
  app.post('/fiscalite/qualification/decomposer/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const rawBody = req.body as Record<string, unknown>;
    const today = clock.aujourdhui();

    // fast-querystring ne parse pas le bracket-dot notation imbriqué (enfants[0].bienId).
    // On normalise le body plat en { enfants: [...] } avant validation Zod.
    const enfantsRaw = normaliserEnfantsFormBody(rawBody);
    const body = enfantsRaw.length > 0 ? { enfants: enfantsRaw } : rawBody;

    const parse = decomposerJustificatifSchema.safeParse(body);
    if (!parse.success) {
      const erreurs = extraireErreurs(parse.error.issues);
      req.session.banniereErreur = Object.values(erreurs).join(', ');
      return reply.redirect(`/fiscalite/qualification?annee=${today.year}`);
    }

    try {
      const enfants = parse.data.enfants.map((e) => ({
        bienId: e.bienId as BienId,
        montantTtc: Money.fromCentimes(BigInt(Math.round(e.montantTtcEuros * 100))),
        titre: e.titre,
      }));

      await decomposerJustificatif(
        { parentId: id as JustificatifId, enfants },
        { justificatifRepo: justificatifRepo as never },
        clock,
        db,
      );
      req.session.banniereSuccess = 'Justificatif décomposé en ' + enfants.length + ' parties';
    } catch (err) {
      req.log.warn({ err, id }, 'Erreur décomposition justificatif');
      if (err instanceof ComposantsSommeIncoherente) {
        req.session.banniereErreur = `La somme des parties (${err.obtenu.enEuros()}) ne correspond pas au montant total (${err.attendu.enEuros()})`;
      } else {
        req.session.banniereErreur = err instanceof Error ? err.message : 'Erreur interne';
      }
    }

    const justificatif = await justificatifRepo.trouverParId(id as JustificatifId);
    const annee = justificatif ? (justificatif.datePaiement ?? justificatif.dateDocument).year : today.year;
    return reply.redirect(`/fiscalite/qualification?annee=${annee}`);
  });
}
