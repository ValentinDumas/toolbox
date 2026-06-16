# Phase 9: Finition qualité — clôture UAT & réconciliation des statuts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 9-finition-qualit-cl-ture-uat-r-conciliation-des-statuts
**Areas discussed:** Méthode d'exécution UAT, Correctifs déjà livrés ou non, Politique de traitement des écarts, Preuve & traçabilité

---

## Correctifs déjà livrés ou non (tranché par vérification code, pas par question)

Question de code, pas de vision → investiguée via un agent Explore sur le code courant. Résultat : les 4 défauts diagnostiqués (g1, g4, g8, scope_change locataire/bail) sont **tous déjà corrigés**. Conséquence : QUA-02 = réconciliation pure de statuts, pas de bug-fixing. Détail file:line dans CONTEXT.md §Code Insights.

---

## Méthode d'exécution UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Hybride | Auto (Playwright) pour le mécanique, humain pour le perceptuel (PDF s'ouvre, accents Excel) | ✓ |
| 100% humain | Bailleur déroule les 12 scénarios via /gsd-verify-work 6 | |
| 100% automatisé | Tout via Playwright/qa-pass, ouverture PDF/CSV par parsing | |

**User's choice:** Hybride (recommandé)
**Notes:** Plusieurs scénarios liasse (PDF lisible, accents Excel/LibreOffice) sont irréductiblement humains → ne pas les automatiser en faux-positif.

---

## Politique de traitement des écarts

| Option | Description | Selected |
|--------|-------------|----------|
| Tri par gravité | Bloquant (fiscal/export/crash) = fix en Phase 9 ; cosmétique = backlog, pass-with-note | ✓ |
| Tout corriger (0 écart) | Tout écart, même cosmétique, corrigé avant clôture | |
| Bloquants seuls, reste différé | Seuls les défauts faussant la liasse/export corrigés ; reste en Phase 10/backlog | |

**User's choice:** Tri par gravité (recommandé)
**Notes:** Respecte le critère #2 du roadmap (0 pending) via clôture cosmétique en pass-with-note.

---

## Preuve & traçabilité

| Option | Description | Selected |
|--------|-------------|----------|
| Re-test live ciblé | Rejouer le scénario concret de chaque issue + citer le commit/file:line du fix | ✓ |
| Preuve code seule | Pointer le commit/file:line uniquement | |
| Re-test live complet | Rejouer intégralement les UAT 02/03 stale | |

**User's choice:** Re-test live ciblé (recommandé)
**Notes:** Double preuve comportement + trace code, sans la redondance d'un re-run complet des UAT déjà vérifiées.

---

## Claude's Discretion

- Lieu de consignation (D-05) : mise à jour des fichiers d'origine en place + rapport Phase 9 consolidé. Tranché par défaut au nom du principe « audit-friendly », sans objection de l'utilisateur. Format exact du rapport laissé au planner.

## Deferred Ideas

- Corrections cosmétiques non-bloquantes découvertes pendant l'UAT → backlog.
- Dette technique (partials CFE, `calculerAlertesIrl`, transaction Kysely) → Phase 10 (DET-01/02/03).
