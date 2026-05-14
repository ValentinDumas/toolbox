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
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
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
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
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
}
