-- Migration 0003 — Phase 2 : Table echeance_loyer
-- Conventions identiques à 0001/0002 :
--   - Money en INTEGER centimes (jamais REAL)
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Identifiants UUID v4 TEXT PRIMARY KEY
--   - Soft-delete via annule_le DATETIME NULL

CREATE TABLE IF NOT EXISTS echeance_loyer (
  id                      TEXT PRIMARY KEY,
  bail_id                 TEXT NOT NULL REFERENCES bail(id),
  periode_debut           TEXT NOT NULL,
  periode_fin             TEXT NOT NULL,
  jour_echeance_attendue  TEXT NOT NULL,
  loyer_hc                INTEGER NOT NULL CHECK (loyer_hc >= 0),
  montant_charges         INTEGER NOT NULL CHECK (montant_charges >= 0),
  mode_charges            TEXT NOT NULL CHECK (mode_charges IN ('forfait','provisions')),
  total                   INTEGER NOT NULL CHECK (total >= 0),
  statut                  TEXT NOT NULL DEFAULT 'en_attente'
                            CHECK (statut IN ('en_attente','partiellement_payee','payee','annulee')),
  cree_le                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  annule_le               DATETIME NULL
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_echeance_loyer_bail ON echeance_loyer(bail_id);
CREATE INDEX IF NOT EXISTS idx_echeance_loyer_statut ON echeance_loyer(statut) WHERE statut != 'payee';
