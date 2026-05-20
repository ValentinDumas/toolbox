-- Migration 0015 — Phase 5 : Extension Bailleur — données fiscales
-- Décisions :
--   D-LOCK-2 : Phase 5 = single-bailleur, single-foyer V1 — le régime fiscal est porté par Bailleur
--   D-FIS-G3.1 : Snapshot annuel via wizard de clôture + champ courant sur Bailleur (pré-remplissage)
--   D-FIS-G5.4 : Onboarding fiscal progressif — Bailleur.fiscalite_premier_acces trace le premier accès
-- Idempotent via mécanisme meta table (appliquerMigrationsBrutes).
-- Note : ALTER TABLE … ADD COLUMN ne supporte pas IF NOT EXISTS en SQLite.

BEGIN TRANSACTION;

-- D-LOCK-2 + D-FIS-G4.3 : régime fiscal courant (null = non encore choisi / auto-déduit)
ALTER TABLE bailleur ADD COLUMN regime_fiscal TEXT NULL
  CHECK (regime_fiscal IS NULL OR regime_fiscal IN (
    'micro_bic',
    'reel'
  ));

-- D-FIS-G3.1 : revenus actifs annuels courant (centimes) — pré-remplissage wizard clôture
-- Null = non encore renseigné (utilisateur n'a pas encore traversé le wizard)
ALTER TABLE bailleur ADD COLUMN revenus_actifs_annuels_courant_centimes INTEGER NULL;

-- D-FIS-G5.4 : trace du premier accès à l'écran Fiscalité — ISO 8601 PlainDateTime
-- Null = jamais ouvert l'écran fiscal (onboarding progressif)
ALTER TABLE bailleur ADD COLUMN fiscalite_premier_acces TEXT NULL;

COMMIT;
