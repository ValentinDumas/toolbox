import type { Generated } from 'kysely';

// Types Kysely alignés sur le schéma SQL migration 0001_init.sql
// Money : INTEGER centimes — conversion bigint↔number à la frontière infra (V1 acceptable, loyers < 2^53)

export interface BienTable {
  id: string;
  rue: string;
  code_postal: string;
  ville: string;
  surface: number;
  type: 'appartement' | 'maison' | 'immeuble' | 'local_commercial';
  annee_construction: number;
  classe_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
}

// Phase 3 — Diagnostics techniques immobiliers (PAT-03)
export interface DiagnosticsTable {
  id: string;
  bien_id: string;
  type: 'dpe' | 'gaz' | 'elec' | 'erp';
  date_emission: string;
  date_expiration: string | null;
  classe_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null;
  cree_le: Generated<string>;
}

export interface LotTable {
  id: string;
  bien_id: string;
  designation: string;
  surface: number | null;
  type: 'appartement' | 'parking' | 'cave' | 'local_commercial' | 'terrasse' | 'autre';
  etage: number | null;
  cree_le: Generated<string>;
  supprime_le: string | null;
}

export interface LocataireTable {
  id: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  commune_naissance: string;
  pays_naissance: string;
  nationalite: string;
  email: string;
  telephone: string | null;
  rue: string;
  code_postal: string;
  ville: string;
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
}

export interface BailTable {
  id: string;
  locataire_id: string;
  bien_id: string;
  type: string;
  date_debut: string;
  duree_mois: number;
  loyer_hc: number;
  mode_charges: 'forfait' | 'provisions';
  montant_charges: number;
  depot_garantie: number;
  irl_trimestre: string;
  irl_valeur: string;
  cautionnement: string | null;
  actif_depuis: string | null;
  jour_echeance: number;
  /** Phase 3 — LOC-06 D-97 : JSON array d'InventaireItem (présence seulement à la création du bail) */
  mobilier: string | null;
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
}

// Phase 3 — EtatDesLieux (LOC-03, D-82, D-86, D-89)
export interface EtatDesLieuxTable {
  id: string;
  bail_id: string;
  type: 'entree' | 'sortie';
  date_edl: string;
  contradictoire: 0 | 1;
  date_signature: string | null;
  inventaire: string; // JSON array of InventaireItem (D-86)
  annule_le: string | null; // Soft-delete (D-89)
  raison_annulation: string | null;
  cree_le: Generated<string>;
}

export interface BailleurTable {
  id: string;
  singleton_marker: string;
  nom_complet: string;
  rue: string;
  code_postal: string;
  ville: string;
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  // Phase 5 — données fiscales (migration 0015)
  regime_fiscal: 'micro_bic' | 'reel' | null;
  revenus_actifs_annuels_courant_centimes: number | null;
  fiscalite_premier_acces: string | null;
}

export interface BailLotsTable {
  bail_id: string;
  lot_id: string;
}

export interface MetaTable {
  cle: string;
  valeur: string;
}

export interface EcheanceLoyerTable {
  id: string;
  bail_id: string;
  periode_debut: string;
  periode_fin: string;
  jour_echeance_attendue: string;
  loyer_hc: number;
  montant_charges: number;
  mode_charges: 'forfait' | 'provisions';
  total: number;
  statut: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee';
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  annule_le: string | null;
}

export interface EncaissementTable {
  id: string;
  echeance_id: string;
  montant_centimes: number;
  date: string;
  mode: 'virement' | 'cheque' | 'especes' | 'prelevement' | 'autre';
  annule_le: string | null;
  raison_annulation: string | null;
  cree_le: Generated<string>;
}

export interface QuittanceTable {
  id: string;
  echeance_id: string;
  numero: string;
  chemin_fichier_relatif: string;
  emise_le: string;
  annulee_le: string | null;
  raison_annulation: string | null;
  cree_le: Generated<string>;
}

export interface RelanceTable {
  id: string;
  echeance_id: string;
  niveau: 1 | 2 | 3;
  canal: 'email' | 'pdf';
  envoyee_le: string;
  contenu_snapshot: string;
  annule_le: string | null;
  cree_le: Generated<string>;
}

