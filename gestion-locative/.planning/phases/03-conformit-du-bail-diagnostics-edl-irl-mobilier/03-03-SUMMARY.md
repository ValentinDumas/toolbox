---
phase: 03
plan: 03
plan_id: "03-03"
subsystem: locatif/indexation-irl
tags: [LOC-04, LOC-05, IRL, gel-climat, simulation, banker-rounding]
requires:
  - "03-01 : Bien.estGelLoyer + Bien.classeDpe + ClasseDpe dans _shared"
  - "Phase 1 : IRL VO, Money, BailRepository, BienRepository, Cautionnement"
  - "Phase 2 : Bail.actifDepuis, Money.multiplyByFraction"
provides:
  - "Money.multiplyByRatio(num, den, mode) — accepte num > den (indexation hausse)"
  - "Bail.dateAnniversaireProchaine(today) — pure, Temporal natif clamp bissextile"
  - "Bail.simulerIndexation(irlNouveau, classeDpe) — gel DPE F/G court-circuit, banker"
  - "GelLoyerClimatActif erreur domain (D-92 décret 2022-1313)"
  - "simulerIndexationIRL use case (defense en profondeur)"
  - "listerBailsIndexables use case (limité 03-03, étendu 03-04)"
  - "formaterTrimestreIRL helper (DP-18)"
  - "Routes GET /baux/:id/indexer + POST /baux/:id/indexer/simuler + stub /confirmer"
  - "Wizard views saisie + simulation + gel-loyer + partial banner + wizard-irl-layout"
  - "Zod indexationSaisieSchema (2 formats trimestre acceptés)"
affects:
  - "03-04 consommera Bail.simulerIndexation + GelLoyerClimatActif + listerBailsIndexables (filtrage 12 mois)"
  - "03-05 polira wizard layout + transitions"
  - "Phase 7 dashboard cross-Bien consommera listerBailsIndexables"
tech-stack:
  added: []
  patterns:
    - "Méthode pure sur agrégat domain (DP-20) consommée par use case orchestrateur"
    - "Defense en profondeur cross-aggregate (Bien.estGelLoyer vérifié UI + serveur)"
    - "Additive change sur VO Money (multiplyByRatio ajoute sans casser multiplyByFraction)"
    - "Zod transform pour normaliser format UI français → format canonique domain"
    - "Récursion pure (no-let) pour algorithme itératif (clamp bissextile Temporal)"
    - "Session Fastify pour passer indexationDraft entre étapes wizard"
key-files:
  created:
    - "src/domain/locatif/erreurs.ts (GelLoyerClimatActif ajouté)"
    - "src/application/locatif/simuler-indexation-irl.ts"
    - "src/application/locatif/lister-bails-indexables.ts"
    - "src/helpers/format-trimestre-irl.ts"
    - "src/web/schemas/indexation-schemas.ts"
    - "src/web/routes/indexations.ts"
    - "src/web/views/pages/baux/indexer/saisie.ejs"
    - "src/web/views/pages/baux/indexer/simulation.ejs"
    - "src/web/views/pages/baux/indexer/gel-loyer.ejs"
    - "src/web/views/partials/wizard-irl-layout.ejs"
    - "src/web/views/partials/partial-indexation-banner.ejs"
    - "tests/unit/_shared/money-multiply-by-ratio.test.ts"
    - "tests/unit/locatif/bail-date-anniversaire.test.ts"
    - "tests/unit/locatif/bail-simuler-indexation.test.ts"
    - "tests/unit/locatif/simuler-indexation-irl.test.ts"
    - "tests/unit/locatif/lister-bails-indexables.test.ts"
    - "tests/unit/helpers/format-trimestre-irl.test.ts"
    - "tests/bdd/features/indexation-irl-simulation.feature"
    - "tests/bdd/features/gel-loyer-climat.feature"
    - "tests/bdd/step_definitions/indexation-irl.steps.ts"
  modified:
    - "src/domain/_shared/money.ts (multiplyByRatio ajouté, multiplyByFraction préservé)"
    - "src/domain/locatif/bail.ts (dateAnniversaireProchaine + simulerIndexation)"
    - "src/web/routes/baux.ts (bailIndexable + dateAnniversaire dans GET /baux/:id)"
    - "src/web/views/pages/baux/detail.ejs (banner conditionnel)"
    - "src/main.ts (indexationsPlugin enregistré)"
    - "tests/_builders/locatif.ts (unBailIndexableValide)"
    - "tests/_builders/patrimoine.ts (unBienAvecDpeF + unBienAvecDpeD)"
