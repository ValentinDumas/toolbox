# Deferred Items — Phase 10

Out-of-scope discoveries logged during execution (not fixed, per executor scope boundary).

## Plan 10-04 (atomicité)

| Discovered | Item | Status | Note |
|------------|------|--------|------|
| 2026-06-18 | 3 scénarios BDD `fiscalite-qualification-charges.feature` rouges (natureFiscale/qualification_fiscale attendue "amelioration"/"entretien_reparation", obtenue null) | pre-existing | Confirmé rouge sur le commit de base `abfca36` avec mes 4 fichiers source revertés. Aucun lien avec les fichiers modifiés par 10-04 (modifier-bail-actif.ts, appliquer-indexation-irl.ts, baux.ts, main.ts). Hors périmètre DET-03. |

## Revue de code Phase 10 (10-REVIEW.md)

Triés à la clôture de phase. CR-02 (introduit par 10-01) corrigé dans le commit `fix(10-05)`. Les deux suivants sont **pré-existants** (absents du diff de la phase) — hors périmètre « dette technique sans changement de comportement », à traiter dans une phase dédiée.

| Discovered | Item | Status | Note |
|------------|------|--------|------|
| 2026-06-18 | CR-01 — `appliquer-indexation-irl.ts` : si `aRegenerer.length > 0` mais `bailModifie.actifDepuis === null`, `supprimerLot` s'exécute sans `enregistrerBatch` → suppression d'échéances sans régénération | pre-existing | Logique de garde **inchangée** vs base `510d329` ; 10-04 n'a fait que l'envelopper dans une transaction. Atteignabilité douteuse (bail actif ⇒ `actifDepuis` non null). Recommandation : poser l'invariant avant la transaction. |
| 2026-06-18 | CR-03 — `baux.ts:~700` : `cautionnement` toujours remis à `null` lors d'une modification de bail (spread `cautionnement !== undefined` toujours vrai car type `Cautionnement \| null`) | pre-existing | `cautionnement` n'apparaît pas dans le diff de la Phase 10. Bug de formulaire pré-existant, hors périmètre DET. |
