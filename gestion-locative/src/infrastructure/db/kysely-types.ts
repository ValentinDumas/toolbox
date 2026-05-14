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
  cree_le: Generated<string>;
  modifie_le: Generated<string>;
  supprime_le: string | null;
}

export interface BailLotsTable {
  bail_id: string;
  lot_id: string;
}

export interface MetaTable {
  cle: string;
  valeur: string;
}

export interface DB {
  bien: BienTable;
  lot: LotTable;
  locataire: LocataireTable;
  bail: BailTable;
  bail_lots: BailLotsTable;
  meta: MetaTable;
}