decisions:
  - "DP-16 résolu : multiplyByRatio nouvelle méthode (additive). multiplyByFraction préservé pour prorata Phase 2."
  - "DP-20 résolu : dateAnniversaireProchaine méthode pure sur Bail (pas service externe)."
  - "Sémantique anniversaire 'atteint maintenant' = +1 an : à today=dateDebut, prochain = dateDebut+1y."
  - "Clamp bissextile 29 fév → 28 fév géré par Temporal natif + boucle d'incrément récursive (couvre cas où Temporal.until retourne N-1 ans + 11 mois + 28 jours)."
  - "Defense en profondeur LOC-05 : Bien.estGelLoyer vérifié à 2 niveaux (UI route + use case) — bypass POST direct rejeté avec 403."
  - "Précision IRL : BigInt sur centièmes (Math.round(valeur * 100)) évite drift float pour loyers réalistes."
  - "Zod transform accepte 2 formats trimestre (UI '1T2026' + domain '2026-T1'), normalise avant IRL.creer."
  - "listerBailsIndexables NE filtre PAS par 'indexation < 12 mois' en 03-03 (BailIndexationRepository créé 03-04). JSDoc documente la limitation."
metrics:
  duration: "≈45 minutes wall-clock"
  completed_date: "2026-05-17"
  task_count: 3
  unit_tests_added: 28
  bdd_scenarios_added: 6
  files_created: 21
  files_modified: 7
---

# Phase 3 Plan 03 : IRL simulation + gel Climat Summary

Vertical slice LOC-04 (partie simulation IRL : banner anniversaire + wizard saisie + calcul banker) combinée à LOC-05 (gel loyer Climat DPE F/G bloque hard avec defense en profondeur server-side).

## Vue d'ensemble

**Périmètre :** étapes 1-3 du wizard IRL (banner sur fiche Bail → saisie IRL → simulation read-only avec tableau comparatif et formule). L'application (étape 4-5 : avenant PDF + régénération échéances + table append-only) est splittée en 03-04.

**Implémentation :** 3 commits atomiques (RED → domain GREEN → web GREEN), 6 scenarios BDD verts, 387 unit tests passants au global (aucune régression Phase 1/2/3-01/3-02).

## Commits

1. `23ed487` — `test(03-03): tests rouges Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + use case + helper + LOC-04 + LOC-05 (Wave 0)`
2. `eaf7c23` — `feat(03-03): Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + GelLoyerClimatActif + use cases simuler/lister + helper trimestre`
3. `1b1f647` — `feat(03-03): routes /baux/:id/indexer wizard étapes 2-3 + schema Zod + 3 views + 2 partials + banner sur fiche Bail + BDD LOC-04 simulation + LOC-05 gel (vert)`

## Patterns établis

- **Additive change sur VO partagé.** `Money.multiplyByRatio` ajouté sans toucher `multiplyByFraction` — l'invariant `0 ≤ num ≤ den` du prorata Phase 2 reste intact. Le nouveau invariant `num >= 0` est plus permissif (cas indexation IRL à la hausse).
- **Méthode pure sur agrégat (DP-20).** `Bail.dateAnniversaireProchaine` + `Bail.simulerIndexation` sont des méthodes read-only sur l'agrégat — pas de copy-on-write, pas de service externe. Consommées par use case lookup-orchestration.
- **Defense en profondeur cross-aggregate.** `Bien.estGelLoyer()` vérifié 2× : route UI (GET render `gel-loyer.ejs`) ET use case `simulerIndexationIRL` (throw `GelLoyerClimatActif` → catch en route renvoie 403 + `gel-loyer.ejs`). Le bypass POST direct est rejeté avant tout calcul.
- **Zod transform format UI → canonique domain.** `indexationSaisieSchema.transform` accepte `'1T2026'` (convention française UI) ET `'2026-T1'` (canonique domain), normalise vers canonique avant `IRL.creer`. Pas de fuite du format UI dans le domaine.
- **Wizard layout EJS dédié métier.** `wizard-irl-layout.ejs` (5 étapes) coexiste avec `wizard-layout.ejs` (3 étapes activation) — chaque flow métier a son step indicator avec aria-current.
- **Récursion pure pour algorithme itératif.** `dateAnniversaireProchaine` utilise une fonction récursive locale `prochainDepuis(n)` pour incrémenter N jusqu'à dépasser `today`, contournant le warning `functional/no-let` tout en gérant le clamp bissextile de Temporal.

## Dépendances pour plans suivants

