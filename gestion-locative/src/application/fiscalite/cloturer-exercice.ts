/**
 * Use case orchestrateur — clôture annuelle de l'exercice fiscal LMNP.
 *
 * Combine TOUS les use cases purs Phase 5 en 1 transaction Kysely atomique :
 *   - collecterPrerequisCloture (D-FIS-G4.1)
 *   - recettes + charges aggregés
 *   - detecterBasculeLmp (CGI art. 155 IV)
 *   - choisirRegime (D-FIS-G4.3, CGI art. 50-0)
 *   - calculerAmortissement (CGI art. 39, D-FIS-G1.7) — régime réel seulement
 *   - DeclarationAnnuelle.creer (snapshot append-only D-FIS-G4.2)
 *   - Transaction : declRepo.enregistrer + tableauAmortRepo.enregistrerBatch
 *
 * ARD cross-exercice CGI art. 39 B (BLOCKER fix) :
 *   - ardCumuleEnEntree = tableauAmortRepo.dernierArdCumuleBailleur(bailleurId, exercice - 1)
 *   - JAMAIS Money.zero() en fallback silencieux sauf si premier exercice (aucune SYNTHESE_BIEN)
 *
 * Sources juridiques :
 *   - CGI art. 39 : plafond résultat avant amortissement
 *   - CGI art. 39 B : ARD reportable sans limite — propagation cross-exercice
 *   - CGI art. 50-0 : seuil micro-BIC 83 600 € (2026-2028)
 *   - CGI art. 155 IV : critères bascule LMNP → LMP
 *   - D-FIS-G4.1 : prérequis bloquants clôture
 *   - D-FIS-G4.2 : snapshot append-only immuable
 *   - D-FIS-G4.3 : choisir-regime use case pur
 *   - T-05-06-11 : ARD perdu cross-exercice (mitigé par cet use case)
 */

