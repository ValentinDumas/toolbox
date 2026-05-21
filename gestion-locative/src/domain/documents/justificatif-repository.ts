import type {
  BienId,
  JustificatifId,
  LocataireId,
} from '../_shared/identifiants.js';

import type { Justificatif, TypeJustificatif } from './justificatif.js';

export interface JustificatifRechercheFiltres {
  search?: string;
  bienId?: BienId | string | null;
  locataireId?: LocataireId | string | null;
  anneeFiscale?: number;
  type?: TypeJustificatif;
  /**
   * Phase 4 wave 2 — restriction multi-types (D-120 fiche Locataire).
   * Exposé dès Wave 1 (future-proof) — l'adapter applique le filtre si fourni
   * même si aucun use case Wave 1 ne le consomme.
   */
  typeIn?: TypeJustificatif[];
  inclureCorbeille?: boolean;
  page?: number;
  pageSize?: number;
}

export interface JustificatifPage {
  items: Justificatif[];
  total: number;
}

export interface JustificatifRepository {
  enregistrer(justificatif: Justificatif, trx?: unknown): Promise<void>;
  trouverParId(id: JustificatifId | string): Promise<Justificatif | null>;
  rechercher(filtres: JustificatifRechercheFiltres): Promise<JustificatifPage>;
  listerCorbeille(): Promise<Justificatif[]>;
  supprimerDefinitivement(id: JustificatifId, trx?: unknown): Promise<void>;

  /**
   * Compte les justificatifs non qualifiés pour une année fiscale donnée.
   *
   * Filtre :
   *   - qualification_fiscale IS NULL OR qualification_fiscale = 'non_qualifie'
   *   - corbeille_le IS NULL (non supprimés)
   *   - substr(COALESCE(date_paiement, date_document), 1, 4) = annee (D-FIS-G2.11)
   *
   * Utilisé par collecterPrerequisCloture pour le prérequis D-FIS-G4.1 (a).
   *
   * @param annee - exercice fiscal (ex: 2026)
   * @returns nombre de justificatifs non qualifiés
   */
  compterNonQualifiesPourAnnee(annee: number): Promise<number>;
}
