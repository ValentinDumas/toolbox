-- Migration 0007 — Phase 3 Plan 01 : Diagnostics techniques immobiliers (PAT-03)
-- Encodage : UTF-8. Dates : ISO 8601 TEXT. Montants : INTEGER centimes. UUIDs : v4.
-- Généré le 2026-05-17.
--
-- Décisions : D-75 (rattachement Bien uniquement), D-76 (sous-agrégat, pas de DiagnosticRepository),
--   D-77 (durées légales codées dans le domaine, mise à jour R1.1 RISKS.md),
--   D-78 (Bien.classeDpe champ explicite), DP-15 (table dédiée pour queryability Phase 7).
--
-- Contenu :
--   1. ALTER TABLE bien ADD COLUMN classe_dpe
--   2. CREATE TABLE diagnostics
--   3. INDEX bien_id (lookup par bien)
--   4. INDEX date_expiration (queryability Phase 7 dashboard diagnostics expirés)

BEGIN TRANSACTION;

ALTER TABLE bien
  ADD COLUMN classe_dpe TEXT NULL
  CHECK (classe_dpe IS NULL OR classe_dpe IN ('A', 'B', 'C', 'D', 'E', 'F', 'G'));

CREATE TABLE IF NOT EXISTS diagnostics (
  id             TEXT PRIMARY KEY,
  bien_id        TEXT NOT NULL REFERENCES bien(id),
  type           TEXT NOT NULL CHECK (type IN ('dpe', 'gaz', 'elec', 'erp')),
  date_emission  TEXT NOT NULL,
  date_expiration TEXT NULL,
  classe_dpe     TEXT NULL
    CHECK (classe_dpe IS NULL OR classe_dpe IN ('A', 'B', 'C', 'D', 'E', 'F', 'G')),
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diagnostics_bien ON diagnostics(bien_id);
CREATE INDEX IF NOT EXISTS idx_diagnostics_expiration ON diagnostics(date_expiration);

COMMIT;
