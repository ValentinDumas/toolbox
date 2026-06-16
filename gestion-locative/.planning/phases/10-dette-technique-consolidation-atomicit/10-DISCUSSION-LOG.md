# Phase 10: Dette technique — consolidation & atomicité - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 10-dette-technique-consolidation-atomicit
**Areas discussed:** Sens fusion CFE, Sens unif. IRL, Périmètre transaction, Preuve d'atomicité

---

## Sens fusion CFE

| Option | Description | Selected |
|--------|-------------|----------|
| Partiel neutre, rendu identique | Extraire le markup partagé dans UN partiel sans rien changer au rendu CFE. Zéro régression visuelle, critère #1 respecté. WCAG = décision séparée. | ✓ |
| Fusion vers polymorphe + WCAG | Le bandeau CFE hérite icône+ARIA. Gain accessibilité mais changement DOM observable — viole « affichage identique ». | |
| Tu décides | Claude tranche selon le principe de la phase. | |

**User's choice:** Partiel neutre, rendu identique (→ D-10-01)
**Notes:** Tension WCAG explicitée avant choix (le polymorphe a gagné icône+helpers ARIA que le CFE n'a pas). Partiel unifié paramétré pour préserver les 2 rendus par surface.

---

## Sens unif. IRL

| Option | Description | Selected |
|--------|-------------|----------|
| Enrichissement DANS la fonction | routes/baux.ts passe le 5e arg comme calculer-toutes-alertes ; boucle post-hoc supprimée ; vue lit source.extra.nomLocataire. Domaine pur. | ✓ |
| Enrichissement HORS fonction | Supprimer le 5e arg ; les deux appelants enrichissent après coup. Évite de toucher la vue mais sort du domaine. | |
| Tu décides | Claude tranche selon « domaine pur ». | |

**User's choice:** Enrichissement DANS la fonction (→ D-10-02)
**Notes:** Cohérent avec le principe domaine pur et avec l'appelant de référence calculer-toutes-alertes. Impact template baux assumé, à rendu identique.

---

## Périmètre transaction

| Option | Description | Selected |
|--------|-------------|----------|
| Les deux sites jumeaux | Envelopper appliquer-indexation-irl ET modifier-bail-actif (même faille bail+echeance). Cohérence + atomicité réelle partout. | ✓ |
| Seulement la cible D-94 | Envelopper uniquement appliquer-indexation-irl ; modifier-bail-actif reste en dette. | |
| Tu décides | Claude tranche selon risque + cohérence. | |

**User's choice:** Les deux sites jumeaux (→ D-10-03)

| Option (PDF/fichier) | Description | Selected |
|--------|-------------|----------|
| Hors transaction (DB seule) | Transaction couvre les écritures DB ; write fichier hors (rollback ≠ suppression fichier ; I/O lent). Conforme compensation documentée. | ✓ |
| Dans la transaction | Inclure le PDF dans le bloc transactionnel. Tient la transaction ouverte pendant l'I/O, pas de cleanup fichier sur rollback. | |

**User's choice:** Hors transaction — DB seule (→ D-10-04)
**Notes:** Site jumeau modifier-bail-actif découvert au scout, hors décision D-94 d'origine.

---

## Preuve d'atomicité

| Option (atomicité) | Description | Selected |
|--------|-------------|----------|
| Un test d'injection par site | Un scénario d'échec partiel par site enveloppé (2). Conforme « par scénario ». | ✓ |
| Un test représentatif | Un seul scénario sur appliquer-indexation-irl. Plus léger, ne vérifie pas le 2e site. | |
| Tu décides | Claude tranche le grain. | |

**User's choice:** Un test d'injection par site (→ D-10-05)

| Option (non-régression rendu) | Description | Selected |
|--------|-------------|----------|
| Snapshot de rendu avant/après | Capturer le HTML des partiels/vues touchés et asserter l'égalité. Preuve mécanique du critère #1. | ✓ |
| Suite existante seule | S'appuyer sur la suite verte + UAT humaine Phase 9. Pas de test de rendu dédié. | |
| Tu décides | Claude tranche la stratégie. | |

**User's choice:** Snapshot de rendu avant/après (→ D-10-06)
**Notes:** Point ouvert signalé : critère #4 « suite < 30 s » vise probablement les tests unitaires, pas la suite complète (estimée à plusieurs minutes). À clarifier par le planner.

---

## Claude's Discretion

- Forme exacte du paramétrage du partiel CFE unifié (flag vs variante), tant que les 2 rendus actuels sont préservés.
- Mécanique d'injection d'échec dans les tests d'atomicité.
- Outillage de snapshot de rendu EJS.

## Deferred Ideas

- Amélioration WCAG du bandeau CFE (icône + ARIA) → hors Phase 10 (changement d'affichage observable), à reproposer en phase UI/A11y dédiée.
