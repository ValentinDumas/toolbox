/**
 * Use case : Vue consolidée multi-bien LMNP (D-FIS-G5.1, D-LOCK-2).
 *
 * Agrège recettes + charges + dotations par bien, avec seuils appliqués
 * sur le TOTAL CONSOLIDÉ (D-LOCK-2 — seuils LMP et micro-BIC appréciés globalement).
 *
 * Flux :
 *   (1) lookup bailleur via bailleurRepo.trouver()
 *   (2) listerTous les biens via bienRepo.listerTous()
 *   (3) Pour chaque bien :
 *       - recettesBien via recettesRepo.sommeRecettesAnnuellesParBien (NOUVELLE méthode D-FIS-G5.1)
 *       - chargesBien via chargesRepo.sommeChargesParBien (NOUVELLE méthode D-FIS-G5.1)
 *       - composantsBien via composantRepo.listerActifsParBien
 *       - dotationBien via calculerAmortissement local (si valorisation fiscale active)
 *       - resultatFiscalBien = max(0, recettes − charges − dotation)
 *       - régimeBien = recettesBien > SEUIL_MICRO ? 'reel' : 'micro_bic'
 *   (4) totaux consolidés : Σ par bien
 *   (5) regimeApplique consolidé sur total (D-LOCK-2)
 *   (6) verdictLmp sur total recettes consolidé (CGI art. 155 IV)
 *
 * Sources juridiques :
 *   - D-FIS-G5.1 : vue consolidée + ventilation RÉELLE par bien
 *   - D-LOCK-2 : seuils LMP et micro-BIC appréciés sur le total consolidé
 *   - CGI art. 155 IV : bascule LMP (critères a+b sur total)
 *   - CGI art. 50-0 : seuil micro-BIC longue durée (83 600 € 2026-2028)
 *   - CGI art. 39 : plafond résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite
 *
 * Anti-patterns :
 *   - JAMAIS d'import technique (ORM, HTTP, fichier) dans ce fichier (hexagonal pur)
 *   - JAMAIS de float pour les montants (Money BigInt centimes)
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { BailleurId, BienId } from '../../domain/_shared/identifiants.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../domain/fiscalite/charges-repository.js';
import type { ComposantRepository, ValorisationFiscaleRepository } from '../../domain/fiscalite/composant-repository.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { RegleFiscale2026 } from '../../domain/fiscalite/regles/regles-2026.js';
import type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';
import { Money } from '../../domain/_shared/money.js';
import { calculerAmortissement } from './calculer-amortissement.js';
import { detecterBasculeLmp } from './detecter-bascule-lmp.js';

/** Vue fiscale agrégée pour un bien — ventilation RÉELLE (D-FIS-G5.1). */
export interface VueBien {
  bienId: BienId;
  adresse: string;
  recettes: Money;
  charges: Money;
  dotation: Money;
  resultatFiscal: Money;
  regime: 'micro_bic' | 'reel';
}

/** Vue consolidée multi-bien bailleur — retour de listerVueConsolidee. */
export interface VueConsolideeBailleur {
  biens: VueBien[];
  totaux: {
    recettes: Money;
    charges: Money;
    dotation: Money;
    resultatFiscal: Money;
  };
  regimeApplique: 'micro_bic' | 'reel';
  verdictLmp: VerdictLmp;
  anneeCourante: number;
}

export interface ListerVueConsolideeDeps {
  bienRepo: BienRepository;
  recettesRepo: RecettesRepository;
  chargesRepo: ChargesRepository;
  composantRepo: ComposantRepository;
  valorisationRepo: ValorisationFiscaleRepository;
  tableauAmortRepo: TableauAmortissementRepository;
  bailleurRepo: BailleurRepository;
  regleFiscale: RegleFiscale2026;
}

interface ClockLike {
  aujourdhui(): Temporal.PlainDate;
}

/**
 * Vue consolidée multi-bien pour l'exercice donné (D-FIS-G5.1).
 *
 * @param bailleurId - identifiant du bailleur (V1 : singleton)
 * @param exercice - année fiscale (ex: 2026)
 * @param deps - dépendances injectées (hexagonal)
 * @param clock - horloge pour listerActifsParBien
 * @returns VueConsolideeBailleur avec ventilation RÉELLE par bien
 */
