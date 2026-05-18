-- Migration 0010 — Phase 4 : Coffre documentaire + Travaux (scaffolding)
-- Décisions :
--   D-102 : Justificatif = agrégat racine (BC Documents)
--   D-103 : Polymorphic 2-FK invariant (bien_id OR locataire_id NOT NULL — défense en profondeur SQL CHECK)
--   D-104 : TypeJustificatif enum 9 valeurs
--   D-106 : StockageJustificatifs port dédié BC Documents
--   D-108 : Champs Justificatif
--   D-109 : Rétention 10 ans + soft-delete (corbeille_le)
--   D-110 : Indexes partiels sur lignes actives (corbeille_le IS NULL)
--   D-112 : N:N ticket_justificatifs (cascade asymétrique D-113)
--   D-113 : Pas de CASCADE sur justificatif — rétention 10 ans prime
--   D-115 : Pas de champ nature sur tickets_travaux (qualification fiscale différée Phase 5)
-- Idempotent (CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS).

BEGIN TRANSACTION;

-- Table justificatifs (BC Documents D-102)
CREATE TABLE IF NOT EXISTS justificatifs (
  id                      TEXT PRIMARY KEY,
  type                    TEXT NOT NULL CHECK (type IN (
    'facture','ticket_caisse','bail_signe','edl_signe',
    'diagnostic_pdf','attestation','piece_locataire',
    'releve_bancaire','autre'
  )),
  date_document           TEXT NOT NULL,                -- ISO 8601 PlainDate
  titre                   TEXT NOT NULL,
  montant_ttc_centimes    INTEGER NULL,
  chemin_fichier          TEXT NOT NULL,                -- relatif à baseDir/documents/
  nom_fichier_original    TEXT NOT NULL,
  mime_type               TEXT NOT NULL CHECK (mime_type IN (
    'application/pdf','image/jpeg','image/png','image/webp'
  )),
  taille_octets           INTEGER NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 52428800),
  bien_id                 TEXT NULL REFERENCES bien(id),
  locataire_id            TEXT NULL REFERENCES locataire(id),
  notes                   TEXT NULL,
  cree_le                 TEXT NOT NULL,                -- ISO 8601 PlainDate
  corbeille_le            TEXT NULL,
  raison_corbeille        TEXT NULL,
  -- D-103 défense en profondeur SQL : un justificatif DOIT être rattaché
  CHECK (bien_id IS NOT NULL OR locataire_id IS NOT NULL)
);

-- Indexes partiels sur lignes actives uniquement (D-110)
CREATE INDEX IF NOT EXISTS idx_justificatifs_bien
  ON justificatifs(bien_id) WHERE corbeille_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_justificatifs_locataire
  ON justificatifs(locataire_id) WHERE corbeille_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_justificatifs_date_document
  ON justificatifs(date_document) WHERE corbeille_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_justificatifs_type
  ON justificatifs(type) WHERE corbeille_le IS NULL;

-- Index sur corbeille pour /coffre/corbeille rapide
CREATE INDEX IF NOT EXISTS idx_justificatifs_corbeille
  ON justificatifs(corbeille_le) WHERE corbeille_le IS NOT NULL;

-- Table tickets_travaux (BC Travaux scaffolding — utilisé en 04-03)
-- Pas de champ `nature` (D-115 : qualification fiscale différée Phase 5)
CREATE TABLE IF NOT EXISTS tickets_travaux (
  id                          TEXT PRIMARY KEY,
  bien_id                     TEXT NOT NULL REFERENCES bien(id),
  titre                       TEXT NOT NULL,
  description                 TEXT NOT NULL,
  date_ouverture              TEXT NOT NULL,
  date_cloture                TEXT NULL,
  statut                      TEXT NOT NULL CHECK (statut IN ('ouvert','en_cours','clos','annule')),
  cout_estime_ttc_centimes    INTEGER NULL,
  cout_reel_ttc_centimes      INTEGER NULL,
  notes                       TEXT NULL,
  cree_le                     TEXT NOT NULL,
  annule_le                   TEXT NULL,
  raison_annulation           TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_travaux_bien
  ON tickets_travaux(bien_id) WHERE annule_le IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_travaux_statut
  ON tickets_travaux(statut) WHERE annule_le IS NULL;

-- Table N:N ticket_justificatifs (D-112)
-- Cascade asymétrique D-113 : suppression ticket cascade, suppression justificatif protégée
-- (rétention 10 ans D-109 prime sur cascade ticket).
CREATE TABLE IF NOT EXISTS ticket_justificatifs (
  ticket_id        TEXT NOT NULL REFERENCES tickets_travaux(id) ON DELETE CASCADE,
  justificatif_id  TEXT NOT NULL REFERENCES justificatifs(id),
  PRIMARY KEY (ticket_id, justificatif_id)
);

COMMIT;
