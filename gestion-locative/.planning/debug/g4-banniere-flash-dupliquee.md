---
status: diagnosed
trigger: "Bannière flash dupliquée 4/4 — Test 2 (profil bailleur enregistré), Test 3 (bail activé), Test 8 (quittance générée), Test 9 (quittance annulée). Toutes les bannières flash de succès s'affichent en double."
created: 2026-05-14T00:00:00Z
updated: 2026-05-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Hypothèse (c) : double include de `banniere-success`. Le partial est inclus une fois par `layout-debut.ejs:24` (qui reçoit `locals.banniereSuccess` par héritage du scope EJS), puis ré-inclus directement par chaque page de retour d'action.
test: Lecture du layout, des partials et des pages affectées + traçage des routes correspondantes.
expecting: Identifier le point de double-rendu et le confirmer sur les 4 cas UAT.
next_action: Rapport ROOT CAUSE FOUND retourné à l'orchestrateur — `goal: find_root_cause_only` donc pas de fix appliqué ici.

## Symptoms

expected: Les bannières flash de succès doivent s'afficher une seule fois après une action.
actual:
  - Test 2: "La bannière Profil bailleur enregistré s'affiche deux fois"
  - Test 3: "la bannière écran bail activé Bail activé — 12 échéances générées s'affiche deux fois"
  - Test 8: "Quittance n° 2026-001 générée avec succès s'affiche deux fois"
  - Test 9: "Quittance n° 2026-001 annulée. Le PDF original reste consultable. s'affiche en double"
errors: aucune (cosmétique)
reproduction: Effectuer une action (enregistrer profil bailleur / activer bail / générer ou annuler quittance) → page de retour affiche 2 bannières identiques
started: depuis livraison phase 02

## Eliminated

- hypothesis: (a) double include de `banniere-warning.ejs` + `banniere-success.ejs` dans le layout lui-même
  evidence: `layout-debut.ejs:24` n'inclut QU'UNE seule fois `banniere-success`, et `layout.ejs:24` aussi. Aucun double include côté layout. Donc le doublon ne vient pas du layout seul.
  timestamp: 2026-05-14T00:00:00Z

- hypothesis: (b) cookie session `banniereSuccess` + query param `?avertissement=` concurrents
  evidence: Le query param `?avertissement=` n'est lu QUE dans `baux.ts:254-256` pour produire un `banniereWarning` (et pas un success). De plus, les 4 cas UAT sont tous des SUCCESS, et aucune des routes correspondantes n'utilise un query param success. La double émission n'est donc PAS due à un canal session + query concurrents pour ces 4 cas.
  timestamp: 2026-05-14T00:00:00Z

