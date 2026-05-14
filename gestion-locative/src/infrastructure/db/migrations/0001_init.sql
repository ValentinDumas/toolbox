-- Migration 0001 — Schéma initial Phase 1
-- Tables : bien, lot, locataire, bail, bail_lots, meta
-- Conventions :
--   - Soft-delete via supprime_le DATETIME NULL
--   - Money en INTEGER centimes (jamais REAL)
--   - Dates en TEXT ISO 8601
--   - Identifiants UUID v4 TEXT

CREATE TABLE IF NOT EXISTS bien (
  id                 TEXT PRIMARY KEY,
  rue                TEXT NOT NULL,
  code_postal        TEXT NOT NULL,
  ville              TEXT NOT NULL,
  surface            REAL NOT NULL CHECK (surface > 0),
  type               TEXT NOT NULL CHECK (type IN ('appartement','maison','immeuble','local_commercial')),
  annee_construction INTEGER NOT NULL,
  cree_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le        DATETIME NULL
);

CREATE TABLE IF NOT EXISTS lot (
  id          TEXT PRIMARY KEY,
  bien_id     TEXT NOT NULL REFERENCES bien(id),
  designation TEXT NOT NULL,
  surface     REAL NULL,
  type        TEXT NOT NULL CHECK (type IN ('appartement','parking','cave','local_commercial','terrasse','autre')),
  etage       INTEGER NULL,
  cree_le     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le DATETIME NULL
);

CREATE TABLE IF NOT EXISTS locataire (
  id               TEXT PRIMARY KEY,
  nom              TEXT NOT NULL,
  prenom           TEXT NOT NULL,
  date_naissance   TEXT NOT NULL,
  commune_naissance TEXT NOT NULL,
  pays_naissance   TEXT NOT NULL,
  nationalite      TEXT NOT NULL,
  email            TEXT NOT NULL,
  telephone        TEXT NULL,
  rue              TEXT NOT NULL,
  code_postal      TEXT NOT NULL,
  ville            TEXT NOT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le      DATETIME NULL
);

CREATE TABLE IF NOT EXISTS bail (
  id               TEXT PRIMARY KEY,
  locataire_id     TEXT NOT NULL REFERENCES locataire(id),
  bien_id          TEXT NOT NULL REFERENCES bien(id),
  type             TEXT NOT NULL DEFAULT 'classique',
  date_debut       TEXT NOT NULL,
  duree_mois       INTEGER NOT NULL CHECK (duree_mois >= 12),
  loyer_hc         INTEGER NOT NULL CHECK (loyer_hc > 0),
  mode_charges     TEXT NOT NULL CHECK (mode_charges IN ('forfait','provisions')),
  montant_charges  INTEGER NOT NULL,
  depot_garantie   INTEGER NOT NULL,
  irl_trimestre    TEXT NOT NULL,
  irl_valeur       TEXT NOT NULL,
  cautionnement    TEXT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le      DATETIME NULL
);

CREATE TABLE IF NOT EXISTS bail_lots (
  bail_id TEXT NOT NULL REFERENCES bail(id),
  lot_id  TEXT NOT NULL REFERENCES lot(id),
  PRIMARY KEY (bail_id, lot_id)
);

-- Table meta : flags système (wizard_complete, migrations appliquées, etc.)
CREATE TABLE IF NOT EXISTS meta (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);
