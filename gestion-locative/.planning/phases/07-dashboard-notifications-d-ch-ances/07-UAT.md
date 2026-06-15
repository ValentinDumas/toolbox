---
status: complete
phase: 07-dashboard-notifications-d-ch-ances
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md]
started: 2026-06-15T15:33:00+02:00
updated: 2026-06-15T16:32:00+02:00
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Tuer le serveur, repartir propre, relancer depuis zéro. Le serveur boote sans erreur, migrations/seed passent, et GET / renvoie le tableau de bord avec données réelles.
result: pass

### 2. Tableau de bord par défaut
expected: Ouvrir la racine de l'app (GET /). Affiche le tableau de bord avec 4 sections empilées — Alertes critiques, Impayés, Actions du jour (relances + révisions IRL), Échéances à venir. La page n'est plus une redirection vers /biens.
result: pass

### 3. Sidebar — "Tableau de bord" en 1ère position
expected: Dans la navigation latérale, "Tableau de bord" apparaît en première entrée. Quand on est sur /, l'entrée est marquée comme page active (surbrillance / aria-current).
result: pass

### 4. Alertes critiques affichées et triées
expected: Quand des échéances approchent (CFE J-30, diagnostic DPE/gaz/élec expirant, fenêtre IRL, fin de bail), elles apparaissent dans Alertes critiques, triées par urgence (jours restants croissant), chacune avec un libellé clair et un lien d'action.
result: issue
reported: "La section avec 'Voir le diagnostic' s'affiche bien, mais 404 quand je clique sur le bouton 'Voir le diagnostic'."
severity: major

### 5. État zen "Vous êtes à jour"
expected: Si aucune alerte, aucun impayé et aucune échéance à venir, le tableau de bord affiche un état rassurant "Vous êtes à jour" plutôt que des sections vides.
result: pass

### 6. Page révisions IRL (/baux/indexations)
expected: Naviguer vers /baux/indexations affiche un tableau des baux à réviser (IRL), avec nom du locataire et adresse. Les biens gelés (DPE F/G) et les baux déjà indexés cette année sont exclus. Empty-state si rien à réviser. Action "Lancer la révision" disponible.
result: pass

### 7. Accessibilité clavier & ARIA
expected: Parcourir le tableau de bord et la page IRL au clavier (Tab). Le focus est visible, chaque section a un titre/heading, les liens et le tableau sont atteignables au clavier, pas de piège au focus.
result: pass

## Summary

total: 7
passed: 6
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Cliquer sur 'Voir le diagnostic' depuis une alerte critique ouvre la page du diagnostic concerné"
  status: failed
  reason: "User reported: La section avec 'Voir le diagnostic' s'affiche bien, mais 404 quand je clique sur le bouton 'Voir le diagnostic'."
  severity: major
  test: 4
  root_cause: "alerte-diagnostic.ts:62 — urlAction = /biens/{bienId}/diagnostics#diag-{type} pointe vers une route GET inexistante (seules /biens/:id/diagnostics/nouveau et POST /biens/:id/diagnostics existent) ET une ancre #diag-{type} absente des vues. La page réelle qui liste les diagnostics est GET /biens/:id (detail.ejs, 200)."
  artifacts:
    - path: "src/domain/patrimoine/alerte-diagnostic.ts"
      issue: "urlAction vers route/ancre inexistante (ligne 62)"
  missing:
    - "Corriger urlAction vers une cible existante (ex: /biens/{bienId} + ancre réelle dans detail.ejs), OU ajouter la route GET /biens/:id/diagnostics + ancre #diag-{type}"
  debug_session: ""
</content>
</invoke>
