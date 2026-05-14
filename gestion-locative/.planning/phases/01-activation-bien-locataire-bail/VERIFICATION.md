---
phase: 01-activation-bien-locataire-bail
verified_at: 2026-05-14T14:20:00Z
verifier: gsd-verifier
overall_verdict: PARTIAL
criteria_passed: 4/5
criteria_partial: 1/5
criteria_failed: 0/5
---

# Phase 1 : Activation — Bien, Locataire, Bail — Rapport de vérification

**Phase Goal :** L'utilisateur peut créer 1 Bien (avec ses Lots), 1 Locataire, et 1 Bail meublé classique en première session, et le voir persisté localement.
**Vérifié le :** 2026-05-14
**Statut :** PARTIAL
**Re-vérification :** Non — vérification initiale

---

## 1. Executive Verdict

Les 4 premiers critères de succès sont pleinement vérifiés par le code et les tests. Le critère 5 (KPI Activation — wizard bout-en-bout) est substantiellement livré : les 3 scénarios BDD passent à 100 % (29 steps verts), le wizard 3 étapes redirige correctement, et `meta.wizard_complete = '1'` est bien posé. Le seul écart est une divergence de formulation entre le critère ROADMAP ("garant, pièces" sur Locataire) et les décisions de projet D-32/D-33 (garant sur Bail, pièces reportées Phase 4) — le code est correct selon les décisions, mais le critère ROADMAP n'a pas été amendé.

---

## 2. Audit par critère

### Critère 1 — CRUD Bien + persistence SQLite

**Statut : PASS**

**Preuves :**
- Routes complètes présentes dans `src/web/routes/biens.ts` : `GET /biens`, `GET /biens/nouveau`, `POST /biens`, `GET /biens/:id`, `GET /biens/:id/modifier`, `POST /biens/:id/modifier`, `POST /biens/:id/supprimer`.
- Domaine : `Bien.creer` impose `surface > 0`, types enum `{appartement, maison, immeuble, local_commercial}`, année ∈ [1700, actuelle+1], ≥ 1 lot — invariants testés dans `tests/unit/patrimoine/bien.test.ts` (8 tests).
- Soft-delete : colonne `supprime_le DATETIME NULL` dans migration `0001_init.sql` ; `supprimerBien` pose `supprime_le`, `listerTous()` filtre `supprime_le IS NULL` (`bien-repository-sqlite.ts`).
- Intégration : 6 tests SQLite dans `tests/integration/repositories/bien-repository-sqlite.test.ts` incluant roundtrip et soft-delete.
- Tous les 87 tests Vitest passent.

**Écart :** Aucun.

---

### Critère 2 — CRUD N-Lots sur un Bien (parking, cave)

**Statut : PASS**

**Preuves :**
- Route `POST /biens/:id/lots` (ajout de lot) et `POST /biens/:id/lots/:lotId/supprimer` présentes dans `src/web/routes/biens.ts`.
- Domaine : `Bien.ajouterLot`, `Bien.supprimerLot` — invariant ≥ 1 lot enforced (`InvariantViolated` si restants = 0).
- Types lot : schema SQLite `lot.type CHECK (type IN ('appartement','parking','cave','local_commercial','terrasse','autre'))` — parking et cave couverts.
- Test multi-lot dans `tests/integration/repositories/bail-repository-sqlite.test.ts` : bail avec `lot1` (appartement) + `lot2` (parking) persiste 2 rows `bail_lots`.
- Formulaire de création Bien accepte N lots via `normaliserLotsFormBody`.

**Écart :** Aucun.

---

### Critère 3 — CRUD Locataire (identité, contact)

**Statut : PARTIAL**

**Preuves — ce qui est livré :**
- Routes complètes dans `src/web/routes/locataires.ts` : `GET /locataires`, `GET /locataires/nouveau`, `POST /locataires`, `GET /locataires/:id`, `GET /locataires/:id/modifier`, `POST /locataires/:id/modifier`, `POST /locataires/:id/supprimer`.
- Identité : `nom`, `prenom`, `dateNaissance`, `lieuNaissance {commune, pays}`, `nationalite` — tous validés avec invariants.
- Contact : `email` (validation regex minimal domaine), `telephone` (optionnel), `adresseActuelle {rue, codePostal, ville}`.
- Tests unitaires : 8 tests `tests/unit/locatif/locataire.test.ts` couvrant invariants nom, prénom, email, date naissance, commune/pays naissance.

**Divergence ROADMAP vs décisions projet :**
- Le critère ROADMAP formule : "garant, pièces" dans la fiche Locataire.
- Le code n'implémente ni garant ni pièces sur `Locataire`, conformément aux décisions D-32 (pièces justificatives reportées Phase 4 — coffre documentaire) et D-33 (cautionnement/garant rattaché au `Bail`, pas au `Locataire`).
- Le `Cautionnement` est bien implémenté sur `Bail` (VO complet avec types physique/visale/gli, garant optionnel), ce qui est correct.
- **Le code est juste ; le critère ROADMAP n'a pas été amendé pour refléter D-32/D-33.** Voir section 4 pour la recommandation.

