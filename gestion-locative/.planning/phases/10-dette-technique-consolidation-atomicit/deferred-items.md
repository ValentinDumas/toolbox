# Deferred Items — Phase 10

Out-of-scope discoveries logged during execution (not fixed, per executor scope boundary).

## Plan 10-04 (atomicité)

| Discovered | Item | Status | Note |
|------------|------|--------|------|
| 2026-06-18 | 3 scénarios BDD `fiscalite-qualification-charges.feature` rouges (natureFiscale/qualification_fiscale attendue "amelioration"/"entretien_reparation", obtenue null) | pre-existing | Confirmé rouge sur le commit de base `abfca36` avec mes 4 fichiers source revertés. Aucun lien avec les fichiers modifiés par 10-04 (modifier-bail-actif.ts, appliquer-indexation-irl.ts, baux.ts, main.ts). Hors périmètre DET-03. |
