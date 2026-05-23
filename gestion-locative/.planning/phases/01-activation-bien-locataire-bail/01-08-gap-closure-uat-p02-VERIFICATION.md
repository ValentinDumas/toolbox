---
phase: 01-activation-bien-locataire-bail
plan: "08"
verified: 2026-05-16T09:48:00Z
status: gaps_found
score: 17/19 must-haves verified
overrides_applied: 0
gaps:
  - truth: "ROADMAP.md §Phase 1 contient un nouveau critère #6 : 'L'utilisateur peut interrompre le wizard après l'étape Bien ou Locataire et reprendre plus tard — meta.wizard_complete est posé et la sortie est tracée dans les logs.'"
    status: failed
    reason: "Le plan exigeait explicitement d'AJOUTER un critère #6 dans ROADMAP.md §Phase 1 success_criteria (output section, mitigation m11). Ce critère est absent dans .planning/ROADMAP.md. Aucune ligne ne mentionne wizard_complete, interrompre, ou critère 6."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Critère #6 absent — Phase 1 success_criteria s'arrête à 5 critères."
    missing:
      - "Ajouter à .planning/ROADMAP.md §Phase 1 success_criteria : '6. L'utilisateur peut interrompre le wizard après l'étape Bien ou Locataire et reprendre plus tard via les listes — meta.wizard_complete est posé et la sortie est tracée dans les logs (event: wizard_complete, step: bien|locataire).'"
  - truth: "ROADMAP.md progress table indique Phase 1 comme 8/8 plans Completed (7 plans originaux + plan 01-08 gap closure)."
    status: failed
    reason: "La table de progression dans .planning/ROADMAP.md ligne 144 affiche '6/7 | In Progress' pour Phase 1. Plan 08 n'est pas comptabilisé. La valeur Plans reste 7 au lieu de 8 et le statut reste In Progress."
    artifacts:
      - path: ".planning/ROADMAP.md"
        issue: "Ligne 38 : '7/7 plans executed' mais Plan 08 ajouté post-coup. Ligne 144 : '6/7 | In Progress' — non mis à jour."
    missing:
      - "Mettre à jour .planning/ROADMAP.md : Plans: 8/8 plans executed ; table progress ligne Phase 1 → '8/8 | Completed | 2026-05-16'"
---

# Plan 01-08 : Gap Closure UAT-P02 — Rapport de vérification

**Phase Goal :** Fermeture des 2 gaps UAT Phase 02 — (G1) validation inline sans JSON 500, (G2) wizard interruptible après étape Bien ou Locataire.
**Vérifié le :** 2026-05-16
**Statut :** gaps_found
**Re-vérification :** Non — vérification initiale du plan 08

---

## Résumé

Les 17 must-haves techniques (code + tests) sont vérifiés à 100 %. Les 2 gaps sont des obligations de documentation de sortie (ROADMAP.md) explicitement requises par le plan et absentes du dépôt. Ils sont bloquants pour considérer le plan clos.

---

## Truths observables