export async function listerVueConsolidee(
  bailleurId: BailleurId,
  exercice: number,
  deps: ListerVueConsolideeDeps,
  clock: ClockLike,
): Promise<VueConsolideeBailleur> {
  const {
    bienRepo,
    recettesRepo,
    chargesRepo,
    composantRepo,
    valorisationRepo,
    tableauAmortRepo,
    bailleurRepo,
    regleFiscale,
  } = deps;

  // (1) Lookup bailleur
  const bailleur = await bailleurRepo.trouver();
  const revenusFoyer = bailleur?.revenusActifsAnnuelsCourant ?? null;

  // (2) Liste tous les biens
  const biens = await bienRepo.listerTous();

  // (3) Ventilation par bien
  const vuesBiens: VueBien[] = await Promise.all(
    biens.map(async (bien) => {
      // Recettes par bien — NOUVELLE méthode D-FIS-G5.1
      const recettesBien = await recettesRepo.sommeRecettesAnnuellesParBien(bien.id, exercice);

      // Charges par bien — NOUVELLE méthode D-FIS-G5.1
      const chargesBien = await chargesRepo.sommeChargesParBien(bien.id, exercice);

      // Dotation amortissement par bien (si fiscalité réelle activée)
      let dotationBien = Money.zero();
      const valorisation = await valorisationRepo.trouverParBien(bien.id);
      if (valorisation !== null) {
        const composantsBien = await composantRepo.listerActifsParBien(bien.id, clock.aujourdhui());
        const ardCumuleEntree = await tableauAmortRepo.dernierArdCumule(bien.id, exercice - 1);
        const resultatAvantAmort = chargesBien.toCentimes() >= recettesBien.toCentimes()
          ? Money.zero()
          : recettesBien.soustraire(chargesBien);
        const tableau = calculerAmortissement(composantsBien, exercice, regleFiscale, {
          resultatAvantAmortissement: resultatAvantAmort,
          ardCumuleEnEntree: ardCumuleEntree,
        });
        dotationBien = tableau.dotationAppliqueeTotale;
      }

      // Résultat fiscal par bien = max(0, recettes - charges - dotation)
      let resultatFiscalBien = Money.zero();
      const netAvantDot = recettesBien.toCentimes() - chargesBien.toCentimes();
      if (netAvantDot > 0n) {
        const netCentimes = netAvantDot - dotationBien.toCentimes();
        if (netCentimes > 0n) {
          resultatFiscalBien = Money.fromCentimes(netCentimes);
        }
      }

      // CGI art. 50-0 : micro-BIC éligible si recettes STRICTEMENT INFÉRIEURES au seuil.
      // À seuil exact (83 600 €) → régime réel forcé (D-LOCK-2).
      const regimeBien = recettesBien.lt(regleFiscale.SEUIL_MICRO_BIC_LONGUE_DUREE)
        ? 'micro_bic'
        : 'reel';

      return {
        bienId: bien.id,
        adresse: bien.adresse.enLigne(),
        recettes: recettesBien,
        charges: chargesBien,
        dotation: dotationBien,
        resultatFiscal: resultatFiscalBien,
        regime: regimeBien,
      };
    }),
  );

  // (4) Totaux consolidés
  const recettesTotal = vuesBiens.reduce((acc, b) => acc.additionner(b.recettes), Money.zero());
  const chargesTotal = vuesBiens.reduce((acc, b) => acc.additionner(b.charges), Money.zero());
  const dotationTotal = vuesBiens.reduce((acc, b) => acc.additionner(b.dotation), Money.zero());

  let resultatFiscalTotal = Money.zero();
  const netTotalCentimes = recettesTotal.toCentimes() - chargesTotal.toCentimes() - dotationTotal.toCentimes();
  if (netTotalCentimes > 0n) {
    resultatFiscalTotal = Money.fromCentimes(netTotalCentimes);
  }

  // (5) Régime consolidé (D-LOCK-2 — seuil sur total)
  // CGI art. 50-0 : micro-BIC éligible si recettes STRICTEMENT INFÉRIEURES au seuil.
  // À seuil exact (83 600 €) → régime réel forcé (inclusif).
  const regimeApplique = recettesTotal.lt(regleFiscale.SEUIL_MICRO_BIC_LONGUE_DUREE)
    ? 'micro_bic'
    : 'reel';

  // (6) Verdict LMP sur total consolidé (CGI art. 155 IV)
  const verdictLmp = detecterBasculeLmp(
    { recettes: recettesTotal, revenusFoyer },
    regleFiscale,
  );

  return {
    biens: vuesBiens,
    totaux: {
      recettes: recettesTotal,
      charges: chargesTotal,
      dotation: dotationTotal,
      resultatFiscal: resultatFiscalTotal,
    },
    regimeApplique,
    verdictLmp,
    anneeCourante: exercice,
  };
}