// Phase 3 — BailIndexation append-only (LOC-04 apply, D-96)
export interface BailIndexationsTable {
  id: string;
  bail_id: string;
  date_effet: string;
  irl_avant_trimestre: string;
  irl_avant_valeur: string;
  irl_apres_trimestre: string;
  irl_apres_valeur: string;
  loyer_avant_centimes: number;
  loyer_apres_centimes: number;
  indexation_appliquee: 0 | 1;
  raison_non_application: 'gel_dpe' | 'refus_bailleur' | null;
  cree_le: Generated<string>;
}

// Phase 4 — BC Documents (DOC-01, D-102, D-104, D-108, D-109)
export type TypeJustificatifRow =
  | 'facture'
  | 'ticket_caisse'
  | 'bail_signe'
  | 'edl_signe'
  | 'diagnostic_pdf'
  | 'attestation'
  | 'piece_locataire'
  | 'releve_bancaire'
  | 'autre';

export type MimeJustificatifRow =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface JustificatifsTable {
  id: string;
  type: TypeJustificatifRow;
  date_document: string;
  titre: string;
  montant_ttc_centimes: number | null;
  chemin_fichier: string;
  nom_fichier_original: string;
  mime_type: MimeJustificatifRow;
  taille_octets: number;
  bien_id: string | null;
  locataire_id: string | null;
  notes: string | null;
  cree_le: string;
  corbeille_le: string | null;
  raison_corbeille: string | null;
  // Phase 5 — qualification fiscale (migration 0014)
  qualification_fiscale: 'non_qualifie' | 'entretien_reparation' | 'amelioration' | 'charge_courante_periodique' | 'non_deductible' | null;
  qualifie_le: string | null;
  date_paiement: string | null;
  parent_justificatif_id: string | null;
}

// Phase 4 — BC Travaux scaffolding (utilisé en 04-03 — D-115 : pas de nature, différé Phase 5)
// Phase 5 — extension nature + nature_fiscale (migration 0021)
export interface TicketsTravauxTable {
  id: string;
  bien_id: string;
  titre: string;
  description: string;
  date_ouverture: string;
  date_cloture: string | null;
  statut: 'ouvert' | 'en_cours' | 'clos' | 'annule';
  cout_estime_ttc_centimes: number | null;
  cout_reel_ttc_centimes: number | null;
  notes: string | null;
  cree_le: string;
  annule_le: string | null;
  raison_annulation: string | null;
  // Phase 5 — D-FIS-G1.2 + D-FIS-G2.3
  nature: 'acquisition_mobilier' | 'entretien' | 'amelioration' | 'autre' | null;
  nature_fiscale: 'non_qualifie' | 'entretien_reparation' | 'amelioration' | 'charge_courante_periodique' | 'non_deductible' | null;
}

export interface TicketJustificatifsTable {
  ticket_id: string;
  justificatif_id: string;
}

// Phase 5 — BC Fiscalité : Composant sub-aggregate (migration 0018)
export interface BienComposantTable {
  id: string;
  bien_id: string;
  type: 'terrain' | 'gros_oeuvre' | 'toiture_facade' | 'installations_techniques' | 'agencements_interieurs' | 'mobilier';
  montant_ht_centimes: number;
  date_acquisition: string;
  origine_kind: 'initial' | 'amelioration' | 'acquisition_mobilier';
  ticket_id: string | null;
  date_sortie: string | null;
  motif_sortie: 'vente' | 'mise_au_rebut' | 'sinistre' | 'autre' | null;
  cree_le: string;
}

// Phase 5 — BC Fiscalité : ValorisationFiscale 1-1 avec Bien (migration 0020)
export interface BienValorisationFiscaleTable {
  id: string;
  bien_id: string;
  prix_acquisition_centimes: number;
  date_acquisition: string;
  frais_notaire_centimes: number;
  frais_agence_centimes: number;
  quote_part_terrain_ratio: number;
  active_le: string;
}

