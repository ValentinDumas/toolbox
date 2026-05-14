-- Migration 0002 — Phase 2 : Bailleur + extension Bail (actif_depuis, jour_echeance)
-- Conventions identiques à 0001 :
--   - Money en INTEGER centimes (jamais REAL)
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Identifiants UUID v4 TEXT PRIMARY KEY
--
-- WR-13 : transaction explicite. better-sqlite3.exec() n'enrobe pas
-- automatiquement les statements. Si le 2ᵉ ALTER échoue (panne disque
-- entre les deux), la base reste cohérente.
-- DEFAULT 1 garantit que la contrainte CHECK passe pour toutes les
-- rangées existantes (1 ∈ [1, 28]).
BEGIN TRANSACTION;

-- Extension de la table bail (D-51, D-53)
ALTER TABLE bail ADD COLUMN actif_depuis TEXT NULL;
ALTER TABLE bail ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 1
  CHECK (jour_echeance >= 1 AND jour_echeance <= 28);

-- Table bailleur singleton (D-67)
-- UNIQUE(singleton_marker) garantit qu'un seul bailleur peut exister
CREATE TABLE IF NOT EXISTS bailleur (
  id               TEXT PRIMARY KEY,
  singleton_marker TEXT NOT NULL DEFAULT 'unique_bailleur',
  nom_complet      TEXT NOT NULL,
  rue              TEXT NOT NULL,
  code_postal      TEXT NOT NULL,
  ville            TEXT NOT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (singleton_marker)
);

COMMIT;
