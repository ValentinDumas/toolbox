---
phase: 07-dashboard-notifications-d-ch-ances
reviewed: 2026-06-12T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - src/application/dashboard/calculer-toutes-alertes.ts
  - src/application/fiscalite/lister-alertes-cfe-actives.ts
  - src/domain/_shared/alerte.ts
  - src/domain/fiscalite/cfe/alerte-cfe-j30.ts
  - src/domain/locatif/alerte-fin-bail.ts
  - src/domain/locatif/alerte-irl.ts
  - src/domain/patrimoine/alerte-diagnostic.ts
  - src/main.ts
  - src/web/helpers/alerte-helpers.ts
  - src/web/routes/baux.ts
  - src/web/routes/racine.ts
  - src/web/views/pages/baux/indexations.ejs
  - src/web/views/pages/dashboard/accueil.ejs
  - src/web/views/partials/partial-bandeau-alerte.ejs
  - src/web/views/partials/sidebar-nav.ejs
  - tests/_builders/alertes.ts
  - tests/bdd/features/alerte-agregation.feature
  - tests/bdd/features/alerte-diagnostic.feature
  - tests/bdd/features/alerte-fin-bail.feature
  - tests/bdd/features/alerte-irl.feature
  - tests/bdd/features/dashboard-baux-indexations.feature
  - tests/bdd/features/dashboard-composition.feature
  - tests/bdd/features/dashboard-empty-state.feature
  - tests/bdd/features/dashboard-premier-lancement.feature
  - tests/bdd/step_definitions/alerte-agregation.steps.ts
  - tests/bdd/step_definitions/alerte-diagnostic.steps.ts
  - tests/bdd/step_definitions/alerte-fin-bail.steps.ts
  - tests/bdd/step_definitions/alerte-irl.steps.ts
  - tests/bdd/step_definitions/baux-indexations.steps.ts
  - tests/bdd/step_definitions/dashboard.steps.ts
  - tests/integration/web/accessibility-phase7.test.ts
  - tests/unit/_shared/alerte.test.ts
  - tests/unit/dashboard/calculer-toutes-alertes.test.ts
  - tests/unit/fiscalite/alerte-cfe-j30.test.ts
  - tests/unit/locatif/alerte-fin-bail.test.ts
  - tests/unit/locatif/alerte-irl.test.ts
  - tests/unit/patrimoine/alerte-diagnostic.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 7 : Code Review Report

**Reviewed:** 2026-06-12
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