// Phase 5 — BC Fiscalité : AmortissementExercice read-model (migration 0019)
// Append-only strict (D-FIS-G1.7, T-05-04-02) : UNIQUE (bien_id, composant_id, exercice)
export interface AmortissementExerciceTable {
  id: string;
  bien_id: string;
  composant_id: string | null;  // null si type_ligne = 'SYNTHESE_BIEN'
  exercice: number;
  type_ligne: 'COMPOSANT' | 'SYNTHESE_BIEN';
  dotation_theorique_centimes: number;
  dotation_appliquee_centimes: number;
  ard_genere_centimes: number;
  ard_cumule_disponible_centimes: number | null;  // non null si SYNTHESE_BIEN
  ard_consomme_centimes: number | null;            // non null si SYNTHESE_BIEN
  cree_le: string;
}

// Phase 5 — Plan 06 : DeclarationAnnuelle append-only (migration 0016)
export interface DeclarationsAnnuellesTable {
  id: string;
  bailleur_id: string;
  exercice: number;
  regime_applique: 'micro_bic' | 'reel';
  recettes_totales_centimes: number;
  charges_qualifiees_json: string;
  dotation_amortissement_centimes: number;
  ard_genere_centimes: number;
  ard_consomme_centimes: number;
  revenus_foyer_snapshot_centimes: number | null;
  statut_lmnp_lmp: 'lmnp_confirme' | 'lmp_probable' | 'indetermine_revenus_foyer_manquants';
  composants_snapshot_json: string;
  cloture_le: string;
}

// Phase 6 — Plan 06 : DeclarationCfe (migration 0023) — upsert sur (bien_id, millesime)
export type StatutCfeRow =
  | 'non_deposee'
  | 'deposee'
  | 'exoneree_premiere_annee'
  | 'exoneree_commune'
  | 'payee';

export interface DeclarationsCfeTable {
  id: string;
  bien_id: string;
  millesime: number;
  statut: StatutCfeRow;
  date_depot_declaration: string | null;
  montant_avis_centimes: number | null;
  date_echeance_paiement: string;
}

// Phase 5 — Plan 06 : DeclarationCorrigee append-only (migration 0017)
export interface DeclarationsCorrigeesTable {
  id: string;
  declaration_originale_id: string;
  motif: string;
  recettes_totales_centimes: number;
  charges_qualifiees_json: string;
  dotation_amortissement_centimes: number;
  ard_genere_centimes: number;
  ard_consomme_centimes: number;
  revenus_foyer_snapshot_centimes: number | null;
  statut_lmnp_lmp: 'lmnp_confirme' | 'lmp_probable' | 'indetermine_revenus_foyer_manquants';
  regime_applique: 'micro_bic' | 'reel';
  cree_le: string;
}

export interface DB {
  bien: BienTable;
  lot: LotTable;
  locataire: LocataireTable;
  bail: BailTable;
  bail_lots: BailLotsTable;
  meta: MetaTable;
  bailleur: BailleurTable;
  echeance_loyer: EcheanceLoyerTable;
  encaissement: EncaissementTable;
  quittance: QuittanceTable;
  relance: RelanceTable;
  diagnostics: DiagnosticsTable;
  etat_des_lieux: EtatDesLieuxTable;
  bail_indexations: BailIndexationsTable;
  justificatifs: JustificatifsTable;
  tickets_travaux: TicketsTravauxTable;
  ticket_justificatifs: TicketJustificatifsTable;
  // Phase 5 — BC Fiscalité (migrations 0018, 0019, 0020)
  bien_composant: BienComposantTable;
  bien_valorisation_fiscale: BienValorisationFiscaleTable;
  amortissement_exercice: AmortissementExerciceTable;
  // Phase 5 — Plan 06 : clôture exercice (migrations 0016, 0017)
  declarations_annuelles: DeclarationsAnnuellesTable;
  declarations_corrigees: DeclarationsCorrigeesTable;
  // Phase 6 — Plan 06 : suivi déclaratif CFE (migration 0023)
  declarations_cfe: DeclarationsCfeTable;
}