---

### Critère 4 — Bail meublé classique avec invariants D-35

**Statut : PASS**

**Preuves :**
- `Bail.creer` dans `src/domain/locatif/bail.ts` enforce tous les invariants D-35 :
  - `dureeMois < 12` → `InvariantViolated`
  - `loyerHc = 0` → `InvariantViolated`
  - `depotGarantie > 2 × loyerHc` → `InvariantViolated` (limite inclusive vérifiée)
  - `lotIds.length < 1` → `InvariantViolated`
  - `modeCharges ∉ {forfait, provisions}` → `InvariantViolated`
- `irlReference: IRL` obligatoire dans les props Bail — `IRL.creer({trimestre, valeur})` validé par `tests/unit/_shared/irl.test.ts` (7 tests).
- `Cautionnement` (D-33) rattaché à `Bail`, pas à `Locataire`.
- Use case `creerBail` vérifie D-30 (cross-aggregate) : tous les `lotIds` doivent appartenir au `bienId` sélectionné.
- 14 tests unitaires Bail dans `tests/unit/locatif/bail.test.ts` — tous les invariants couverts, dont dépôt limite inclusive, loyer zéro, durée 11 mois.
- Schéma SQLite enforce `duree_mois >= 12`, `loyer_hc > 0`, `mode_charges IN ('forfait','provisions')` au niveau DB.
- Jointure `bail_lots` vérifiée par 6 tests d'intégration dans `tests/integration/repositories/bail-repository-sqlite.test.ts`.

**Écart :** Aucun.

---

### Critère 5 — KPI Activation : wizard bout-en-bout en une session

**Statut : PASS**

**Preuves :**
- Fichier `tests/bdd/features/activation.feature` : 3 scénarios (création Bien minimal, wizard complet 3 étapes, second lancement sans wizard).
- Résultat réel `pnpm test:bdd` : **3 scenarios (3 passed), 29 steps (29 passed), 0m00.551s**.
- Wizard `src/web/routes/wizard.ts` : 3 étapes séquencées (Bien → Locataire → Bail), session cookie (`req.session.wizard`) maintient `bienId` et `locataireId` entre étapes, `marquerWizardComplete` pose `meta.wizard_complete = '1'` à la fin.
- Étape 1 : `POST /wizard/bien` → persiste Bien + Lot, stocke `bienId` session, redirige `/wizard/locataire`.
- Étape 2 : `POST /wizard/locataire` → persiste Locataire, stocke `locataireId` session, redirige `/wizard/bail`.
- Étape 3 : `POST /wizard/bail` → persiste Bail (cross-aggregate valide), appelle `marquerWizardComplete`, redirige `/biens` avec bannière succès "Bail enregistré avec succès. Bienvenue !".
- Scénario BDD vérifie : table `bien` 1 ligne, `locataire` 1 ligne, `bail` 1 ligne, `bail_lots` 1 ligne, `meta.wizard_complete = '1'`.
- Guard `/wizard/*` : si wizard déjà complété, toutes les pages wizard redirigent vers `/biens` — scénario 3 le confirme.

**Écart :** Aucun.

---

## 3. Vérifications transversales

### Frontière hexagonale

- `pnpm lint:deps` résultat : **0 violations, 49 modules, 178 dépendances cruisées**.
- Domaine pur confirmé : aucun import `fastify`, `Kysely`, `better-sqlite3`, ou `zod` dans `src/domain/`.
- Ports définis : `BienRepository`, `LocataireRepository`, `BailRepository` dans `src/domain/*/` — implémentations dans `src/infrastructure/repositories/`.

### Ubiquitous language français

Spot-check des identifiants clés : `Bien`, `Lot`, `Locataire`, `Bail`, `Money`, `IRL`, `Cautionnement`, `creerBien`, `creerLocataire`, `creerBail`, `enregistrer`, `trouverParId`, `listerTous`, `supprimerBien`, `modifierBail`, `estPremierLancement`, `marquerWizardComplete`, `cheminBaseParDefaut`. Aucun alias anglais (`property`, `tenant`, `lease`, `guarantor`, `rent`, `deposit`) trouvé dans `src/`.

### Local-first / SQLite

- `cheminBaseParDefaut()` dans `src/infrastructure/db/database.ts` :
  - macOS : `~/Library/Application Support/gestion-locative/db.sqlite`
  - Windows : `%APPDATA%/gestion-locative/db.sqlite`
  - Linux : `~/.local/share/gestion-locative/db.sqlite`
- Aucune dépendance cloud dans `src/`.

### YAGNI — périmètre hors-scope non implémenté

