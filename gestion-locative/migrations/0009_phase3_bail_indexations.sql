-- Migration 0009 — Phase 3 Plan 04 : BailIndexation (LOC-04 apply)
-- Table append-only des révisions IRL appliquées ou renoncées (D-96).
-- Permet : (1) opposabilité juridique avenant loi 89 art. 17-1,
--         (2) historique recettes liasse 2031 (Phase 5),
--         (3) filtre 12-mois dans lister-bails-indexables.
-- Idempotent : CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS bail_indexations (
  id TEXT PRIMARY KEY,
  bail_id TEXT NOT NULL REFERENCES bail(id),
  date_effet TEXT NOT NULL,
  irl_avant_trimestre TEXT NOT NULL,
  irl_avant_valeur TEXT NOT NULL,
  irl_apres_trimestre TEXT NOT NULL,
  irl_apres_valeur TEXT NOT NULL,
  loyer_avant_centimes INTEGER NOT NULL,
  loyer_apres_centimes INTEGER NOT NULL,
  indexation_appliquee INTEGER NOT NULL CHECK (indexation_appliquee IN (0, 1)),
  raison_non_application TEXT NULL CHECK (
    raison_non_application IS NULL
    OR raison_non_application IN ('gel_dpe', 'refus_bailleur')
  ),
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index pour query Phase 5 (lookup historique par bail + tri chronologique inverse).
CREATE INDEX IF NOT EXISTS idx_bail_indexations_bail
  ON bail_indexations(bail_id, date_effet DESC);

-- Index UNIQUE optionnel — T-03-04-05 (évite double application accidentelle même jour).
CREATE UNIQUE INDEX IF NOT EXISTS idx_bail_indexations_bail_date_unique
  ON bail_indexations(bail_id, date_effet);

COMMIT;