| #  | Truth                                                                                                             | Statut      | Preuve                                                                                                       |
|----|-------------------------------------------------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------------------------------------|
| 1  | Soumettre wizard Bien avec lot appartement sans surface → 200 HTML avec erreur sous `lots[0].surface` (pas JSON 500) | VERIFIED | `wizard-validation-erreurs.test.ts` cas 1 vert ; `lotCreationSchema.superRefine` pose issue path=['surface']  |
| 2  | Soumettre wizard Locataire avec email invalide → 200 HTML, erreur sous `email`, valeurs préservées                | VERIFIED    | `wizard-validation-erreurs.test.ts` cas 2 vert ; valeurs nom/prenom contenues dans le body HTML               |
| 3  | Toute exception non catchée interceptée par `setErrorHandler` global — HTML pour text/html, JSON sinon           | VERIFIED    | `src/main.ts:148` `app.setErrorHandler` ; `wizard-validation-erreurs.test.ts` cas 5 et 6 verts               |
| 4  | `lotCreationSchema` exige `surface > 0` via `superRefine` pour appartement et local_commercial                   | VERIFIED    | `src/web/schemas/bien-schemas.ts:18-31` ; 4 tests unit `bien-schemas.test.ts` 100 % verts                    |
| 5  | `pages/erreur.ejs` rend layout HTML complet avec `<header>` et `<aside role="alert">` (a11y)                     | VERIFIED    | Fichier existant — contient `layout-debut` (inclut `<header>`) et `<aside role="alert">` lignes 8-11          |
| 6  | Wizard étape Bien propose 2 actions : "Continuer" ET "Terminer plus tard"                                        | VERIFIED    | `wizard/bien.ejs:107-108` — 2 boutons submit avec `formaction="/wizard/bien"` et `formaction="/wizard/bien?terminer=1"` |
| 7  | Cliquer "Terminer plus tard" depuis Bien → Bien créé seul + `meta.wizard_complete=1` + redirect `/biens` + banner | VERIFIED   | `wizard.ts:120-126` ; `wizard-skippable.test.ts` cas 1 vert (302 /biens, countBien=1, countLoc=0, meta=1)    |
| 8  | Étape Locataire propose CTA "Terminer — ajouter le bail plus tard"                                               | VERIFIED    | `wizard/locataire.ejs:79-80` — 2 boutons submit avec `formaction="/wizard/locataire?terminer=1"`               |
| 9  | Sur `/biens/:id`, CTA "Ajouter un locataire pour ce bien" visible                                                | VERIFIED    | `biens/detail.ejs:31` — `<a href="/locataires/nouveau?bienId=<%= bien.id %>">`                                |
| 10 | Sur `/biens/:id`, CTA "Créer un bail sur ce bien" visible                                                        | VERIFIED    | `biens/detail.ejs:33` — `<a href="/baux/nouveau?bienId=<%= bien.id %>">`                                      |
| 11 | Après skip Bien (biensCount=1, locatairesCount=0), `/baux` → empty state "Impossible de créer un bail" + CTA "Créer un locataire" | VERIFIED | `wizard-skippable.test.ts` cas 3 vert — body contient "Impossible de créer un bail" et "Créer un locataire" |
| 12 | Après skip Locataire (biensCount=1, locatairesCount=1, baux=0), `/baux` → empty state "Aucun bail pour l'instant" + CTA "Créer un bail" | VERIFIED | `wizard-skippable.test.ts` cas 4 vert — body contient "Aucun bail pour l&#39;instant" et "Créer un bail" |
| 13 | Décision UX : redirect vers `/biens` après "Terminer plus tard" (objet métier principal V1 LMNP)                 | VERIFIED    | `wizard.ts:125` et `wizard.ts:198` — `reply.redirect('/biens')` dans les deux branches terminer              |
| 14 | Invariant domaine : `Bien` peut exister sans `Locataire` ni `Bail` (aucune référence dans bien.ts)               | VERIFIED    | grep `bailId\|locataireId` dans `src/domain/patrimoine/bien.ts` → 0 résultat ; test unit `bien.test.ts:100` vert |
| 15 | Scenario BDD `@gap-closure` 1 "Bug G1" vert                                                                      | VERIFIED    | `pnpm test:bdd` — 39/39 scenarios verts ; scénario ligne 39 `activation.feature` taggé `@gap-closure`        |
| 16 | Scenario BDD `@gap-closure` 2 "Wizard skippable — Bien seul" vert                                               | VERIFIED    | 39/39 BDD verts ; scénario ligne 49 `activation.feature`                                                     |
| 17 | Scenario BDD `@gap-closure` 3 "Wizard skippable — Locataire sans Bail" vert                                     | VERIFIED    | 39/39 BDD verts ; scénario ligne 60 `activation.feature`                                                     |
| 18 | ROADMAP.md §Phase 1 contient un nouveau critère #6 sur le wizard skippable                                       | FAILED      | Absent — `grep wizard_complete ROADMAP.md` → 0 résultat. Critère #6 non ajouté.                              |
| 19 | ROADMAP.md progress table Phase 1 indique 8/8 Completed                                                         | FAILED      | Ligne 144 affiche "6/7 \| In Progress" — ni le plan 08 ni le statut Completed ne sont reflétés.              |

**Score : 17/19 truths vérifiées**

---

## Artefacts requis

| Artefact                                                         | Fournit                                                     | Niveau 1 Existe | Niveau 2 Substantiel | Niveau 3 Câblé | Statut    |
|------------------------------------------------------------------|-------------------------------------------------------------|-----------------|----------------------|----------------|-----------|
| `src/web/routes/wizard.ts`                                       | try/catch sur creerBien/creerLocataire/creerBail + ?terminer=1 | Oui          | Oui                  | Oui            | VERIFIED  |
| `src/main.ts`                                                    | app.setErrorHandler global HTML/JSON                        | Oui             | Oui                  | Oui            | VERIFIED  |
| `src/web/schemas/bien-schemas.ts`                                | lotCreationSchema avec superRefine surface                  | Oui             | Oui                  | Oui            | VERIFIED  |
| `src/web/views/pages/wizard/bien.ejs`                            | 2 boutons submit (continuer / terminer)                     | Oui             | Oui                  | Oui            | VERIFIED  |
| `src/web/views/pages/wizard/locataire.ejs`                       | 2 boutons submit (continuer / terminer)                     | Oui             | Oui                  | Oui            | VERIFIED  |
| `src/web/views/pages/biens/detail.ejs`                           | 2 CTAs cross-link locataire + bail                          | Oui             | Oui                  | Oui            | VERIFIED  |
| `src/web/views/pages/erreur.ejs`                                 | Page 500 HTML avec layout + role="alert"                    | Oui             | Oui                  | Oui            | VERIFIED  |
| `tests/integration/wizard/wizard-validation-erreurs.test.ts`     | 6 cas G1                                                    | Oui             | Oui (6 tests)        | N/A            | VERIFIED  |
| `tests/integration/wizard/wizard-skippable.test.ts`              | 4 cas G2 + 2 branches empty-state /baux                     | Oui             | Oui (4 tests)        | N/A            | VERIFIED  |
| `tests/unit/web/bien-schemas.test.ts`                            | 4 cas superRefine                                           | Oui             | Oui (4 tests)        | N/A            | VERIFIED  |