Phase 7 livre un read-model `Alerte` unifié, 4 calculateurs purs (CFE/IRL/diagnostic/fin de bail), l'agrégateur `calculerToutesAlertes`, le dashboard GET / et la page GET /baux/indexations. L'architecture est saine : les fonctions domaine sont pures (aucun import infra, Clock injecté au point d'entrée), les fenêtres d'alerte sont testées aux bornes (J-30/J-31, J+60/J+61), l'EJS échappe systématiquement (`<%= %>`), et la couverture BDD + unitaire + a11y est réelle.

Aucune vulnérabilité de sécurité ni risque de perte de données détecté. En revanche, 5 défauts fonctionnels/documentaires confirmés : un mismatch de valeur littérale (`'electricite'` vs `'elec'`) qui rend un libellé faux à l'écran, des liens « Voir tout » pointant vers des ancres inexistantes, un champ `nomLocataire` consommé mais jamais produit, et deux docstrings de fenêtre contredisant le code (risque de « fix » inverse par un futur mainteneur).

## Warnings

### WR-01 : Liens « Voir tout » du dashboard pointent vers des ancres inexistantes

**File:** `src/web/views/pages/dashboard/accueil.ejs:22` et `:76`
**Issue:** Les sections S2 et S4 rendent `<a href="#toutes-alertes-critiques">` et `<a href="#toutes-actions-jour">` quand le total dépasse 5. Aucun élément avec ces `id` n'existe dans la page ni ailleurs dans la codebase (grep confirmé). Un utilisateur avec 6+ alertes critiques clique sur « Voir tout (6) » et il ne se passe rien — les alertes au-delà du top 5 sont inaccessibles (S3 et S5 pointent correctement vers `/impayes` et `/echeances`). Le test BDD `@phase7-dashboard-02` vérifie la présence du texte « Voir tout (6) » mais pas que la cible existe, d'où le trou.
**Fix:** Soit pointer vers une page existante listant toutes les alertes (ex. créer la cible, ou pour S4-IRL pointer vers `/baux/indexations`), soit ne pas rendre de lien tant que la cible n'existe pas :
```ejs
<%# S2 : retirer le lien ou pointer vers une vraie cible %>
<% if (alertesCritiquesTotal > 5) { %>
  <span>+ <%= alertesCritiquesTotal - 5 %> autres alertes</span>
<% } %>
```

### WR-02 : `libelleTypeAlerte` compare à `'electricite'` alors que le domaine émet `'elec'`

**File:** `src/web/helpers/alerte-helpers.ts:72`
**Issue:** Le type domaine est `TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp'` (`src/domain/_shared/duree-validite-diagnostic.ts:17`) et `calculerAlertesDiagnostic` place `diag.type` (donc `'elec'`) dans `source.extra.typeDiagnostic`. Le helper teste `typeDiag === 'electricite'`, condition qui ne matche jamais : toute alerte de diagnostic électricité s'affiche avec le libellé générique « Diagnostic » au lieu de « Électricité », dans le bandeau dashboard et son `aria-label`. Aucun test ne couvre ce cas (les tests helper, s'ils existent, n'exercent pas `'elec'`).
**Fix:**
```typescript
if (typeDiag === 'elec') return 'Électricité';
```
Et ajouter un test unitaire `libelleTypeAlerte(uneAlerteDiagnostic({ source: { ..., extra: { typeDiagnostic: 'elec' } } }))` → `'Électricité'`.

### WR-03 : `source.extra.nomLocataire` consommé mais jamais produit — branches mortes

**File:** `src/web/helpers/alerte-helpers.ts:76-78`, `src/web/routes/racine.ts:151`
**Issue:** Deux consommateurs lisent `alerte.source.extra['nomLocataire']` :
1. `libelleTypeAlerte` (cas `fin_bail`) promet « Fin de bail — {locataire} » ;
2. `racine.ts` S4 construit `ActionIrl.nomLocataire` depuis ce champ.

Or `calculerAlertesFinBail` ne renseigne aucun `extra` (`src/domain/locatif/alerte-fin-bail.ts:79-83`) et `calculerAlertesIrl` ne renseigne que `adresseBien` (`src/domain/locatif/alerte-irl.ts:103`). Résultat : le nom du locataire n'apparaît jamais ni dans les bandeaux fin de bail, ni dans « Actions du jour » (le `<% if (action.nomLocataire) %>` de `accueil.ejs:98` est toujours faux). La page `/baux/indexations` montre qu'enrichir le nom côté route est faisable (`baux.ts:167-178`) — le dashboard ne le fait pas.
**Fix:** Soit enrichir côté route racine (résoudre `locataireRepo` comme le fait `/baux/indexations` et passer le nom), soit supprimer les branches mortes (`extra?.['nomLocataire']` dans le helper et `nomLocataire` dans `ActionIrl`) ainsi que la mention dans la JSDoc du helper, pour que le code reflète le comportement réel.

### WR-04 : Docstring de `estAlerteFinBailActive` inverse la condition implémentée

**File:** `src/domain/locatif/alerte-fin-bail.ts:43-45` (vs code ligne 54)
**Issue:** La JSDoc affirme « Fenêtre : `j <= 60 && j >= -30` (… borne supérieure +60 … borne basse -30 …) » alors que le code exécute `j <= 30 && j >= -60`. Le code est le bon : les tests unitaires (J-30 inclus / J-31 exclu, J+60 inclus / J+61 exclu) et le feature file (« fenêtre 30j avant à 60j après ») le confirment. Mais un futur mainteneur lisant la doc pourrait « corriger » le code dans le mauvais sens — sur une règle d'alerte juridique, c'est un risque réel.
**Fix:** Réécrire la docstring pour coller au code :
```typescript
 * - Fenêtre : `j <= 30 && j >= -60` (D-SRC-05 / D-FB-03 — alerte dès J-30 avant
 *   l'expiration, et maintenue jusqu'à J+60 après expiration, où j = joursAvantEcheance).
```

### WR-05 : Doc IRL annonce une fenêtre [-30, +30] dont la moitié négative est inatteignable

**File:** `src/domain/locatif/alerte-irl.ts:5` et `:59`
**Issue:** Le module documente « baux actifs dont la date d'anniversaire tombe dans la fenêtre [-30, +30] jours (D-SRC-02) ». Or `bail.dateAnniversaireProchaine(maintenant)` retourne toujours une date strictement future (fait acté dans `tests/unit/locatif/alerte-irl.test.ts:10-12` et test 6a) : `j >= 1` toujours, donc la borne `j >= -30` est du code mort et aucune alerte « révision IRL dépassée » n'existe. Conséquence fonctionnelle : le lendemain de l'anniversaire, un bail non indexé disparaît silencieusement des alertes (dashboard ET `/baux/indexations`) jusqu'à J-30 de l'anniversaire suivant, alors que la révision reste applicable. Le test unitaire assume ce comportement, mais la doc du module et le titre du feature (« J-30/J-7 ») ne disent pas la même chose que D-SRC-02 « fenêtre [-30, +30] ».
**Fix:** Trancher explicitement : (a) si le comportement « alerte uniquement avant l'anniversaire » est la décision D-SRC-02 réelle, corriger la doc du module (fenêtre effective [1, 30]) et supprimer/commenter la borne `j >= -30` comme purement défensive ; (b) sinon, calculer aussi l'anniversaire écoulé (`dateAnniversaireProchaine(maintenant).subtract({ years: 1 })`) pour couvrir les révisions dépassées de moins de 30 jours non indexées. À documenter dans le phase log quel que soit le choix.

## Info

### IN-01 : `tests/_builders/alertes.ts` est entièrement inutilisé

**File:** `tests/_builders/alertes.ts:1-111`
**Issue:** Aucun fichier de test n'importe `_builders/alertes` (grep sur tout `tests/` : zéro usage). Les 5 builders (`uneAlerte`, `uneAlerteCfe`, `uneAlerteIrl`, `uneAlerteFinBail`, `uneAlerteDiagnostic`) sont du code mort livré dans cette phase. Par ailleurs `uneAlerteIrl` omet `extra.adresseBien` que le producteur réel garantit — s'il est utilisé un jour tel quel, il masquera le contrat réel.
**Fix:** Supprimer le fichier, ou l'utiliser dans des tests de `alerte-helpers.ts` (qui en bénéficieraient — cf. WR-02/WR-03).

### IN-02 : Casts non vérifiés dans `versAlerteCfe`

**File:** `src/application/fiscalite/lister-alertes-cfe-actives.ts:33-43`
**Issue:** La projection fait `alerte.source.bienId!`, `extra['millesime'] as number`, `extra['dateEcheancePaiement'] as Temporal.PlainDate`, `extra['statutCfe'] as StatutCfe`. Si la forme produite par `calculerAlertesCfe` dérive (renommage d'une clé extra), les consommateurs Phase 6 recevront silencieusement `undefined` au lieu d'une erreur de compilation.
**Fix:** Minimal : un guard runtime (`if (alerte.source.bienId === undefined) throw …`). Mieux : typer `extra` du producteur CFE avec une interface dédiée plutôt que `Record<string, unknown>`.

### IN-03 : Pluriel non géré dans la vue S4 du dashboard

**File:** `src/web/views/pages/dashboard/accueil.ejs:99`
**Issue:** `(échéance dans <%= action.joursRestants %> jours)` affiche « dans 1 jours » pour j=1, alors que `formaterAlerteUrgence` gère correctement le singulier. Incohérence de rendu entre S2 et S4.
**Fix:** `jour<%= action.joursRestants > 1 ? 's' : '' %>` ou réutiliser `formaterAlerteUrgence`.

### IN-04 : Logique « indexationsParBail exercice courant » dupliquée

**File:** `src/application/dashboard/calculer-toutes-alertes.ts:67-74` et `src/web/routes/baux.ts:154-163`
**Issue:** La construction de la `Map<BailId, boolean>` (D-SRC-03 : `dernierePourBail` + comparaison `dateEffet.year === maintenant.year`) est copiée-collée entre le use case agrégateur et la route `/baux/indexations`. Si la définition d'« exercice courant » évolue (ex. année glissante au lieu d'année civile), un seul des deux sites sera corrigé.
**Fix:** Extraire un helper application partagé, ex. `construireIndexationsParBail(baux, bailIndexationRepo, maintenant)` dans `src/application/locatif/`, consommé par les deux call sites.

---

_Reviewed: 2026-06-12_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
