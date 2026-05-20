-- Migration 0020 — Phase 5 : ValorisationFiscale (1-1 avec bien — D-FIS-G1.4)
-- Décisions :
--   D-FIS-G1.4 : VO ValorisationFiscale liée 1-1 à Bien pour le régime réel
--   D-FIS-G1.8 : quotePartTerrainRatio ∈ [0, 0.30] — saisie libre sans pré-remplissage
--   D-FIS-G1.3 : fraisNotaire + fraisAgence répartis au prorata (BOFIP-BIC-AMT-10-20 §110)
--   T-05-03-01 : UNIQUE(bien_id) garantit l'idempotence (double activation impossible au niveau DB)
-- Sources : BOFIP-BIC-AMT-10-20 §110, D-FIS-G1.4, D-FIS-G1.8
-- Idempotent : CREATE TABLE IF NOT EXISTS.

BEGIN TRANSACTION;

-- Table bien_valorisation_fiscale — 1-1 avec bien (UNIQUE bien_id)
CREATE TABLE IF NOT EXISTS bien_valorisation_fiscale (
  id                              TEXT PRIMARY KEY,
  bien_id                         TEXT NOT NULL UNIQUE REFERENCES bien(id),  -- UNIQUE : 1-1
  prix_acquisition_centimes       INTEGER NOT NULL CHECK (prix_acquisition_centimes > 0),
  date_acquisition                TEXT NOT NULL,  -- ISO 8601 PlainDate
  frais_notaire_centimes          INTEGER NOT NULL CHECK (frais_notaire_centimes >= 0),
  frais_agence_centimes           INTEGER NOT NULL CHECK (frais_agence_centimes >= 0),
  quote_part_terrain_ratio        REAL NOT NULL CHECK (
    quote_part_terrain_ratio >= 0 AND quote_part_terrain_ratio <= 0.30
  ),  -- D-FIS-G1.8 : [0, 30 %]
  active_le                       TEXT NOT NULL  -- ISO 8601 PlainDateTime — snapshot activation
);

COMMIT;
