/**
 * Routes fiscalité — revenus du foyer (D-FIS-G3.1).
 *
 * GET /fiscalite/revenus-foyer        — Formulaire G3.1 saisie revenus foyer (pré-rempli)
 * POST /fiscalite/revenus-foyer       — Enregistrer + redirect + bannière succès
 * GET /fiscalite/verdict?annee={N}    — Pré-affichage verdict tri-état LMNP/LMP (debug/dev)
 *
 * Sécurité :
 *   T-05-05-01 : CSRF — preHandler app.csrfProtection (pattern Phase 2)
 *   T-05-05-07 : Lien externe annuaire EC → rel="noopener noreferrer" (dans partial)
 *
 * Sources :
 *   D-FIS-G3.1 — pré-remplissage depuis Bailleur.revenusActifsAnnuelsCourant
 *   D-FIS-G3.3 — verdict tri-état pré-affichage
 *   D-FIS-G3.4 — anti-sticky : verdict calculé par exercice, pas mémorisé
 *   BOFIP-BIC-CHAMP-40-20 — périmètre revenus actifs foyer (tooltip G3.2)
 *   CGI art. 155 IV — critères LMP
 */

import type { FastifyInstance } from 'fastify';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { RecettesRepository } from '../../../domain/fiscalite/recettes-repository.js';
import type { RegleFiscaleProvider } from '../../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { BailleurId } from '../../../domain/_shared/identifiants.js';
import { saisirRevenusFoyer } from '../../../application/fiscalite/saisir-revenus-foyer.js';
import { detecterBasculeLmp } from '../../../application/fiscalite/detecter-bascule-lmp.js';
import { saisirRevenusFoyerSchema } from '../../schemas/fiscalite-schemas.js';
import { BailleurAbsent } from '../../../domain/identite/erreurs.js';

interface RevenusFoyerDeps {
  bailleurRepo: BailleurRepository;
  recettesRepo: RecettesRepository;
  regleFiscale: RegleFiscaleProvider;
  clock: Clock;
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

/**
 * Enregistre les routes GET/POST /fiscalite/revenus-foyer + GET /fiscalite/verdict.
 */
export async function registerFiscaliteRevenusFoyerRoutes(
  app: FastifyInstance,
  opts: RevenusFoyerDeps,
): Promise<void> {

  // ── GET /fiscalite/revenus-foyer ──────────────────────────────────────────
  // Formulaire G3.1 pré-rempli depuis Bailleur.revenusActifsAnnuelsCourant
  app.get('/fiscalite/revenus-foyer', async (req, reply) => {
    const bailleur = await opts.bailleurRepo.trouver();

    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    const annee = opts.clock.aujourdhui().year;

    return reply.view('pages/fiscalite/revenus-foyer.ejs', {
      bailleur,
      annee,
      navActive: 'fiscalite',
      erreurs: {},
      valeurs: {},
      banniereSuccess,
    });
  });

  // ── POST /fiscalite/revenus-foyer ─────────────────────────────────────────
  // Enregistre les revenus foyer + redirect /fiscalite + bannière succès
  app.post('/fiscalite/revenus-foyer', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const parsed = saisirRevenusFoyerSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const bailleur = await opts.bailleurRepo.trouver();
      const annee = opts.clock.aujourdhui().year;
      return reply.view('pages/fiscalite/revenus-foyer.ejs', {
        bailleur,
        annee,
        navActive: 'fiscalite',
        erreurs,
        valeurs: body,
        banniereSuccess: null,
      });
    }

    try {
      await saisirRevenusFoyer(parsed.data, { bailleurRepo: opts.bailleurRepo }, opts.clock);
      req.session.banniereSuccess = 'Revenus du foyer enregistrés.';
      return reply.redirect('/fiscalite');
    } catch (err) {
      if (err instanceof BailleurAbsent) {
        return reply.redirect('/bailleur');
      }
      throw err;
    }
  });

  // ── GET /fiscalite/verdict?annee={N} ─────────────────────────────────────
  // Pré-affichage verdict tri-état (développeur / debug) sans clôture.
  // Plan 06 wirera ce verdict dans la page récap annuel via include partial.
  // D-FIS-G3.4 : verdict calculé à la volée sur données courantes (pas de snapshot).
  app.get('/fiscalite/verdict', async (req, reply) => {
    const query = req.query as Record<string, string>;
    const anneeParam = parseInt(query['annee'] ?? String(opts.clock.aujourdhui().year), 10);
    const annee = Number.isFinite(anneeParam) ? anneeParam : opts.clock.aujourdhui().year;

    const bailleur = await opts.bailleurRepo.trouver();
    if (!bailleur) {
      return reply.redirect('/bailleur');
    }

    // Recettes annuelles pour l'exercice demandé
    // bailleurId : singleton V1 (D-LOCK-2) — l'ID est ignoré en V1, present pour V1.1
    const recettes = await opts.recettesRepo.sommeRecettesAnnuelles(
      bailleur.id as BailleurId,
      annee,
    );

    const regles = opts.regleFiscale.pour(annee);
    const statut = detecterBasculeLmp(
      { recettes, revenusFoyer: bailleur.revenusActifsAnnuelsCourant },
      regles,
    );

    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    return reply.view('pages/fiscalite/verdict-preview.ejs', {
      statut,
      annee,
      recettes,
      bailleur,
      navActive: 'fiscalite',
      banniereSuccess,
    });
  });
}
