-- Migration 0008 — Phase 3 Plan 02 : EtatDesLieux + Mobilier Bail
-- LOC-03 : état des lieux contradictoire + inventaire mobilier 12 items (Décret 2015-981)
-- LOC-06 : checklist mobilier obligatoire à la création/édition du Bail
-- D-82, D-86, D-89, D-97 — aligné pattern 0007_phase3_diagnostics.sql
-- Idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, ALTER IF NOT EXISTS)

BEGIN TRANSACTION;

-- Étendre la table bail avec le champ mobilier JSON (LOC-06, D-97)
-- Note : SQLite n'a pas "ALTER TABLE ADD COLUMN IF NOT EXISTS" natif
-- On utilise un guard via pragma table_info (exécuté par appliquerToutesMigrations via rawExec)
-- Pour la compatibilité, on catch l'erreur "duplicate column name" dans le code de migration
ALTER TABLE bail ADD COLUMN mobilier TEXT NULL;

-- Table état des lieux (LOC-03, D-82, D-86, D-89)
CREATE TABLE IF NOT EXISTS etat_des_lieux (
  id TEXT PRIMARY KEY,
  bail_id TEXT NOT NULL REFERENCES bail(id),
  type TEXT NOT NULL CHECK (type IN ('entree', 'sortie')),
  date_edl TEXT NOT NULL,
  contradictoire INTEGER NOT NULL DEFAULT 0,
  date_signature TEXT NULL,
  inventaire TEXT NOT NULL,         -- JSON array of InventaireItem (D-86, pattern Cautionnement Phase 1)
  annule_le DATETIME NULL,          -- Soft-delete (D-89 + pattern Encaissement Phase 2)
  raison_annulation TEXT NULL,      -- Motif d'annulation (ex: "Erreur de date")
  cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index standard sur bail_id pour les lookups par bail
CREATE INDEX IF NOT EXISTS idx_edl_bail ON etat_des_lieux(bail_id);

-- Index unique PARTIEL : au plus 1 EDL actif par (bail, type) — D-89
-- WHERE annule_le IS NULL → seuls les non-annulés participent à la contrainte d'unicité
-- Pattern identique aux quittances actives Phase 2
CREATE UNIQUE INDEX IF NOT EXISTS idx_edl_bail_type_actif
  ON etat_des_lieux(bail_id, type) WHERE annule_le IS NULL;

COMMIT;
