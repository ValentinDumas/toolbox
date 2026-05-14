-- Migration 0005 — Phase 2 : Quittances
-- Conventions identiques à 0001-0004 :
--   - Identifiants UUID v4 TEXT PRIMARY KEY
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Soft-cancel via annulee_le (D-65 — le PDF est conservé)

CREATE TABLE IF NOT EXISTS quittance (
  id                      TEXT PRIMARY KEY,
  -- echeance_id PAS UNIQUE : permet ré-émission post-annulation (D-65)
  echeance_id             TEXT NOT NULL REFERENCES echeance_loyer(id),
  -- numero UNIQUE globalement : séquentialité garantie (D-64)
  numero                  TEXT NOT NULL UNIQUE,
  chemin_fichier_relatif  TEXT NOT NULL,
  emise_le                TEXT NOT NULL,
  -- annulation soft-delete : PDF conservé (D-63)
  annulee_le              DATETIME NULL,
  raison_annulation       TEXT NULL,
  cree_le                 DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index pour chercher la quittance active d'une échéance
CREATE INDEX IF NOT EXISTS idx_quittance_echeance
  ON quittance(echeance_id);

-- Index partiel pour ne chercher que les quittances actives (annulee_le IS NULL)
CREATE INDEX IF NOT EXISTS idx_quittance_active
  ON quittance(echeance_id)
  WHERE annulee_le IS NULL;