---

## Liens clés (wiring)

| De                                       | Vers                                            | Via                                                    | Statut    |
|------------------------------------------|-------------------------------------------------|--------------------------------------------------------|-----------|
| `wizard.ts POST /wizard/bien`            | `pages/wizard/bien.ejs`                         | try/catch → reply.view avec erreurs._global + valeurs  | WIRED     |
| `src/main.ts`                            | Fastify (global)                                | app.setErrorHandler posé avant les plugins routes      | WIRED     |
| `wizard/bien.ejs`                        | `POST /wizard/bien?terminer=1`                  | formaction + req.query.terminer côté serveur           | WIRED     |
| `biens/detail.ejs`                       | `/locataires/nouveau?bienId=:id` et `/baux/nouveau?bienId=:id` | 2 liens href dans section "Actions"    | WIRED     |

---

## Contrôles de qualité

| Gate                          | Résultat        | Détail                                               |
|-------------------------------|-----------------|------------------------------------------------------|
| `pnpm test` (Vitest)          | 247/247 verts   | +14 tests vs baseline (4 unit + 6 intégration G1 + 4 intégration G2) |
| `pnpm test:bdd` (Cucumber)    | 39/39 verts     | +3 scénarios @gap-closure                            |
| `pnpm typecheck` (tsc)        | 0 erreur        | TypeScript strict                                    |
| `pnpm lint:deps` (depcruiser) | 0 violation     | 105 modules, 463 dépendances — aucun import technique dans domain/ |
| Debt markers (TBD/FIXME/XXX)  | 0 trouvé        | grep sur 7 fichiers modifiés → aucun marqueur non résolu |

---

## Vérification comportementale (spot-checks)

| Comportement                                            | Commande                                                                           | Résultat                 | Statut |
|---------------------------------------------------------|------------------------------------------------------------------------------------|--------------------------|--------|
| lotCreationSchema rejette appartement sans surface      | `pnpm test tests/unit/web/bien-schemas.test.ts`                                   | 4/4 verts                | PASS   |
| wizard?terminer=1 crée Bien seul + meta.wizard_complete | `pnpm test tests/integration/wizard/wizard-skippable.test.ts`                     | 4/4 verts                | PASS   |
| setErrorHandler renvoie HTML avec role="alert"          | `pnpm test tests/integration/wizard/wizard-validation-erreurs.test.ts`            | 6/6 verts                | PASS   |
| BDD @gap-closure 3 scénarios verts                      | `pnpm test:bdd`                                                                   | 39/39 (dont 3 @gap-closure) | PASS |

---

## Couverture requirements

| Requirement | Plan source | Description                                  | Statut    | Preuve                              |
|-------------|-------------|----------------------------------------------|-----------|-------------------------------------|
| PAT-01      | 01-08       | CRUD Bien                                    | SATISFIED | Bien autonome confirmé, wizard fix  |
| PAT-02      | 01-08       | N-Lots sur Bien                              | SATISFIED | lotCreationSchema superRefine       |
| LOC-01      | 01-08       | CRUD Locataire                               | SATISFIED | wizard locataire + skip             |
| LOC-02      | 01-08       | Bail meublé classique                        | SATISFIED | wizard bail try/catch non-régression|

---

## Anti-patterns

Aucun anti-pattern bloquant détecté dans les 7 fichiers source modifiés par ce plan. Aucun marker TBD/FIXME/XXX non référencé. Aucun stub (return null, return []) dans les routes ou vues.

---

## Vérification humaine requise

Aucun item nécessitant une vérification humaine — tous les comportements clés sont couverts par les tests automatisés.

---

## Résumé des gaps

**2 gaps bloquants** — documentation de sortie non produite :

1. **Critère #6 absent de ROADMAP.md** — Le plan exigeait (section `<output>` et `<success_criteria>`) d'ajouter un critère #6 à la liste success_criteria Phase 1 : "L'utilisateur peut interrompre le wizard après l'étape Bien ou Locataire et reprendre plus tard — meta.wizard_complete posé." Ce critère documente la décision produit G2 et sa traçabilité dans le ROADMAP. Sans lui, le contrat Phase 1 reste incomplet.

2. **Progress table Phase 1 non mise à jour** — La table de progression affiche `6/7 | In Progress`. Après le plan 08 (gap closure), le compte doit être `8/8` et le statut `Completed`. Cette incohérence peut induire en erreur le suivi du projet.

Ces deux gaps sont purement documentaires — ils n'affectent pas le code livré ni les tests. Cependant, ils faisaient partie des outputs requis du plan.

---

_Vérifié le : 2026-05-16_
_Vérificateur : Claude (gsd-verifier)_
