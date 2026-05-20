-- Migration 0021 — Phase 5 : Extension tickets_travaux — nature et nature fiscale
-- Décisions :
--   D-FIS-G1.2 : Mobilier hybride — ajouts via TicketTravaux avec nature='acquisition_mobilier'
--   D-FIS-G2.3 : Qualification portée par le TicketTravaux entier
-- Note : D-115 avait différé la colonne nature de Phase 4 à Phase 5.
-- Idempotent via mécanisme meta table (appliquerMigrationsBrutes).
-- Note : ALTER TABLE … ADD COLUMN ne supporte pas IF NOT EXISTS en SQLite.

BEGIN TRANSACTION;

-- D-FIS-G1.2 : nature du ticket — 'acquisition_mobilier' est nouveau en Phase 5
-- Les valeurs 'entretien', 'amelioration', 'autre' complètent les cas généraux
ALTER TABLE tickets_travaux ADD COLUMN nature TEXT NULL
  CHECK (nature IS NULL OR nature IN (
    'acquisition_mobilier',
    'entretien',
    'amelioration',
    'autre'
  ));

-- D-FIS-G2.3 : nature fiscale du ticket (héritée par tous les justificatifs liés)
-- Aligné sur la taxonomie QualificationFiscale 5 valeurs
ALTER TABLE tickets_travaux ADD COLUMN nature_fiscale TEXT NULL
  CHECK (nature_fiscale IS NULL OR nature_fiscale IN (
    'non_qualifie',
    'entretien_reparation',
    'amelioration',
    'charge_courante_periodique',
    'non_deductible'
  ));

COMMIT;
