-- Migration 0018 — Phase 5 : Composant BOFIP par bien (D-FIS-G1.1, G1.5, G5.2)
-- Décisions :
--   D-FIS-G1.1 : 6 types de composants BOFIP (terrain non amortissable + 5 amortissables)
--   D-FIS-G1.5 : origineKind + ticketId pour traçabilité améliorations / acquisitions mobilier
--   D-FIS-G5.2 : dateSortie + motifSortie pour sortie de composant (vente, mise au rebut, sinistre, autre)
--   BOFIP-BIC-AMT-20-40 : durées amortissement par type (non stockées — dérivées au runtime)
-- Sources : CGI art. 39, BOFIP-BIC-AMT-20-40, D-FIS-G1.1 à G1.5
-- Idempotent : CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.

BEGIN TRANSACTION;

-- Table bien_composant — sub-aggregate de Bien (D-FIS-G1.1)
-- La durée d'amortissement n'est PAS stockée : dérivée de DUREES_AMORTISSEMENT_ANS[type] versionnable.
CREATE TABLE IF NOT EXISTS bien_composant (
  id                      TEXT PRIMARY KEY,
  bien_id                 TEXT NOT NULL REFERENCES bien(id),
  type                    TEXT NOT NULL CHECK (type IN (
    'terrain',
    'gros_oeuvre',
    'toiture_facade',
    'installations_techniques',
    'agencements_interieurs',
    'mobilier'
  )),
  montant_ht_centimes     INTEGER NOT NULL CHECK (montant_ht_centimes >= 0),
  date_acquisition        TEXT NOT NULL,                  -- ISO 8601 PlainDate
  origine_kind            TEXT NOT NULL CHECK (origine_kind IN (
    'initial',
    'amelioration',
    'acquisition_mobilier'
  )),
  ticket_id               TEXT NULL REFERENCES tickets_travaux(id), -- D-FIS-G1.5 : requis si amelioration/acquisition_mobilier
  date_sortie             TEXT NULL,                      -- D-FIS-G5.2 : null = actif
  motif_sortie            TEXT NULL CHECK (motif_sortie IS NULL OR motif_sortie IN (
    'vente',
    'mise_au_rebut',
    'sinistre',
    'autre'
  )),
  cree_le                 TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index sur bien_id pour listerActifsParBien (filtrant les sortis)
CREATE INDEX IF NOT EXISTS idx_bien_composant_bien
  ON bien_composant(bien_id)
  WHERE date_sortie IS NULL;

-- Index pour listerParBien (tous, actifs + sortis)
CREATE INDEX IF NOT EXISTS idx_bien_composant_actifs
  ON bien_composant(bien_id, date_sortie);

COMMIT;