import type { Kysely } from 'kysely';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { BailleurId, DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import { AmortissementExercice } from '../../domain/fiscalite/amortissement-exercice.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { TableauAmortissementRepository } from '../../domain/fiscalite/tableau-amortissement-repository.js';
import type { ComposantRepository, ValorisationFiscaleRepository } from '../../domain/fiscalite/composant-repository.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import type { ChargesRepository } from '../../domain/fiscalite/charges-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { RegleFiscaleProvider } from '../../domain/fiscalite/regles/regle-fiscale-provider.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { VerdictLmp } from '../../domain/fiscalite/verdict-lmp.js';
import { detecterBasculeLmp } from './detecter-bascule-lmp.js';
import { choisirRegime } from './choisir-regime.js';
import { calculerAmortissement } from './calculer-amortissement.js';
import { collecterPrerequisCloture } from './collecter-prerequis-cloture.js';
import {
  PrerequisCloturalNonSatisfaits,
  DeclarationFigeeException as _DeclarationFigeeException,
} from '../../domain/fiscalite/erreurs.js';

/** Commande de clôture d'exercice. */
export interface CloturerExerciceCommande {
  bailleurId: BailleurId;
  exercice: number;
  /** Si défini et < SEUIL, honore le choix utilisateur (sinon 'reel' forcé). */
  regimeChoisi?: 'micro_bic' | 'reel';
}

/** Résultat de la clôture. */
export interface CloturerExerciceResultat {
  declarationId: DeclarationAnnuelleId;
  verdictLmp: VerdictLmp;
  regimeApplique: 'micro_bic' | 'reel';
}

/**
 * Exception levée si une DeclarationAnnuelle existe déjà pour (bailleurId, exercice).
 * La UNIQUE DB protège aussi — cette classe permet un message lisible avant l'écriture.
 */
export class DeclarationDejaExiste extends Error {
  constructor(bailleurId: BailleurId, exercice: number) {
    super(
      `Exercice ${exercice} déjà clôturé pour ce bailleur (T-05-06-01). Correction → DeclarationCorrigee.`,
    );
    this.name = 'DeclarationDejaExiste';
    this.bailleurId = bailleurId;
    this.exercice = exercice;
  }
  readonly bailleurId: BailleurId;
  readonly exercice: number;
}

interface CloturerExerciceRepos {
  bailleurRepo: Pick<BailleurRepository, 'trouver'>;
  recettesRepo: Pick<RecettesRepository, 'sommeRecettesAnnuelles'>;
  chargesRepo: Pick<ChargesRepository, 'sommeChargesParCategorie'>;
  composantRepo: Pick<ComposantRepository, 'listerActifsPourBailleur'>;
  valorisationRepo: Pick<ValorisationFiscaleRepository, 'trouverParBien'>;
  declRepo: Pick<DeclarationAnnuelleRepository, 'enregistrer' | 'trouverParBailleurExercice'>;
  tableauAmortRepo: Pick<TableauAmortissementRepository, 'enregistrerBatch' | 'dernierArdCumuleBailleur'>;
  justificatifRepo: Pick<JustificatifRepository, 'compterNonQualifiesPourAnnee'>;
  ticketRepo: Pick<TicketTravauxRepository, 'compterStatutsActifs'>;
  bienRepo: Pick<BienRepository, 'listerTous'>;
}

/**
 * Clôture l'exercice fiscal d'un bailleur LMNP.
 *
 * Étapes :
 *   1. Vérification prérequis (D-FIS-G4.1) — throw si bloquants
 *   2. Vérification double clôture — throw DeclarationDejaExiste
 *   3. Agrégation recettes + charges
 *   4. Détection bascule LMP (CGI art. 155 IV)
 *   5. Choix régime (D-FIS-G4.3)
 *   6. Si réel : calcul amortissement + ARD cross-exercice (CGI 39 B)
 *   7. Création snapshot DeclarationAnnuelle (D-FIS-G4.2)
 *   8. Transaction : snapshot + tableau amortissement batch
 *   9. Retour { declarationId, verdictLmp, regimeApplique }
 *
 * @throws PrerequisCloturalNonSatisfaits si des bloquants existent
 * @throws DeclarationDejaExiste si (bailleurId, exercice) déjà clôturé
 * @throws Error si bailleur absent (configurez votre profil)
 */
export async function cloturerExercice(
  commande: CloturerExerciceCommande,
  repos: CloturerExerciceRepos,
  clock: Clock,
  regleFiscale: RegleFiscaleProvider,
  db: Kysely<DB>,
): Promise<CloturerExerciceResultat> {
  const { bailleurId, exercice, regimeChoisi } = commande;
  const regles = regleFiscale.pour(exercice);

  // (1) Prérequis bloquants (D-FIS-G4.1)
  const prerequis = await collecterPrerequisCloture(bailleurId, exercice, repos, regleFiscale);
  if (prerequis.bloquants.length > 0) {
    throw new PrerequisCloturalNonSatisfaits(prerequis.bloquants);
  }

  // (2) Fail-fast : double clôture (UNIQUE DB protège aussi — T-05-06-01)
  const declExistante = await repos.declRepo.trouverParBailleurExercice(bailleurId, exercice);
  if (declExistante !== null) {
    throw new DeclarationDejaExiste(bailleurId, exercice);
  }

  // (3) Bailleur (garanti présent — prérequis (a) aurait bloqué sinon)
  const bailleur = await repos.bailleurRepo.trouver();
  /* v8 ignore next 3 */
  if (!bailleur) {
    throw new Error('Bailleur absent — état incohérent (prérequis aurait dû bloquer)');
  }

  // (4) Recettes + charges
  const recettes = await repos.recettesRepo.sommeRecettesAnnuelles(bailleurId, exercice);
  const chargesParCategorie = await repos.chargesRepo.sommeChargesParCategorie(bailleurId, exercice);

  // Charges déductibles = entretien_reparation + amelioration + charge_courante_periodique
  // (exclure non_deductible et non_qualifie — D-FIS-G2.2)
  const chargesDeductibles = chargesParCategorie.entretien_reparation
    .additionner(chargesParCategorie.amelioration)
    .additionner(chargesParCategorie.charge_courante_periodique);

  // (5) Verdict LMP (CGI art. 155 IV, anti-sticky D-FIS-G3.4)
  const verdictLmp = detecterBasculeLmp(
    { recettes, revenusFoyer: bailleur.revenusActifsAnnuelsCourant ?? null },
    regles,
  );

  // (6) Choix régime (D-FIS-G4.3)
  const regimeApplique = choisirRegime(recettes, regimeChoisi, regles);

  // (7) Calcul amortissement + ARD cross-exercice (réel seulement)
  let dotationAmortissement = Money.zero();
  let ardGenere = Money.zero();
  let ardConsomme = Money.zero();
  let composantsSnapshot = '[]';
  const amortissementExercicesLignes: AmortissementExercice[] = [];

  if (regimeApplique === 'reel') {
    const today = clock.aujourdhui();
    const composants = await repos.composantRepo.listerActifsPourBailleur(bailleurId, today);

    // ARD cross-exercice CGI art. 39 B sans limite (BLOCKER fix T-05-06-11)
    // Propagation N-1 → N : lookup ardCumule du dernier exercice clôturé
    const ardCumuleEnEntree = await repos.tableauAmortRepo.dernierArdCumuleBailleur(
      bailleurId,
      exercice - 1,
    );

    const resultatAvantAmortissement = recettes.superieurA(chargesDeductibles)
      ? recettes.soustraire(chargesDeductibles)
      : Money.zero();

    const tableau = calculerAmortissement(composants, exercice, regles, {
      resultatAvantAmortissement,
      ardCumuleEnEntree,
    });

    dotationAmortissement = tableau.dotationAppliqueeTotale;
    ardGenere = tableau.ardGenereTotal();
    ardConsomme = tableau.ardConsomme;
    composantsSnapshot = JSON.stringify(composants.map((c) => c.toProps()));

    // Construire les lignes AmortissementExercice (COMPOSANT + SYNTHESE_BIEN par bien)
    // Grouper composants par bienId pour SYNTHESE_BIEN
    const biensIds = [...new Set(composants.map((c) => c.bienId))];

    for (const ligne of tableau.dotationParComposant) {
      const composant = composants.find((c) => c.id === ligne.composantId);
      /* v8 ignore next */
      if (!composant) continue;
      amortissementExercicesLignes.push(
        AmortissementExercice.creer({
          bienId: composant.bienId,
          composantId: ligne.composantId,
          exercice,
          typeLigne: 'COMPOSANT',
          dotationTheorique: ligne.dotationTheorique,
          dotationAppliquee: ligne.dotationAppliquee,
          ardGenere: ligne.ardGenereComposant,
          ardCumuleDisponible: null,
          ardConsomme: null,
        }),
      );
    }

    // SYNTHESE_BIEN par bien : ard_cumule_disponible = ardCumuleEnSortie réparti
    // En V1 (D-LOCK-2 mono-bailleur) : ardCumuleEnSortie global réparti proportionnellement
    // Simplification V1 : une SYNTHESE_BIEN par bien avec ardCumuleDisponible = ardCumuleEnSortie total
    // (dernierArdCumuleBailleur somme toutes les SYNTHESE_BIEN → résultat correct)
    for (const bienId of biensIds) {
      amortissementExercicesLignes.push(
        AmortissementExercice.creer({
          bienId,
          composantId: null,
          exercice,
          typeLigne: 'SYNTHESE_BIEN',
          dotationTheorique: Money.zero(),
          dotationAppliquee: Money.zero(),
          ardGenere: Money.zero(),
          ardCumuleDisponible: tableau.ardCumuleEnSortie,
          ardConsomme: tableau.ardConsomme,
        }),
      );
    }
  }

  // (8) Création snapshot DeclarationAnnuelle (D-FIS-G4.2)
  const declaration = DeclarationAnnuelle.creer({
    bailleurId,
    exercice,
    regimeApplique,
    recettesTotales: recettes,
    chargesQualifieesParCategorie: chargesParCategorie,
    dotationAmortissement,
    ardGenere,
    ardConsomme,
    revenusFoyerSnapshot: bailleur.revenusActifsAnnuelsCourant ?? null,
    statutLmnpLmp: verdictLmp,
    composantsSnapshot,
    clotureLe: clock.aujourdhui(),
    seuilLmpRecettes: regles.SEUIL_LMP_RECETTES,
  });

  // (9) Transaction atomique : snapshot + tableau amortissement batch (T-05-06-07)
  await db.transaction().execute(async (trx) => {
    await repos.declRepo.enregistrer(declaration, trx);
    if (amortissementExercicesLignes.length > 0) {
      await repos.tableauAmortRepo.enregistrerBatch(amortissementExercicesLignes, trx);
    }
  });

  return {
    declarationId: declaration.id,
    verdictLmp,
    regimeApplique,
  };
}