## Evidence

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/partials/layout-debut.ejs (lignes 1-25)
  found: Ligne 24 — `<%- include('banniere-success', { message: locals.banniereSuccess ?? null }) %>` (rendu N°1 de la bannière). Donc TOUTES les pages qui démarrent par `include('layout-debut')` héritent déjà d'un rendu de la bannière success.
  implication: Le layout fait déjà l'affichage de la bannière à partir du `banniereSuccess` propagé par EJS via le scope partagé des locals.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/partials/layout.ejs (lignes 1-29)
  found: Ligne 24 — même include `banniere-success`. Layout monolithique alternatif, non pertinent ici car les 4 pages buggées utilisent toutes le couple `layout-debut`/`layout-fin`.
  implication: Aucune dépendance.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/partials/banniere-success.ejs (lignes 1-5)
  found: Partial très simple — `if (locals.message)` → rend une `<aside class="banniere-success">` avec le message. Pas de logique défensive contre double rendu.
  implication: Si le partial est appelé deux fois avec un message non vide, deux `<aside>` apparaissent dans le DOM.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/pages/bailleur/profil.ejs (lignes 1-9)
  found: Ligne 1-5 inclut `layout-debut` (rendu N°1 via le layout). Ligne 7-9 fait `if (locals.banniereSuccess) include('../../partials/banniere-success', { message: banniereSuccess })` (rendu N°2). DOUBLE RENDU CONFIRMÉ pour Test 2.
  implication: Test 2 (Profil bailleur enregistré) — root cause identique au pattern : layout-debut + ré-include explicite.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/pages/baux/detail.ejs (lignes 1-10)
  found: Ligne 1-5 inclut `layout-debut` (rendu N°1). Ligne 9 — `<%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>` (rendu N°2). DOUBLE RENDU CONFIRMÉ pour Test 3.
  implication: Test 3 (Bail activé — N échéances générées) — POST `/baux/:id/activer` dans `echeances.ts:119` met `req.session.banniereSuccess`, redirige vers `/baux/:id`, GET dans `baux.ts:247-271` lit la session et passe `banniereSuccess` à `pages/baux/detail.ejs` → double rendu.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/pages/quittances/fiche.ejs (lignes 1-11)
  found: Ligne 1-8 inclut `layout-debut` (rendu N°1). Ligne 10 — `<%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>` (rendu N°2). DOUBLE RENDU CONFIRMÉ pour Tests 8 et 9.
  implication: Tests 8 (Quittance générée) et 9 (Quittance annulée) — POST dans `quittances.ts:104` et `quittances.ts:214` met `req.session.banniereSuccess`, redirige vers `/quittances/:id`, GET lit la session et passe `banniereSuccess` à `pages/quittances/fiche.ejs` → double rendu.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/pages/quittances/liste.ejs (lignes 1-8)
  found: Même pattern. `layout-debut` (rendu N°1) + ligne 7 ré-include `banniere-success` (rendu N°2). Page non testée dans les 4 cas UAT mais SUSCEPTIBLE de produire le même bug si une action redirige vers `/quittances` avec un banniereSuccess en session (ex: warning fallback dans `quittances.ts:117-118`).
  implication: Bug systémique sur la couche vue, pas un cas isolé.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/pages/relances/liste.ejs (lignes 1-13)
  found: Même pattern. `layout-debut` (rendu N°1) + ligne 11-13 ré-include `banniere-success` (rendu N°2). Page non testée dans les 4 cas UAT mais SUSCEPTIBLE.
  implication: 5e occurrence du même anti-pattern. Confirme le caractère systémique.

- timestamp: 2026-05-14T00:00:00Z
  checked: `grep` exhaustif `include.*banniere-success` dans src/web/views/pages/
  found: 5 fichiers concernés au total — profil.ejs, baux/detail.ejs, quittances/fiche.ejs, quittances/liste.ejs, relances/liste.ejs. Tous suivent le même anti-pattern.
  implication: Le fix doit choisir UN canal unique (soit dans le layout, soit dans les pages) — pas les deux.

- timestamp: 2026-05-14T00:00:00Z
  checked: src/web/views/partials/banniere-warning.ejs et warning-live.ejs côté layout
  found: `layout-debut.ejs` n'inclut PAS de bannière warning. Les warnings ne sont donc PAS doublés côté layout. Cohérent avec le rapport UAT (les 4 cas concernent uniquement des SUCCESS, pas des WARNING).
  implication: Le fix est asymétrique — seules les bannières SUCCESS sont à corriger.

## Resolution

root_cause: "Anti-pattern systémique de double include du partial `banniere-success.ejs`. `src/web/views/partials/layout-debut.ejs:24` inclut déjà `banniere-success` avec `locals.banniereSuccess` (rendu N°1 automatique pour toutes les pages utilisant ce layout). Les 5 pages affectées (profil bailleur, baux/detail, quittances/liste, quittances/fiche, relances/liste) ré-incluent ensuite explicitement `banniere-success` avec le même `locals.banniereSuccess` → 2 `<aside class=\"banniere-success\">` identiques dans le DOM. Cause directe des 4 bugs UAT (Tests 2, 3, 8, 9). Les bannières warning ne sont pas affectées car `layout-debut` ne les inclut pas."
fix: "Choisir UN canal unique. Option recommandée : SUPPRIMER les ré-includes dans les 5 pages (lignes 7-9 de profil.ejs, ligne 9 de baux/detail.ejs, ligne 7 de quittances/liste.ejs, ligne 10 de quittances/fiche.ejs, lignes 11-13 de relances/liste.ejs) et laisser uniquement `layout-debut.ejs:24` rendre la bannière. Cela centralise l'affichage et garantit l'unicité. Option alternative (déconseillée) : retirer l'include du layout — moins bonne car oblige chaque page à se rappeler de l'inclure manuellement."
verification: ""
files_changed: []
