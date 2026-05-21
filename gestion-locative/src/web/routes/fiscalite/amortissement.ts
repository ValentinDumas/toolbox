/**
 * Route GET /biens/:bienId/fiscalite/amortissement?annee={N}
 *
 * Affiche le tableau d'amortissement lecture-seule pour un bien et une année donnés (S4).
 * Utilise le use case recalculerTableauAmortissement (pré-affichage avant clôture).
 *
 * Sécurité :
 *   T-05-04-01 : calcul pur — mêmes inputs → mêmes outputs (cohérence sans état)
 *   T-05-04-03 : recalcul NE PERSISTE PAS — lecture-seule avant clôture
 *
 * Sources juridiques :
 *   CGI art. 39 B : ARD reportable sans limite (bandeau pédagogique S4)
 *   D-FIS-G1.7 : pré-affichage lecture-seule
 *   UI-SPEC §S4 L130-136 : tableau d'amortissement
 *
 * Pattern : analog src/web/routes/fiscalite/composants.ts (registerFiscaliteComposantsRoutes)
 */

import type { FastifyInstance } from 'fastify';
import type { BienId, BailleurId } from '../../../domain/_shared/identifiants.js';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type { ComposantRepository, ValorisationFiscaleRepository } from '../../../domain/fiscalite/composant-repository.js';
import type { RecettesRepository } from '../../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../../domain/fiscalite/charges-repository.js';
import type { TableauAmortissementRepository } from '../../../domain/fiscalite/tableau-amortissement-repository.js';
import type { RegleFiscaleProvider } from '../../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { BailleurRepository } from '../../../domain/identite/bailleur-repository.js';
import type { Clock } from '../../../domain/_shared/clock.js';
import { recalculerTableauAmortissement } from '../../../application/fiscalite/recalculer-tableau-amortissement.js';

/** Labels français des types de composant BOFIP (pour affichage S4) */
const LABELS_COMPOSANT: Record<string, string> = {
  terrain: 'Terrain',
  gros_oeuvre: 'Gros-oeuvre',
  toiture_facade: 'Toiture et façade',
  installations_techniques: 'Installations techniques',
  agencements_interieurs: 'Agencements intérieurs',
  mobilier: 'Mobilier',
};

interface AmortissementDeps {
  bienRepo: BienRepository;
  bailleurRepo: BailleurRepository;
  composantRepo: ComposantRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  recettesRepo: RecettesRepository;
  chargesRepo: ChargesRepository;
  tableauAmortissementRepo: TableauAmortissementRepository;
  regleFiscale: RegleFiscaleProvider;
  clock: Clock;
}

/**
 * Enregistre la route GET /biens/:bienId/fiscalite/amortissement (S4).
 *
 * Query params :
 *   annee : entier 4 chiffres (défaut : année en cours)
 */
export async function registerFiscaliteAmortissementRoutes(
  app: FastifyInstance,
  deps: AmortissementDeps,
): Promise<void> {
  const {
    bienRepo,
    bailleurRepo,
    composantRepo,
    valorisationRepo,
    recettesRepo,
    chargesRepo,
    tableauAmortissementRepo,
    regleFiscale,
    clock,
  } = deps;

  /** GET /biens/:bienId/fiscalite/amortissement?annee={N} */
  app.get('/biens/:bienId/fiscalite/amortissement', async (req, reply) => {
    const { bienId } = req.params as { bienId: string };
    const query = req.query as { annee?: string };

    // Lookup bien — 404 si introuvable
    const bien = await bienRepo.trouverParId(bienId as BienId);
    if (!bien) {
      return reply.code(404).send("Ce bien n'existe pas ou a été supprimé.");
    }

    // Vérifier valorisation fiscale activée — redirect si absent
    const vf = await valorisationRepo.trouverParBien(bienId as BienId);
    if (!vf) {
      return reply.redirect(`/biens/${bienId}/fiscalite/activer`);
    }

    // Exercice fiscal — défaut année en cours
    const anneeStr = query.annee;
    const exercice = anneeStr ? parseInt(anneeStr, 10) : clock.aujourdhui().year;
    if (isNaN(exercice) || exercice < 2020 || exercice > 2100) {
      return reply.code(400).send('Année invalide');
    }

    // Lookup bailleur singleton (D-LOCK-2)
    const bailleur = await bailleurRepo.trouver();
    if (!bailleur) {
      return reply.code(500).send('Bailleur non configuré');
    }

    // Calcul tableau d'amortissement (lecture-seule — T-05-04-03)
    let tableau;
    try {
      tableau = await recalculerTableauAmortissement(
        bienId as BienId,
        bailleur.id as BailleurId,
        exercice,
        {
          composantRepo,
          recettesRepo,
          chargesRepo,
          tableauAmortissementRepo,
        },
        regleFiscale,
        clock,
      );
    } catch {
      // En cas d'erreur de règle fiscale (année hors plage) — page vide
      tableau = null;
    }

    const breadcrumbs = [
      { label: 'Biens', href: '/biens' },
      { label: bien.adresse.enLigne(), href: `/biens/${bienId}` },
      { label: 'Fiscalité', href: `/biens/${bienId}/fiscalite/activer` },
      { label: `Amortissement ${exercice}` },
    ];

    return reply.view('pages/fiscalite/tableau-amortissement.ejs', {
      bien,
      exercice,
      tableau,
      labelsComposant: LABELS_COMPOSANT,
      navActive: 'fiscalite',
      breadcrumbs,
      banniereSuccess: req.session.banniereSuccess ?? null,
    });
  });
}
