import type { Justificatif } from '../../domain/documents/justificatif.js';

interface JustificatifRepoMinimal {
  listerNonQualifiesPourAnnee(annee: number): Promise<Justificatif[]>;
}

/**
 * Use case — lister les Justificatifs non qualifiés pour une année (D-FIS-G2.1).
 *
 * Délègue au repo. Logique de filtrage (qualification_fiscale=null OR non_qualifie,
 * corbeille_le IS NULL, année par coalesce(date_paiement, date_document)) portée
 * par JustificatifRepositorySqlite.listerNonQualifiesPourAnnee.
 */
export async function listerJustificatifsNonQualifies(
  query: { annee: number },
  repos: { justificatifRepo: JustificatifRepoMinimal },
): Promise<Justificatif[]> {
  return repos.justificatifRepo.listerNonQualifiesPourAnnee(query.annee);
}
