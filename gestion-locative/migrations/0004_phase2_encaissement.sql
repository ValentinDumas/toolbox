-- Migration 0004 — Phase 2 : Encaissements
-- Conventions identiques à 0001-0003 :
--   - Soft-delete via annule_le DATETIME NULL (D-60)
--   - Money en INTEGER centimes (accepte négatifs pour compensateurs D-60)
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Identifiants UUID v4 TEXT PRIMARY KEY

CREATE TABLE IF NOT EXISTS encaissement (
  id                 TEXT PRIMARY KEY,
  echeance_id        TEXT NOT NULL REFERENCES echeance_loyer(id),
  -- NOTE : pas de CHECK >= 0 — compensateurs acceptés (D-60)
  montant_centimes   INTEGER NOT NULL,
  date               TEXT NOT NULL,
  mode               TEXT NOT NULL CHECK (mode IN ('virement','cheque','especes','prelevement','autre')),
  annule_le          DATETIME NULL,
  raison_annulation  TEXT NULL,
  cree_le            DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Accélère sommePaieeParEcheance (SUM WHERE annule_le IS NULL)
CREATE INDEX IF NOT EXISTS idx_encaissement_echeance_actif
  ON encaissement(echeance_id, annule_le)
  WHERE annule_le IS NULL;
