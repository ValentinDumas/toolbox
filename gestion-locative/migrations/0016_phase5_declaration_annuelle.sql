-- Migration 0016 — Phase 5 Plan 06 : DeclarationAnnuelle append-only (D-FIS-G4.2)
--
-- Table déclarations_annuelles : snapshot fiscal annuel LMNP.
-- Append-only strict : UNIQUE (bailleur_id, exercice) — une seule clôture par bailleur+année.
-- Correction post-clôture → declarations_corrigees (migration 0017).
--
-- Sources juridiques :
--   CGI art. 50-0 (micro-BIC seuil 83 600 €)
--   CGI art. 39 / 39 B (régime réel + ARD)
--   CGI art. 155 IV (LMNP/LMP)
--   D-FIS-G4.1 : prérequis clôture
--   D-FIS-G4.2 : snapshot par valeur — immutable post-création

BEGIN;

CREATE TABLE IF NOT EXISTS declarations_annuelles (
  id                             TEXT NOT NULL PRIMARY KEY,
  bailleur_id                    TEXT NOT NULL REFERENCES bailleur(id),
  exercice                       INTEGER NOT NULL,
  regime_applique                TEXT NOT NULL CHECK (regime_applique IN ('micro_bic', 'reel')),
  recettes_totales_centimes      INTEGER NOT NULL,
  charges_qualifiees_json        TEXT NOT NULL,
  dotation_amortissement_centimes INTEGER NOT NULL DEFAULT 0,
  ard_genere_centimes            INTEGER NOT NULL DEFAULT 0,
  ard_consomme_centimes          INTEGER NOT NULL DEFAULT 0,
  revenus_foyer_snapshot_centimes INTEGER NULL,
  statut_lmnp_lmp                TEXT NOT NULL CHECK (statut_lmnp_lmp IN (
    'lmnp_confirme',
    'lmp_probable',
    'indetermine_revenus_foyer_manquants'
  )),
  composants_snapshot_json       TEXT NOT NULL DEFAULT '[]',
  cloture_le                     TEXT NOT NULL,
  UNIQUE (bailleur_id, exercice)
);

COMMIT;
