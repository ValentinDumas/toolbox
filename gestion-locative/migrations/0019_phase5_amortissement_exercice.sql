-- Migration 0019 — Phase 5 Plan 04 : AmortissementExercice (read-model matérialisé)
-- Décisions :
--   D-FIS-G1.7 : Read-model append-only 1 ligne par (bien_id, composant_id, exercice)
--   D-FIS-G1.7 : 1 ligne SYNTHESE_BIEN par (bien_id, exercice) — ARD cumulé disponible
--   T-05-04-02 : Append-only strict — PAS d'onConflict (UNIQUE violation = comportement attendu)
--   T-05-04-01 : Recalcul pur — lecture-seule avant clôture (recalculer-tableau-amortissement)
-- Sources juridiques :
--   CGI art. 39 : dotation théorique vs appliquée (plafond résultat)
--   CGI art. 39 B : ARD cumulé disponible, reportable sans limite
--   BOFIP-BIC-AMT-20-10 : prorata temporis au jour près (D-FIS-G1.6)
--   BOFIP-BIC-AMT-20-40 : durées composants BOFIP
-- Idempotent : CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS amortissement_exercice (
  id                            TEXT PRIMARY KEY,
  bien_id                       TEXT NOT NULL REFERENCES bien(id),
  composant_id                  TEXT NULL REFERENCES bien_composant(id),  -- NULL si SYNTHESE_BIEN
  exercice                      INTEGER NOT NULL,
  type_ligne                    TEXT NOT NULL CHECK (type_ligne IN ('COMPOSANT', 'SYNTHESE_BIEN')),
  dotation_theorique_centimes   INTEGER NOT NULL DEFAULT 0,
  dotation_appliquee_centimes   INTEGER NOT NULL DEFAULT 0,
  ard_genere_centimes           INTEGER NOT NULL DEFAULT 0,
  ard_cumule_disponible_centimes INTEGER NULL,   -- non null si type_ligne = 'SYNTHESE_BIEN'
  ard_consomme_centimes         INTEGER NULL,    -- non null si type_ligne = 'SYNTHESE_BIEN'
  cree_le                       TEXT NOT NULL DEFAULT (datetime('now')),
  -- Append-only strict (T-05-04-02) : une réinsertion = UNIQUE violation (comportement attendu)
  -- composant_id IS NULL pour SYNTHESE_BIEN → contrainte UNIQUE couvre bien_id + NULL + exercice
  UNIQUE (bien_id, composant_id, exercice)
);

-- Index principal pour lookup par (bien, exercice) — lecture S4 + clôture Plan 06
CREATE INDEX IF NOT EXISTS idx_amort_bien_exercice
  ON amortissement_exercice(bien_id, exercice);

-- Index partiel SYNTHESE_BIEN pour dernierArdCumule (query Plan 04 + Plan 06)
CREATE INDEX IF NOT EXISTS idx_amort_synthese_bien
  ON amortissement_exercice(bien_id, exercice)
  WHERE type_ligne = 'SYNTHESE_BIEN';

COMMIT;
