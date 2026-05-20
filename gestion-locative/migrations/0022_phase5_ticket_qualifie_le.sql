-- Migration 0022 — Phase 5 : Colonne qualifie_le_ticket sur tickets_travaux
-- Complète la migration 0021 qui ajoutait nature et nature_fiscale.
-- Décision D-FIS-G2.3 : audit trail de la date de qualification du ticket entier.
-- Idempotent via mécanisme meta table (appliquerMigrationsBrutes).

BEGIN TRANSACTION;

ALTER TABLE tickets_travaux ADD COLUMN qualifie_le_ticket TEXT NULL;

COMMIT;
