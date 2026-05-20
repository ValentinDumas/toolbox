-- Migration 0014 — Phase 5 : Qualification fiscale des justificatifs
-- Décisions :
--   D-FIS-G2.1 : Qualification différée via écran "Qualifier les charges {année}"
--   D-FIS-G2.2 : Taxonomie 4 catégories alignée 2033-A (+ non_qualifie par défaut)
--   D-FIS-G2.5 : Reclassement libre tant que brouillon, bloqué après clôture
--   D-FIS-G2.6 : Multi-biens via parent_justificatif_id (FK self) — split obligatoire
--   D-FIS-G2.11 : Date de rattachement = datePaiement (fallback dateDocument)
-- Idempotent via mécanisme meta table (appliquerMigrationsBrutes).
-- Note : ALTER TABLE … ADD COLUMN ne supporte pas IF NOT EXISTS en SQLite.

BEGIN TRANSACTION;

-- D-FIS-G2.1 : statut qualification_fiscale — NULL = non encore attribué (différent de 'non_qualifie' actif)
ALTER TABLE justificatifs ADD COLUMN qualification_fiscale TEXT NULL
  CHECK (qualification_fiscale IS NULL OR qualification_fiscale IN (
    'non_qualifie',
    'entretien_reparation',
    'amelioration',
    'charge_courante_periodique',
    'non_deductible'
  ));

-- D-FIS-G2.5 : date de qualification (audit trail)
ALTER TABLE justificatifs ADD COLUMN qualifie_le TEXT NULL;

-- D-FIS-G2.11 : date de paiement effectif — rattachement fiscal par encaissement
ALTER TABLE justificatifs ADD COLUMN date_paiement TEXT NULL;

-- D-FIS-G2.6 : lien parent → enfants pour split multi-biens
ALTER TABLE justificatifs ADD COLUMN parent_justificatif_id TEXT NULL REFERENCES justificatifs(id);

-- Index partiel pour le compteur "X justificatifs à qualifier" (D-FIS-G2.1, S2 UI-SPEC)
CREATE INDEX IF NOT EXISTS idx_justificatifs_qualification_pending
  ON justificatifs(qualification_fiscale)
  WHERE qualification_fiscale = 'non_qualifie' AND corbeille_le IS NULL;

-- Index FK self pour navigation parent → enfants (D-FIS-G2.6)
CREATE INDEX IF NOT EXISTS idx_justificatifs_parent
  ON justificatifs(parent_justificatif_id)
  WHERE parent_justificatif_id IS NOT NULL;

COMMIT;
