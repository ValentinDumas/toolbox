/**
 * Use case — collecte des prérequis de clôture d'exercice fiscal (D-FIS-G4.1).
 *
 * PURE side-effect-free lecture : ne lance PAS d'exception (retourne bloquants/avertissements).
 * L'appelant (cloturerExercice) throw PrerequisCloturalNonSatisfaits si bloquants.length > 0.
 *
 * Prérequis vérifiés (D-FIS-G4.1) :
 *   (a) Justificatifs non qualifiés pour l'exercice = 0
 *   (b) Tickets travaux actifs (statut ouvert / en_cours) = 0
 *   (c) Revenus foyer renseignés si recettes > SEUIL_LMP_RECETTES (D-FIS-G3.1)
 *   (d) Valorisation fiscale activée pour chaque bien actif (si régime réel ou recettes > SEUIL_MICRO)
 *
 * Sources juridiques :
 *   - D-FIS-G4.1 : prérequis bloquants avant clôture
 *   - D-FIS-G3.1 : revenus foyer requis si recettes > 23 000 €
 *   - CGI art. 50-0 : seuil micro-BIC 83 600 € 2026-2028
 */

import type { BailleurId } from '../../domain/_shared/identifiants.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { ValorisationFiscaleRepository, ComposantRepository } from '../../domain/fiscalite/composant-repository.js';
import type { RecettesRepository } from '../../domain/fiscalite/recettes-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { RegleFiscaleProvider } from '../../domain/fiscalite/regles/regle-fiscale-provider.js';
interface PrerequisRepos {
  bailleurRepo: Pick<BailleurRepository, 'trouver'>;
  justificatifRepo: Pick<JustificatifRepository, 'compterNonQualifiesPourAnnee'>;
  ticketRepo: Pick<TicketTravauxRepository, 'compterStatutsActifs'>;
  valorisationRepo: Pick<ValorisationFiscaleRepository, 'trouverParBien'>;
  bienRepo: Pick<BienRepository, 'listerTous'>;
  recettesRepo: Pick<RecettesRepository, 'sommeRecettesAnnuelles'>;
}

export interface PrerequisClotureResultat {
  bloquants: string[];
  avertissements: string[];
}

/**
 * Collecte les prérequis de clôture sans throw.
 *
 * Retourne { bloquants, avertissements } pour affichage dans le wizard étape 1 (S8).
 * Ne persiste rien. Ne jette aucune exception (les bloquants sont dans le résultat).
 *
 * @param bailleurId - identifiant bailleur (D-LOCK-2)
 * @param exercice - exercice fiscal à clôturer
 * @param repos - ports injectés (lecture seule)
 * @param regleFiscale - règles fiscales versionnées
 * @returns { bloquants: string[], avertissements: string[] }
 */
export async function collecterPrerequisCloture(
  bailleurId: BailleurId,
  exercice: number,
  repos: PrerequisRepos,
  regleFiscale: RegleFiscaleProvider,
): Promise<PrerequisClotureResultat> {
  const bloquants: string[] = [];
  const avertissements: string[] = [];

  const regles = regleFiscale.pour(exercice);

  // (a) Lookup bailleur
  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) {
    bloquants.push('Profil bailleur absent — configurez votre profil avant de clôturer');
    return { bloquants, avertissements };
  }

  // (b) Justificatifs non qualifiés
  const nbNonQualifies = await repos.justificatifRepo.compterNonQualifiesPourAnnee(exercice);
  if (nbNonQualifies > 0) {
    bloquants.push(
      `${nbNonQualifies} justificatif(s) à qualifier pour ${exercice} (D-FIS-G4.1 a)`,
    );
  }

  // (c) Tickets travaux actifs (statut 'ouvert' ou 'en_cours')
  const nbTicketsActifs = await repos.ticketRepo.compterStatutsActifs();
  if (nbTicketsActifs > 0) {
    bloquants.push(
      `${nbTicketsActifs} ticket(s) à clore avant clôture fiscale (D-FIS-G4.1 b)`,
    );
  }

  // (d) Recettes annuelles
  const recettes = await repos.recettesRepo.sommeRecettesAnnuelles(bailleurId, exercice);

  // (e) Revenus foyer requis si recettes > SEUIL_LMP (D-FIS-G3.1)
  if (
    recettes.superieurA(regles.SEUIL_LMP_RECETTES) &&
    bailleur.revenusActifsAnnuelsCourant === null
  ) {
    bloquants.push(
      `Revenus du foyer requis : recettes (${recettes.enEuros()}) > seuil LMP ${regles.SEUIL_LMP_RECETTES.enEuros()} (D-FIS-G3.1)`,
    );
  }

  // (f) Valorisation fiscale activée pour chaque bien actif si recettes > seuil micro (réel probable)
  if (recettes.superieurA(regles.SEUIL_MICRO_BIC_LONGUE_DUREE)) {
    const biensActifs = await repos.bienRepo.listerTous();
    for (const bien of biensActifs) {
      const valorisation = await repos.valorisationRepo.trouverParBien(bien.id);
      if (valorisation === null) {
        bloquants.push(
          `Bien non activé fiscalement : ${bien.adresse.enLigne()} — activez la fiscalité avant clôture (D-FIS-G4.1 d)`,
        );
      }
    }
  }

  return { bloquants, avertissements };
}
