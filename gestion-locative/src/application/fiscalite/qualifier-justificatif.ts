/**
 * Use case — qualifier un Justificatif avec vérification figée D-FIS-G2.5.
 *
 * Ce use case est CRÉÉ dans Plan 06 (Plan 02 appelait `justificatif.qualifier()` directement).
 * Le retrofit D-FIS-G2.5 ajoute un check figée AVANT toute écriture :
 *   si DeclarationAnnuelle existe pour l'exercice du justificatif → throw DeclarationFigeeException.
 *
 * Sources juridiques :
 *   - D-FIS-G2.5 : qualification gelée si exercice clôturé — correction via DeclarationCorrigee
 *   - D-FIS-G2.11 : datePaiement prioritaire sur dateDocument pour déterminer l'exercice
 *   - T-05-06-10 : Qualification post-clôture (contournement D-FIS-G2.5)
 */

import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { JustificatifIntrouvable } from '../../domain/documents/erreurs.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { DeclarationFigeeException } from '../../domain/fiscalite/erreurs.js';

export interface QualifierJustificatifCommande {
  justificatifId: JustificatifId;
  qualification: QualificationFiscale;
}

interface QualifierJustificatifRepos {
  justificatifRepo: Pick<JustificatifRepository, 'trouverParId' | 'enregistrer'>;
  declRepo: Pick<DeclarationAnnuelleRepository, 'trouverParBailleurExercice'>;
  bailleurRepo: Pick<BailleurRepository, 'trouver'>;
}

/**
 * Qualifie un Justificatif après vérification figée D-FIS-G2.5.
 *
 * Étapes :
 *   1. Lookup justificatif → throw JustificatifIntrouvable si null
 *   2. Lookup bailleur → throw BailleurAbsent si null
 *   3. Exercice = justificatif.anneeFiscale() (datePaiement.year ?? dateDocument.year — D-FIS-G2.11)
 *   4. Check figée : declRepo.trouverParBailleurExercice → throw DeclarationFigeeException si non null
 *   5. Qualifier justificatif (copy-on-write)
 *   6. justificatifRepo.enregistrer
 *
 * @throws JustificatifIntrouvable si justificatifId introuvable
 * @throws BailleurAbsent si aucun bailleur configuré
 * @throws DeclarationFigeeException si l'exercice du justificatif est déjà clôturé (D-FIS-G2.5)
 */
export async function qualifierJustificatif(
  commande: QualifierJustificatifCommande,
  repos: QualifierJustificatifRepos,
  clock: Clock,
): Promise<void> {
  // (1) Lookup justificatif
  const justificatif = await repos.justificatifRepo.trouverParId(commande.justificatifId);
  if (justificatif === null) {
    throw new JustificatifIntrouvable(commande.justificatifId);
  }

  // (2) Lookup bailleur
  const bailleur = await repos.bailleurRepo.trouver();
  if (bailleur === null) {
    throw new BailleurAbsent();
  }

  // (3) Exercice du justificatif (D-FIS-G2.11 : datePaiement prioritaire)
  const exercice = justificatif.anneeFiscale();

  // (4) Figée check D-FIS-G2.5 : exercice déjà clôturé ?
  const declExistante = await repos.declRepo.trouverParBailleurExercice(bailleur.id, exercice);
  if (declExistante !== null) {
    throw new DeclarationFigeeException();
  }

  // (5) Qualifier le justificatif (copy-on-write — D-FIS-G2.4)
  const today = clock.aujourdhui();
  const justificatifQualifie = justificatif.qualifier(commande.qualification, today);

  // (6) Persister
  await repos.justificatifRepo.enregistrer(justificatifQualifie);
}
