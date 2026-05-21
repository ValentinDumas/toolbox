/**
 * Routes wizard S8 — Clôture exercice fiscal LMNP (Plan 06).
 *
 * Endpoints :
 *   GET  /fiscalite/cloturer/:exercice/etape/1  → Prérequis bloquants D-FIS-G4.1
 *   GET  /fiscalite/cloturer/:exercice/etape/2  → Revenus foyer D-FIS-G3.1
 *   GET  /fiscalite/cloturer/:exercice/etape/3  → Comparatif micro vs réel D-FIS-G4.3
 *   GET  /fiscalite/cloturer/:exercice/etape/4  → Confirmation finale
 *   GET  /fiscalite/cloturer/:exercice/etape/5  → Bouton soumission
 *   POST /fiscalite/cloturer/:exercice          → Clôture + redirect recap
 *   GET  /fiscalite/declarations/:id            → Récap annuel post-clôture
 *   GET  /fiscalite/declarations/:id/corriger   → Formulaire déclaration corrigée
 *   POST /fiscalite/declarations/:id/corriger   → Création déclaration corrigée
 *
 * Sécurité :
 *   T-05-06-01 : Double clôture → DeclarationDejaExiste → redirect recap existant
 *   T-05-06-06 : exercice borné Zod + motif max 2000 chars
 *   T-05-06-07 : transaction Kysely dans cloturerExercice use case
 *   T-05-06-08 : choisirRegime force réel si > seuil
 */

