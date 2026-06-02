-- Migration 0023 — Phase 6 Plan 06 : DeclarationCfe — suivi déclaratif CFE 1447-C-SD
--
-- Table declarations_cfe : agrégat racine BC Fiscalité (D-CFE6.2).
-- Upsert idempotent sur (bien_id, millesime) — édition autorisée (différent de DeclarationAnnuelle append-only).
--
-- Sources juridiques :
--   CGI art. 1447 : redevables CFE.
--   CGI art. 1478 II : exonération de plein droit l'année de création.
--   D-CFE6.2 : agrégat référence BienId par identifiant (jamais sous-agrégat).
--   D-CFE6.3 : 5 statuts strict + invariants dépôt/montant.
--   D-CFE6.4 : aide pédagogique première année — PAS de calcul de base imposable.

BEGIN;

CREATE TABLE IF NOT EXISTS declarations_cfe (
  id                       TEXT NOT NULL PRIMARY KEY,
  bien_id                  TEXT NOT NULL REFERENCES bien(id),
  millesime                INTEGER NOT NULL,
  statut                   TEXT NOT NULL CHECK (statut IN (
    'non_deposee',
    'deposee',
    'exoneree_premiere_annee',
    'exoneree_commune',
    'payee'
  )),
  date_depot_declaration   TEXT NULL,
  montant_avis_centimes    INTEGER NULL,
  date_echeance_paiement   TEXT NOT NULL,
  UNIQUE (bien_id, millesime)
);

COMMIT;