Aucun des éléments suivants n'est présent dans `src/domain/` :
- Génération PDF (Phase 2+)
- Indexation IRL active (Phase 3)
- Gel DPE F/G (Phase 3)
- Checklist mobilier décret 2015-981 (Phase 3)
- Garant sur `Locataire` (D-32 : pièces Phase 4 ; D-33 : garant sur Bail)
- Statut `Bail` brouillon/actif (non requis Phase 1)

### Tests

| Sujet | Fichier | Nombre |
|---|---|---|
| Unit `Bail` | `tests/unit/locatif/bail.test.ts` | 14 tests |
| Unit `Locataire` | `tests/unit/locatif/locataire.test.ts` | 8 tests |
| Unit `Cautionnement` | `tests/unit/locatif/cautionnement.test.ts` | 5 tests |
| Unit `Bien` | `tests/unit/patrimoine/bien.test.ts` | 8 tests |
| Unit `Lot` | `tests/unit/patrimoine/lot.test.ts` | 5 tests |
| Unit `Money` | `tests/unit/_shared/money.test.ts` | 13 tests |
| Unit `IRL` | `tests/unit/_shared/irl.test.ts` | 7 tests |
| Unit helpers | `tests/unit/helpers/` | 8 tests |
| Intégration lifecycle | `tests/integration/lifecycle/premier-lancement.test.ts` | 3 tests |
| Intégration BienRepository | `tests/integration/repositories/bien-repository-sqlite.test.ts` | 6 tests |
| Intégration LocataireRepository | `tests/integration/repositories/locataire-repository-sqlite.test.ts` | 4 tests |
| Intégration BailRepository | `tests/integration/repositories/bail-repository-sqlite.test.ts` | 6 tests |
| **Total Vitest** | | **87 tests (87 passés)** |
| BDD Cucumber | `tests/bdd/features/activation.feature` | **3 scénarios, 29 steps (100 % verts)** |

---

## 4. Divergences entre critères ROADMAP et décisions projet

### Critère 3 — "garant, pièces" sur Locataire

**Formulation ROADMAP actuelle :**
> L'utilisateur peut créer une fiche `Locataire` (identité, contact, **garant, pièces**).

**Réalité implémentée (correct selon D-32/D-33) :**
- `garant` → rattaché au `Bail` via `Cautionnement` (D-33). Le VO `Cautionnement` est complet et testé sur `Bail`.
- `pièces` → reportées Phase 4 (coffre documentaire, D-32).

**Impact :** Le code est conforme aux décisions de conception. Le critère ROADMAP est anachronique. Sans amendement, tout futur auditeur croira que le garant et les pièces manquent sur `Locataire`.

**Recommandation :** Amender le critère 3 du ROADMAP Phase 1 :

```
Avant : L'utilisateur peut créer une fiche Locataire (identité, contact, garant, pièces).
Après : L'utilisateur peut créer une fiche Locataire (identité, contact).
        Note : le cautionnement/garant est attaché au Bail (D-33) ;
               les pièces justificatives sont reportées en Phase 4 (D-32).
```

---

## 5. Recommandations avant ship

1. **ROADMAP amend (critique pour la lisibilité)** — Mettre à jour le critère 3 Phase 1 dans `.planning/ROADMAP.md` pour retirer "garant, pièces" du scope Locataire et documenter D-32/D-33. Cela clôt la seule divergence de ce rapport.

2. **ROADMAP progress counter** — La table de progression montre `6/7 plans, In Progress` alors que 7/7 plans sont complétés. Mettre à jour la ligne Phase 1 à `7/7 | Completed`.

3. **Avertissement node engine** — Le runtime Node.js v20.20.1 génère `WARN Unsupported engine: wanted >=22.0.0`. Non bloquant pour Phase 1, mais à corriger avant CI.

---

## Tableau récapitulatif

| # | Critère | Statut | Notes |
|---|---|---|---|
| 1 | CRUD Bien + persistence SQLite | PASS | Routes complètes, invariants, soft-delete, 8+6 tests |
| 2 | CRUD N-Lots (parking, cave) | PASS | ajouterLot / supprimerLot, invariant ≥1 lot, multi-lot intégration |
| 3 | CRUD Locataire (identité, contact) | PARTIAL | Code correct selon D-32/D-33 ; critère ROADMAP non amendé |
| 4 | Bail meublé classique invariants D-35 | PASS | 14 tests unitaires, 6 intégration, IRL + Cautionnement sur Bail |
| 5 | KPI Activation wizard bout-en-bout | PASS | 3 BDD scénarios 100 % verts, meta.wizard_complete posé |

**Score : 4/5 critères pleinement vérifiés, 1/5 PARTIAL (divergence de formulation ROADMAP uniquement — le code est correct).**

**Recommandation ship :** Le code est shippable. L'unique action bloquante est l'amendement du critère 3 dans ROADMAP.md pour aligner la documentation sur les décisions D-32/D-33. Aucun gap fonctionnel.

---

_Vérifié le 2026-05-14_
_Vérificateur : Claude (gsd-verifier)_