- **03-04** consommera :
  - `Bail.simulerIndexation` (réutilisé pour rejouer le calcul à l'application)
  - `GelLoyerClimatActif` (catché par la route apply pour defense en profondeur)
  - `listerBailsIndexables` (à étendre avec filtre "dernière indexation < 12 mois" via `BailIndexationRepository` que 03-04 crée)
  - À créer : `Bail.appliquerIndexation` (copy-on-write `loyerHc` + nouveau `irlReference`), `BailIndexation` agrégat append-only, migration `0009_bail_indexations`, use case `appliquerIndexationIRL` transactionnel multi-repos, vues `confirmation.ejs` + `resultat.ejs`, route GET avenant PDF (pdfmake).
- **03-05** polira : empty states, transitions wizard, ARIA live regions, focus management après navigation, copy fine-tuning.
- **Phase 7 dashboard** consommera `listerBailsIndexables` pour afficher les bails actionnables (toutes Biens confondus).

## Décisions clés

- **Bissextile 29 fév clampé par Temporal.** `dateDebut=2024-02-29 + 1y` retourne `2025-02-28` nativement. La sémantique "atteint maintenant = +1 an" force l'itération récursive : si `dateDebut + N ans == today` (cas T15 : 2025-02-28), incrémenter à N+1.
- **Précision banker sur centièmes IRL.** Le ratio `IRL_après / IRL_avant` utilise `BigInt(Math.round(valeur * 100))` pour preserver 2 décimales sans drift float. Banker's rounding (round-half-to-even) sur centimes du résultat évite le biais systématique.
- **Wording exact UI-SPEC** : "Gel loyer Climat actif (DPE F). Toute hausse de loyer est interdite par le décret n° 2022-1313, prorogé. L'indexation ne peut pas être appliquée." — testé strictement dans BDD + unit T23.
- **Stub route confirmer** : `POST /baux/:id/indexer/confirmer` retourne 501 avec message "à venir 03-04" — les tests BDD 03-03 s'arrêtent à l'étape 3.

## Vérifications

- `pnpm tsc --noEmit` : 0 erreur.
- `pnpm lint:deps` : 0 violation (131 modules, 571 dépendances cruisées). Pas de cycle locatif → patrimoine (ClasseDpe vit dans `_shared`).
- `pnpm test` : 387/387 unit tests passent (67 fichiers).
- `pnpm exec cucumber-js` : 66/66 BDD scenarios passent (358 steps), dont 6 nouveaux `@loc-04` + `@loc-05`.
- `pnpm exec cucumber-js --tags '@loc-04 or @loc-05'` : 6/6 passés.
- Non-régression : `Money.multiplyByFraction` invariant 0 ≤ num ≤ den intact (test explicite T9).

## Threat surface scan

| Threat ID | Mitigation appliquée |
|-----------|----------------------|
| T-03-03-01 (bypass UI gel) | `simulerIndexationIRL` throw `GelLoyerClimatActif` avant tout calcul si `bien.estGelLoyer()`. Route catch → 403 + render `gel-loyer.ejs`. Couvert par BDD scenario "DPE F bypass POST refusé". |
| T-03-03-02 (IRL ≤ 0) | `IRL.creer` regex `^\d+(\.\d+)?$` + `parseFloat > 0` (Phase 1). `Money.multiplyByRatio` throw si `den ≤ 0`. Couvert par T5. |
| T-03-03-03 (trimestre invalide) | Zod regex strict `[1-4]` + `IRL.creer` regex `^\d{4}-T[1-4]$`. Couvert par T26. |
| T-03-03-06 (drift float) | BigInt sur centièmes + banker rounding. Fast-check property T8 vérifie écart ≤ 1 centime. |

## Deviations from Plan

**Aucune.** Le plan a été exécuté tel quel à l'exception de :

- **[Rule 1 - Bug]** Sémantique `dateAnniversaireProchaine` ajustée pour le cas bissextile T15. Le plan disait "compare(dateCetAnniversaire, today) > 0 → return dateCetAnniversaire ; sinon return +1 an". Sur dateDebut=2024-02-29 + today=2025-02-28, `Temporal.until` retourne 0 années (car < 1 année calendaire après clamp) → `dateCetAnniversaire = dateDebut + 0 = 2024-02-29 < today` → branche "+1 an" → 2025-02-28. Mais T15 attend 2026-02-28 (sémantique "+1 an si atteint aujourd'hui"). Fix : remplacer le branchement par une boucle récursive qui incrémente N jusqu'à dépasser strictement today. Documenté dans le commit task 2 et la décision ci-dessus.
- **[Rule 1 - Bug]** Filtre `listerBailsIndexables` clarifié. La version initiale utilisait `dateAnniversaireProchaine(today).subtract({years: 1})` comme "dernier anniversaire atteint", mais cela retournait `dateDebut` pour un bail démarré il y a moins d'1 an (faux positif). Fix : filtre direct sur `today >= dateDebut + 1 an`. Cohérent avec la sémantique "anniversaire atteint = au moins une fois écoulée la période annuelle".
- **[Rule 2 - Critical]** Helper `extraireErreurs` dupliqué dans `indexations.ts` car déjà privé dans `baux.ts` (pas d'export). Reproduit localement (3 lignes), pas de refactor d'extraction shared pour éviter scope creep.

## Self-Check: PASSED

Verified:
- `src/domain/_shared/money.ts` modifié (multiplyByRatio présent) — FOUND
- `src/domain/locatif/bail.ts` modifié (2 nouvelles méthodes) — FOUND
- `src/domain/locatif/erreurs.ts` modifié (GelLoyerClimatActif) — FOUND
- `src/application/locatif/simuler-indexation-irl.ts` — FOUND
- `src/application/locatif/lister-bails-indexables.ts` — FOUND
- `src/helpers/format-trimestre-irl.ts` — FOUND
- `src/web/schemas/indexation-schemas.ts` — FOUND
- `src/web/routes/indexations.ts` — FOUND
- 3 views indexer + 2 partials — FOUND
- 6 fichiers unit tests + 2 features + 1 steps file — FOUND
- Commits 23ed487 / eaf7c23 / 1b1f647 — FOUND in git log
- Self-check criteria all satisfied.
