-- Migration 0006 — Phase 2 : Relances escaladées (ENC-05)
-- Conventions identiques à 0001-0005 :
--   - Identifiants UUID v4 TEXT PRIMARY KEY
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Soft-delete via annule_le DATETIME NULL (D-71)

CREATE TABLE IF NOT EXISTS relance (
  id                TEXT PRIMARY KEY,
  echeance_id       TEXT NOT NULL REFERENCES echeance_loyer(id),
  niveau            INTEGER NOT NULL CHECK (niveau IN (1,2,3)),
  canal             TEXT NOT NULL CHECK (canal IN ('email','pdf')),
  envoyee_le        TEXT NOT NULL,
  -- snapshot JSON : { variables, contenuRendu, mailtoUri, version } (D-71 audit-friendly)
  contenu_snapshot  TEXT NOT NULL,
  -- soft-delete si erreur d'envoi déclaré (D-71)
  annule_le         DATETIME NULL,
  cree_le           DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index partiel : accélère calculerRelanceDisponible (filtre annule_le IS NULL)
CREATE INDEX IF NOT EXISTS idx_relance_echeance_actif
  ON relance(echeance_id)
  WHERE annule_le IS NULL;