import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { DB } from '../../../infrastructure/db/kysely-types.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type { RecettesRepository } from '../../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../../domain/fiscalite/charges-repository.js';
import type { ComposantRepository, ValorisationFiscaleRepository } from '../../../domain/fiscalite/composant-repository.js';
import type { TableauAmortissementRepository } from '../../../domain/fiscalite/tableau-amortissement-repository.js';
import type { JustificatifRepository } from '../../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../../domain/travaux/ticket-travaux-repository.js';
import type { DeclarationAnnuelleRepository, DeclarationCorrigeeRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { RegleFiscaleProvider } from '../../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { DeclarationAnnuelleId } from '../../../domain/_shared/identifiants.js';
import { cloturerExercice, DeclarationDejaExiste } from '../../../application/fiscalite/cloturer-exercice.js';
import { collecterPrerequisCloture } from '../../../application/fiscalite/collecter-prerequis-cloture.js';
import { creerDeclarationCorrigee, DeclarationOriginaleAbsente } from '../../../application/fiscalite/creer-declaration-corrigee.js';
import { calculerMicroBic } from '../../../application/fiscalite/calculer-micro-bic.js';
import { PrerequisCloturalNonSatisfaits } from '../../../domain/fiscalite/erreurs.js';
import {
  cloturerExerciceSchema,
  creerDeclarationCorrigeeSchema,
} from '../../schemas/fiscalite-schemas.js';

const LABELS_VERDICT: Record<string, string> = {
  lmnp_confirme: 'LMNP confirmé',
  lmp_probable: 'LMP probable',
  indetermine_revenus_foyer_manquants: 'Indéterminé (revenus foyer manquants)',
};

export interface ClotureRouteDeps {
  bailleurRepo: BailleurRepository;
  bienRepo: BienRepository;
  recettesRepo: RecettesRepository;
  chargesRepo: ChargesRepository;
  composantRepo: ComposantRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  tableauAmortRepo: TableauAmortissementRepository;
  justificatifRepo: JustificatifRepository;
  ticketRepo: TicketTravauxRepository;
  declRepo: DeclarationAnnuelleRepository;
  declCorrRepo: DeclarationCorrigeeRepository;
  regleFiscale: RegleFiscaleProvider;
  clock: Clock;
  db: Kysely<DB>;
}

export async function registerFiscaliteClotureRoutes(
  app: FastifyInstance,
  deps: ClotureRouteDeps,
): Promise<void> {
  const {
    bailleurRepo,
    bienRepo,
    recettesRepo,
    chargesRepo,
    composantRepo,
    valorisationRepo,
    tableauAmortRepo,
    justificatifRepo,
    ticketRepo,
    declRepo,
    declCorrRepo,
    regleFiscale,
    clock,
    db,
  } = deps;

  // ── Étape 1 : Prérequis ────────────────────────────────────────────────────────
  app.get('/fiscalite/cloturer/:exercice/etape/1', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice) || exercice < 2020 || exercice > 2100) {
      return reply.code(400).send('Exercice invalide.');
    }

    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) return reply.code(404).send('Bailleur introuvable.');

    const prerequis = await collecterPrerequisCloture(
      bailleur.id,
      exercice,
      {
        bailleurRepo,
        justificatifRepo,
        ticketRepo,
        valorisationRepo,
        bienRepo,
        recettesRepo,
      },
      regleFiscale,
    );

    const banniereErreur = req.session.banniereErreur ?? null;
    if (banniereErreur) req.session.banniereErreur = undefined;

    return reply.view('pages/fiscalite/wizard-cloture/etape-1.ejs', {
      exercice,
      prerequis,
      ctaSuivantDisabled: prerequis.bloquants.length > 0,
      navActive: 'fiscalite',
      banniereErreur,
    });
  });

  // ── Étape 2 : Revenus foyer ────────────────────────────────────────────────────
  app.get('/fiscalite/cloturer/:exercice/etape/2', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice)) return reply.code(400).send('Exercice invalide.');

    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) return reply.code(404).send('Bailleur introuvable.');

    return reply.view('pages/fiscalite/wizard-cloture/etape-2.ejs', {
      exercice,
      revenusActifsCourant: bailleur.revenusActifsAnnuelsCourant,
      lienModifier: '/fiscalite/revenus-foyer',
      navActive: 'fiscalite',
    });
  });

  // ── Étape 3 : Comparatif micro vs réel ────────────────────────────────────────
  app.get('/fiscalite/cloturer/:exercice/etape/3', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice)) return reply.code(400).send('Exercice invalide.');

    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) return reply.code(404).send('Bailleur introuvable.');

    const regles = regleFiscale.pour(exercice);
    const recettes = await recettesRepo.sommeRecettesAnnuelles(bailleur.id, exercice);
    const chargesParCategorie = await chargesRepo.sommeChargesParCategorie(bailleur.id, exercice);
    const micro = calculerMicroBic(recettes, regles);
    const regimeForce = recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE) ? 'reel' : null;

    // Dotation sommaire non calculée à l'étape 3 (nécessite recalculerTableauAmortissement
    // avec 6 arguments — délégué à l'étape de clôture effective). Comparatif s'affiche sans.
    const dotationEstimee: number | null = null;

    return reply.view('pages/fiscalite/wizard-cloture/etape-3.ejs', {
      exercice,
      recettes,
      chargesParCategorie,
      micro,
      dotationEstimee,
      regimeForce,
      regles,
      navActive: 'fiscalite',
    });
  });

  // ── Étape 4 : Confirmation ─────────────────────────────────────────────────────
  app.get('/fiscalite/cloturer/:exercice/etape/4', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice)) return reply.code(400).send('Exercice invalide.');

    const query = req.query as { regimeChoisi?: string };
    const regimeChoisi = query.regimeChoisi;

    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) return reply.code(404).send('Bailleur introuvable.');

    const regles = regleFiscale.pour(exercice);
    const recettes = await recettesRepo.sommeRecettesAnnuelles(bailleur.id, exercice);
    const regimeForce = recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE) ? 'reel' : null;
    const regimeFinal = regimeForce ?? regimeChoisi ?? 'micro_bic';

    return reply.view('pages/fiscalite/wizard-cloture/etape-4.ejs', {
      exercice,
      recettes,
      regimeChoisi,
      regimeForce,
      regimeFinal,
      navActive: 'fiscalite',
    });
  });

  // ── Étape 5 : Bouton soumission ────────────────────────────────────────────────
  app.get('/fiscalite/cloturer/:exercice/etape/5', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice)) return reply.code(400).send('Exercice invalide.');

    const query = req.query as { regimeChoisi?: string };
    const regimeChoisi = query.regimeChoisi;

    return reply.view('pages/fiscalite/wizard-cloture/etape-5.ejs', {
      exercice,
      regimeChoisi,
      navActive: 'fiscalite',
    });
  });

  // ── POST /fiscalite/cloturer/:exercice (soumission finale) ────────────────────
  app.post('/fiscalite/cloturer/:exercice', async (req, reply) => {
    const { exercice: exerciceStr } = req.params as { exercice: string };
    const exercice = parseInt(exerciceStr, 10);
    if (isNaN(exercice) || exercice < 2020 || exercice > 2100) {
      return reply.code(400).send('Exercice invalide.');
    }

    const body = req.body as Record<string, unknown>;
    const parse = cloturerExerciceSchema.safeParse(body);
    if (!parse.success) {
      req.session.banniereErreur = 'Données invalides.';
      return reply.redirect(`/fiscalite/cloturer/${exercice}/etape/1`);
    }

    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) return reply.code(404).send('Bailleur introuvable.');

    try {
      const resultat = await cloturerExercice(
        {
          bailleurId: bailleur.id,
          exercice,
          regimeChoisi: parse.data.regimeChoisi,
        },
        {
          bailleurRepo,
          recettesRepo,
          chargesRepo,
          composantRepo,
          valorisationRepo,
          declRepo,
          tableauAmortRepo,
          justificatifRepo,
          ticketRepo,
          bienRepo,
        },
        clock,
        regleFiscale,
        db,
      );

      const label = LABELS_VERDICT[resultat.verdictLmp] ?? resultat.verdictLmp;
      req.session.banniereSuccess = `Exercice ${exercice} clôturé. Verdict : ${label}.`;
      return reply.redirect(`/fiscalite/declarations/${resultat.declarationId}`);
    } catch (err) {
      if (err instanceof PrerequisCloturalNonSatisfaits) {
        req.session.banniereErreur = `Prérequis non satisfaits : ${err.bloquants.join(', ')}`;
        return reply.redirect(`/fiscalite/cloturer/${exercice}/etape/1`);
      }
      if (err instanceof DeclarationDejaExiste) {
        // Déclaration existante — redirect vers le récap existant
        const declExistante = await declRepo.trouverParBailleurExercice(bailleur.id, exercice);
        if (declExistante) {
          return reply.redirect(`/fiscalite/declarations/${declExistante.id}`);
        }
        return reply.code(409).send(`Exercice ${exercice} déjà clôturé.`);
      }
      req.log.error({ err }, 'Erreur clôture exercice');
      req.session.banniereErreur = err instanceof Error ? err.message : 'Erreur interne';
      return reply.redirect(`/fiscalite/cloturer/${exercice}/etape/1`);
    }
  });

  // ── GET /fiscalite/declarations/:id — récap post-clôture ──────────────────────
  app.get('/fiscalite/declarations/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const declaration = await declRepo.trouverParId(id as DeclarationAnnuelleId);
    if (!declaration) {
      return reply.code(404).send('Déclaration introuvable.');
    }

    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    return reply.view('pages/fiscalite/recap-annuel.ejs', {
      declaration,
      navActive: 'fiscalite',
      banniereSuccess,
      breadcrumbs: [
        { url: '/fiscalite', label: 'Fiscalité' },
        { label: `Exercice ${declaration.exercice}` },
      ],
    });
  });

  // ── GET /fiscalite/declarations/:id/corriger — formulaire correction ──────────
  app.get('/fiscalite/declarations/:id/corriger', async (req, reply) => {
    const { id } = req.params as { id: string };

    const declaration = await declRepo.trouverParId(id as DeclarationAnnuelleId);
    if (!declaration) {
      return reply.code(404).send('Déclaration originale introuvable.');
    }

    return reply.view('pages/fiscalite/declaration-corrigee.ejs', {
      declaration,
      navActive: 'fiscalite',
      breadcrumbs: [
        { url: '/fiscalite', label: 'Fiscalité' },
        { url: `/fiscalite/declarations/${id}`, label: `Exercice ${declaration.exercice}` },
        { label: 'Correction' },
      ],
    });
  });

  // ── POST /fiscalite/declarations/:id/corriger — créer correction ──────────────
  app.post('/fiscalite/declarations/:id/corriger', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const declaration = await declRepo.trouverParId(id as DeclarationAnnuelleId);
    if (!declaration) {
      return reply.code(404).send('Déclaration originale introuvable.');
    }

    const parse = creerDeclarationCorrigeeSchema.safeParse(body);
    if (!parse.success) {
      req.session.banniereErreur = parse.error.issues.map((i) => i.message).join(', ');
      return reply.redirect(`/fiscalite/declarations/${id}/corriger`);
    }

    try {
      await creerDeclarationCorrigee(
        {
          declarationOriginaleId: id as DeclarationAnnuelleId,
          motif: parse.data.motif,
          corrections: {
            recettesTotalesEuros: parse.data.recettesTotalesEuros,
            dotationAmortissementEuros: parse.data.dotationAmortissementEuros,
          },
        },
        { declRepo, declCorrRepo },
        db,
      );

      req.session.banniereSuccess = 'Déclaration corrigée créée. La déclaration originale reste intacte.';
      return reply.redirect(`/fiscalite/declarations/${id}`);
    } catch (err) {
      if (err instanceof DeclarationOriginaleAbsente) {
        return reply.code(404).send('Déclaration originale introuvable.');
      }
      req.log.error({ err }, 'Erreur création déclaration corrigée');
      req.session.banniereErreur = err instanceof Error ? err.message : 'Erreur interne';
      return reply.redirect(`/fiscalite/declarations/${id}/corriger`);
    }
  });
}
