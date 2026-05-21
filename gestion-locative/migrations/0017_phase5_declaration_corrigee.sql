-- Migration 0017 — Phase 5 Plan 06 : DeclarationCorrigee append-only (D-FIS-G4.4)
--
-- Table declarations_corrigees : N corrections successives d'une DeclarationAnnuelle.
-- PAS d'UNIQUE — N corrections autorisées sur la même déclaration originale.
-- La déclaration originale reste INTACTE (append-only strict D-FIS-G4.4).
--
-- Sources juridiques :
--   D-FIS-G4.4 : append-only, originale intouchée
--   T-05-06-09 : threat mitigation — creer-declaration-corrigee NE modifie pas l'originale

BEGIN;

CREATE TABLE IF NOT EXISTS declarations_corrigees (
  id                              TEXT NOT NULL PRIMARY KEY,
  declaration_originale_id        TEXT NOT NULL REFERENCES declarations_annuelles(id),
  motif                           TEXT NOT NULL,
  recettes_totales_centimes       INTEGER NOT NULL,
  charges_qualifiees_json         TEXT NOT NULL,
  dotation_amortissement_centimes INTEGER NOT NULL DEFAULT 0,
  ard_genere_centimes             INTEGER NOT NULL DEFAULT 0,
  ard_consomme_centimes           INTEGER NOT NULL DEFAULT 0,
  revenus_foyer_snapshot_centimes INTEGER NULL,
  statut_lmnp_lmp                 TEXT NOT NULL CHECK (statut_lmnp_lmp IN (
    'lmnp_confirme',
    'lmp_probable',
    'indetermine_revenus_foyer_manquants'
  )),
  regime_applique                 TEXT NOT NULL CHECK (regime_applique IN ('micro_bic', 'reel')),
  cree_le                         TEXT NOT NULL
);

-- Index pour tri chronologique DESC par déclaration originale
CREATE INDEX IF NOT EXISTS idx_decl_corr_originale
  ON declarations_corrigees (declaration_originale_id, cree_le DESC);

COMMIT;
