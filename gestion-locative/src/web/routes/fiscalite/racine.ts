/**
 * Route racine fiscalité — GET /fiscalite.
 *
 * Plan 08 : remplace le placeholder minimal Plan 06 par reply.view('pages/fiscalite/index').
 * La vue index.ejs (ownership locked Plan 08) est maintenant créée.
 *
 * Logique :
 *   - Bailleur singleton (fallback si absent : page de configuration)
 *   - D-FIS-G5.4 : traçage premier accès fiscalité (fiscalitePremierAcces)
 *   - Verdict LMP courant (null si pas de recettes ou erreur)
 *   - Compteur justificatifs non qualifiés pour l'année courante
 *   - Liste des déclarations clôturées
 *
 * Sources :
 *   D-FIS-G5.4 — traçage premier accès fiscalité
 *   D-FIS-G3.3 — bandeau verdict tri-état (S7)
 *   D-FIS-G2.1 — compteur justificatifs à qualifier (S2)
 *   Plan 08 — index.ejs full UI (ownership confirmé)
 */

import type { FastifyInstance } from 'fastify';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { DeclarationAnnuelleRepository } from '../../../domain/fiscalite/declaration-annuelle-repository.js';
import type { JustificatifRepository } from '../../../domain/documents/justificatif-repository.js';
import type { RecettesRepository } from '../../../domain/fiscalite/recettes-repository.js';
import type { RegleFiscaleProvider } from '../../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import type { VerdictLmp } from '../../../domain/fiscalite/verdict-lmp.js';
import { Temporal } from '@js-temporal/polyfill';
import { detecterBasculeLmp } from '../../../application/fiscalite/detecter-bascule-lmp.js';

export interface RacineRouteDeps {
  bailleurRepo: BailleurRepository;
  declRepo: DeclarationAnnuelleRepository;
  justificatifRepo: JustificatifRepository;
  recettesRepo: RecettesRepository;
  regleFiscale: RegleFiscaleProvider;
  clock: Clock;
}

export async function registerFiscaliteRacineRoute(
  app: FastifyInstance,
  deps: RacineRouteDeps,
): Promise<void> {
  const { bailleurRepo, declRepo, justificatifRepo, recettesRepo, regleFiscale, clock } = deps;

  app.get('/fiscalite', async (req, reply) => {
    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) {
      return reply.type('text/html').send(
        `<!doctype html><html lang=fr><head><meta charset=utf-8><title>Fiscalité LMNP</title></head>
         <body><h1>Fiscalité LMNP</h1><p>Bailleur non configuré.</p></body></html>`,
      );
    }

    // D-FIS-G5.4 : traçage premier accès fiscalité
    const afficherOnboardingBanner = !bailleur.fiscalitePremierAcces;
    if (!bailleur.fiscalitePremierAcces) {
      const bailleurMaj = bailleur.modifier({
        fiscalitePremierAcces: Temporal.PlainDateTime.from(
          clock.aujourdhui().toString() + 'T00:00:00',
        ),
      });
      await bailleurRepo.enregistrer(bailleurMaj);
    }

    const anneeCourante = clock.aujourdhui().year;
    const declarations = await declRepo.listerParBailleur(bailleur.id);

    // Verdict LMP courant (D-FIS-G3.3) — basé sur les recettes de l'année courante
    let verdictLmp: VerdictLmp | null = null;
    try {
      const recettes = await recettesRepo.sommeRecettesAnnuelles(bailleur.id, anneeCourante);
      const regles = regleFiscale.pour(anneeCourante);
      verdictLmp = detecterBasculeLmp(
        { recettes, revenusFoyer: bailleur.revenusActifsAnnuelsCourant ?? null },
        regles,
      );
    } catch {
      // Silencieux — verdictLmp reste null (pas de recettes pour l'année courante)
    }

    // Compteur justificatifs non qualifiés (D-FIS-G2.1 — S2)
    const compteurNonQualifies = await justificatifRepo.compterNonQualifiesPourAnnee(
      anneeCourante,
    );

    return reply.view('pages/fiscalite/index', {
      bailleur,
      declarations,
      anneeCourante,
      verdictLmp,
      compteurNonQualifies,
      afficherOnboardingBanner,
    });
  });
}
