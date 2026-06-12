---
phase: 07-dashboard-notifications-d-ch-ances
verified: 2026-06-12T00:00:00Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Le système notifie l'utilisateur à J-30 et J-7 sur chaque échéance critique : paiement CFE, révision IRL annuelle, expiration DPE / gaz / élec, fin de bail."
    status: partial
    reason: "L'alerte diagnostic de type 'elec' (électricité) n'affiche jamais 'Électricité' : alerte-helpers.ts:72 compare typeDiagnostic à 'electricite' alors que le domaine produit 'elec'. Toutes les alertes électricité s'affichent avec le libellé générique 'Diagnostic'. Le bandeau CFE pour l'électricité et son aria-label sont donc systématiquement incorrects (WR-02 du code review, défaut fonctionnel confirmé dans le code)."
    artifacts:
      - path: "src/web/helpers/alerte-helpers.ts"
        issue: "Ligne 72 : `typeDiag === 'electricite'` ne matche jamais car le domaine produit `'elec'` (TypeDiagnostic). Fix : `if (typeDiag === 'elec') return 'Électricité';`"
    missing:
      - "Corriger la comparaison sur `'elec'` au lieu de `'electricite'` dans `libelleTypeAlerte`"
      - "Ajouter un test unitaire couvrant `libelleTypeAlerte` avec `typeDiagnostic: 'elec'` → `'Électricité'`"

  - truth: "Une notification déclenchée renvoie en un clic vers l'écran d'action correspondant (régler CFE, lancer l'indexation, renouveler diagnostic, préparer renouvellement bail)."
    status: failed
    reason: "Deux problèmes bloquants. (1) Les liens 'Voir tout' des sections S2 (alertes critiques) et S4 (actions du jour) pointent vers des ancres `#toutes-alertes-critiques` et `#toutes-actions-jour` qui n'existent pas dans la page ni nulle part dans le codebase (WR-01 code review confirmé par grep). Quand alertesCritiquesTotal > 5, les alertes au-delà du top 5 sont inaccessibles : le lien ne mène nulle part. (2) Le nom du locataire n'apparaît jamais dans les notifications fin de bail ni dans les actions IRL de S4 : `calculerAlertesFinBail` ne remplit aucun `extra` et `calculerAlertesIrl` ne remplit que `adresseBien`. `alerte-helpers.ts:76` et `racine.ts:151` lisent `source.extra?.['nomLocataire']` qui est toujours absent. La branche `if (action.nomLocataire)` de accueil.ejs:98 est donc toujours fausse : les actions IRL dans S4 n'identifient jamais le locataire. La navigation reste possible (le lien `/baux/{id}/indexer` est correct), mais la lisibilité de l'action est dégradée."
    artifacts:
      - path: "src/web/views/pages/dashboard/accueil.ejs"
        issue: "Ligne 22 : `href='#toutes-alertes-critiques'` — ancre inexistante. Ligne 76 : `href='#toutes-actions-jour'` — ancre inexistante. Un utilisateur avec 6+ alertes critiques ou 6+ actions du jour clique sur 'Voir tout (N)' sans résultat."
      - path: "src/domain/locatif/alerte-fin-bail.ts"
        issue: "Lignes 73-83 : `source` ne contient pas de `extra` — `nomLocataire` jamais produit. Le libellé 'Fin de bail — {locataire}' promis par le helper est donc toujours tronqué à 'Fin de bail'."
      - path: "src/domain/locatif/alerte-irl.ts"
        issue: "Ligne 103 : `extra: { adresseBien: bien.adresse.rue }` — `nomLocataire` absent. Le champ `action.nomLocataire` dans S4 (accueil.ejs:98) sera toujours falsy pour les actions IRL."
      - path: "src/web/helpers/alerte-helpers.ts"
        issue: "Ligne 76-78 : consomme `source.extra?.['nomLocataire']` qui n'est jamais produit par `calculerAlertesFinBail`. Branche morte."
    missing:
      - "Corriger les ancres `#toutes-alertes-critiques` et `#toutes-actions-jour` dans accueil.ejs : soit créer les cibles `id=` correspondantes, soit pointer vers une vraie page (ex. S4-IRL → `/baux/indexations`), soit supprimer le lien tant que la cible n'existe pas"
      - "Soit enrichir `nomLocataire` côté route racine (résoudre locataireRepo comme le fait `/baux/indexations`), soit supprimer les branches mortes du helper et de racine.ts qui lisent ce champ"
human_verification:
  - test: "Vérifier le comportement 'J-7 critique' visuellement"
    expected: "Avec une alerte dont joursRestants=5, le bandeau doit afficher une couleur warning-fort (fond orange/bordeaux) différente du warning standard, et le libellé WCAG doit lire 'Échéance dans 5 jours' avec role='alert'"
    why_human: "Rendu visuel CSS — les variables --couleur-warning-bg et --couleur-destructive-bg ne peuvent pas être vérifiées programmatiquement sans rendu navigateur"
  - test: "Vérifier que le lien 'Régler la CFE sur impots.gouv.fr' s'ouvre bien dans un nouvel onglet"
    expected: "Clic sur le lien ouvre impots.gouv.fr en nouvel onglet (target='_blank' rel='noopener noreferrer' présent dans le partial)"
    why_human: "Comportement d'ouverture de lien externe — vérifiable visuellement dans un vrai navigateur"
---

# Phase 7 : Dashboard & Notifications d'échéances — Rapport de vérification

**Phase Goal:** L'utilisateur dispose d'une vue synthétique des actions à mener (impayés, échéances à venir, action du jour) et reçoit des notifications J-30 et J-7 sur toutes les échéances critiques agrégées par les phases précédentes.
**Verified:** 2026-06-12T00:00:00Z
**Status:** gaps_found
**Re-verification:** Non — vérification initiale

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Le dashboard affiche en un coup d'œil les impayés ouverts, les échéances de loyer à venir et les actions du jour (relances dues, indexations IRL imminentes). | VERIFIED | `racine.ts` implémente 4 sections (S2 alertes critiques, S3 impayés, S4 actions du jour, S5 échéances loyer) alimentées par `calculerToutesAlertes`, `listerImpayes`, `calculerRelanceDisponible`, et `listerNonPayees`. Vue `accueil.ejs` rend toutes les sections. Tests BDD `@phase7-dashboard-01..03` : 3/3 scénarios verts. |
| 2 | Le dashboard rend visible la hiérarchie d'urgence (en retard / à venir / à jour) sans nécessiter de drill-down pour qualifier la priorité. | VERIFIED | `partial-bandeau-alerte.ejs` implémente 3 variantes visuelles selon `joursRestants` : destructive (j<=0), warning-fort (j<=7), warning (j>=8). L'état global `a_jour` affiche un bandeau de succès quand tout est à jour. WCAG 1.4.1 respecté (libellé textuel + icône aria-hidden + couleur). Note : WR-02 (libellé 'Électricité' jamais affiché) ne casse pas la hiérarchie visuelle, seulement le libellé du type. |
| 3 | Le système notifie l'utilisateur à J-30 et J-7 sur chaque échéance critique : paiement CFE, révision IRL annuelle, expiration DPE / gaz / élec, fin de bail. | PARTIAL | 4 calculateurs existent et sont agrégés : `calculerAlertesCfe` (CFE J-30), `calculerAlertesIrl` (IRL J-30), `calculerAlertesDiagnostic` (DPE/gaz/elec J-30), `calculerAlertesFinBail` (fin bail J-30). Les alertes J-7 sont identifiées via le filtre `joursRestants <= 7` en section S2. BLOQUANT : WR-02 — `alerte-helpers.ts:72` compare `typeDiagnostic === 'electricite'` mais le domaine produit `'elec'` — toutes les alertes électricité s'affichent avec le libellé générique "Diagnostic" au lieu de "Électricité". |
| 4 | Une notification déclenchée renvoie en un clic vers l'écran d'action correspondant (régler CFE, lancer l'indexation, renouveler diagnostic, préparer renouvellement bail). | FAILED | Navigation directe fonctionne dans `partial-bandeau-alerte.ejs` pour chaque type (CFE → `/biens/{id}/cfe/{id}/editer` + `impots.gouv.fr`, IRL → `/baux/{id}/indexer`, diagnostic → `/biens/{id}/diagnostics#diag-{type}`, fin bail → `/baux/{id}`). BLOQUANT 1 : ancres `#toutes-alertes-critiques` et `#toutes-actions-jour` inexistantes — les alertes au-delà du top 5 sont inaccessibles (WR-01). BLOQUANT 2 : `nomLocataire` jamais produit par les calculateurs — les actions fin de bail dans S2 n'identifient jamais le locataire, les actions IRL dans S4 non plus (WR-03). |

**Score:** 2/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/_shared/alerte.ts` | TypeAlerte, Alerte, joursAvantEcheance | VERIFIED | 69 lignes, exporte TypeAlerte, interface Alerte, joursAvantEcheance. Aucun import technique. |
| `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` | calculerAlertesCfe produit Alerte[] | VERIFIED | Produit Alerte[] avec type='cfe', source.refId, source.extra.{millesime, statutCfe}. |
| `src/domain/locatif/alerte-irl.ts` | calculerAlertesIrl produit Alerte[] | VERIFIED | 111 lignes. urlAction = `/baux/${bail.id}/indexer`. source.extra = `{ adresseBien }` — `nomLocataire` absent (WR-03). |
| `src/domain/locatif/alerte-fin-bail.ts` | calculerAlertesFinBail produit Alerte[] | VERIFIED | 90 lignes. urlAction = `/baux/${bail.id}`. Aucun extra produit — nomLocataire absent (WR-03). |
| `src/domain/patrimoine/alerte-diagnostic.ts` | calculerAlertesDiagnostic produit Alerte[] | VERIFIED | 76 lignes. source.extra.typeDiagnostic = diag.type (valeur `'elec'`, pas `'electricite'`). |
| `src/application/dashboard/calculer-toutes-alertes.ts` | Agrège 4 sources, tri ASC | VERIFIED | 87 lignes. Charge 4 sources en parallèle. Tri ASC global. Pattern Clock-driven respecté. |
| `src/web/routes/racine.ts` | GET / avec les 4 sections | VERIFIED | 190 lignes. Branche premier-lancement. Sections S2-S5 alimentées. Tous les repos injectés. |
| `src/web/views/pages/dashboard/accueil.ejs` | Vue synthétique 4 sections | STUB (partiel) | S2 lien `href='#toutes-alertes-critiques'` (ancre inexistante). S4 lien `href='#toutes-actions-jour'` (ancre inexistante). S4 `action.nomLocataire` toujours vide pour IRL. |
| `src/web/helpers/alerte-helpers.ts` | formaterAlerteUrgence, iconeTypeAlerte, libelleTypeAlerte | STUB (partiel) | `libelleTypeAlerte` : branche `'electricite'` ne matche jamais (WR-02). Branche `nomLocataire` fin_bail est du code mort (WR-03). |
| `src/web/views/partials/partial-bandeau-alerte.ejs` | Bandeau unifié avec liens d'action | VERIFIED | 3 variantes visuelles. 4 types supportés avec liens corrects. Mode inline=true pour table indexations. |
| `src/web/routes/baux.ts` | GET /baux/indexations | VERIFIED | Route statique déclarée avant `/baux/:id`. calculerAlertesIrl, locatairesParBail, indexationsParBail tous présents. |
| `src/web/views/pages/baux/indexations.ejs` | Table révisions IRL + empty-state | VERIFIED | Table aria-label, 5 colonnes scope='col', empty-state, paragraphe gel F/G DPE, partial inline. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `racine.ts` | `calculer-toutes-alertes.ts` | import + appel dans GET / | WIRED | Ligne 35 import, ligne 64 appel avec 5 deps |
| `calculer-toutes-alertes.ts` | 4 calculateurs domaine | imports directs | WIRED | Lignes 31-34, appels lignes 77-80 |
| `accueil.ejs` | `partial-bandeau-alerte.ejs` | include EJS | WIRED | Ligne 33 include pour S2 |
| `baux.ts` | `alerte-irl.ts` | import + appel | WIRED | Ligne 28 import, ligne 165 appel |
| `baux.ts` | `indexations.ejs` | reply.view | WIRED | Ligne 180 render avec alertesIrl + locatairesParBail |
| `main.ts` | `racine.ts` | app.register | WIRED | Ligne 250, tous les repos injectés dont bailIndexationRepo, cfeRepo |
| `main.ts` | `alerte-helpers.ts` | preHandler hook | WIRED | Lignes 214-216, les 3 helpers injectés dans reply.locals |
| `accueil.ejs` S2 | page alertes critiques complète | `#toutes-alertes-critiques` | NOT_WIRED | Ancre inexistante dans tout le codebase |
| `accueil.ejs` S4 | page actions du jour complète | `#toutes-actions-jour` | NOT_WIRED | Ancre inexistante dans tout le codebase |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `accueil.ejs` | `alertesCritiques` | `calculerToutesAlertes` → 4 repos DB | Oui — requêtes réelles via `cfeRepo.listerParBien`, `bailRepo.listerTous`, `bienRepo.listerTous`, `bailIndexationRepo.dernierePourBail` | FLOWING |
| `accueil.ejs` | `impayes` | `listerImpayes` → `echeanceLoyerRepo`, `encaissementRepo` | Oui — requêtes réelles | FLOWING |
| `accueil.ejs` | `actionsJour[irl].nomLocataire` | `alerte.source.extra?.['nomLocataire']` via `calculerAlertesIrl` | Non — `calculerAlertesIrl` ne produit que `adresseBien` dans extra | HOLLOW_PROP |
| `accueil.ejs` | `libelleTypeAlerte` pour elec | `alerte-helpers.ts:72` comparaison `'electricite'` | Non — le domaine produit `'elec'` | STATIC (fallback générique toujours retourné) |
| `indexations.ejs` | `alertesIrl` | `calculerAlertesIrl` → `bailRepo`, `bienRepo`, `bailIndexationRepo` | Oui — données réelles | FLOWING |
| `indexations.ejs` | `locatairesParBail` | `locataireRepo.listerTous()` + lookup par bail | Oui — données réelles | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests vitest complets | `pnpm vitest run` | 1065 PASS / 0 FAIL | PASS |
| Tests BDD @phase7 | `pnpm exec cucumber-js --tags "@phase7"` | 28 scénarios / 146 steps verts | PASS |
| TypeScript compilation | `pnpm tsc --noEmit` | 0 erreur | PASS |
| Mismatch 'electricite' vs 'elec' | `grep "electricite" src/web/helpers/alerte-helpers.ts` | Ligne 72 : `typeDiag === 'electricite'` | FAIL (WR-02 confirmé) |
| Ancres "Voir tout" inexistantes | `grep -rn "id=\"toutes-alertes-critiques\"" src/` | 0 résultat | FAIL (WR-01 confirmé) |
| nomLocataire non produit | `grep "nomLocataire" src/domain/locatif/alerte-fin-bail.ts` | 0 résultat | FAIL (WR-03 confirmé) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DAS-01 | 07-05, 07-06 | Dashboard récap synthétique (impayés, échéances à venir, actions du jour) | SATISFIED (avec réserves) | `racine.ts` + `accueil.ejs` implémentent les 4 sections. Réserve : ancres mortes S2/S4 + nomLocataire vide en S4. |
| DAS-02 | 07-01 à 07-04 | Notifications J-30 et J-7 sur échéances critiques (CFE, IRL, DPE/gaz/elec, fin de bail) | PARTIALLY SATISFIED | 4 calculateurs créés, agrégés, affichés. Le label 'Électricité' n'est jamais rendu (WR-02). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/web/helpers/alerte-helpers.ts` | 72 | `typeDiag === 'electricite'` — comparaison avec valeur jamais produite par le domaine (`'elec'` attendu) | BLOCKER | Toutes les alertes diagnostic électricité s'affichent avec libellé générique "Diagnostic" + aria-label incorrect |
| `src/web/views/pages/dashboard/accueil.ejs` | 22 | `href="#toutes-alertes-critiques"` — ancre inexistante | BLOCKER | Inaccessibilité des alertes critiques > top 5 |
| `src/web/views/pages/dashboard/accueil.ejs` | 76 | `href="#toutes-actions-jour"` — ancre inexistante | BLOCKER | Inaccessibilité des actions du jour > top 5 |
| `src/domain/locatif/alerte-fin-bail.ts` | 73-83 | source sans `extra` alors que `alerte-helpers.ts:76` lit `extra?.['nomLocataire']` | WARNING | Libellé "Fin de bail — {locataire}" jamais rendu, code mort dans le helper |
| `src/domain/locatif/alerte-irl.ts` | 103 | `extra: { adresseBien }` uniquement — `nomLocataire` absent alors que `racine.ts:151` le lit | WARNING | S4 IRL n'identifie jamais le locataire |
| `src/domain/locatif/alerte-fin-bail.ts` | 43-45 (JSDoc) | Docstring dit `j <= 60 && j >= -30` mais code exécute `j <= 30 && j >= -60` | WARNING | Risque de "fix inverse" par un futur mainteneur sur une règle juridique (WR-04) |
| `src/domain/locatif/alerte-irl.ts` | 5 | Docstring annonce fenêtre [-30, +30] mais la borne `-30` est inatteignable (dateAnniversaireProchaine retourne toujours une date future) | WARNING | Un bail non indexé le lendemain de l'anniversaire disparaît silencieusement des alertes (WR-05) |
| `tests/_builders/alertes.ts` | 1-111 | Builder entièrement inutilisé (grep 0 usage dans tests/) | INFO | Code mort — ne bloque pas le goal |

### Human Verification Required

#### 1. Rendu visuel de la hiérarchie d'urgence

**Test:** Créer un bail dont la révision IRL est dans 3 jours, ouvrir `GET /`. Vérifier que la section S2 "Alertes critiques" affiche le bandeau avec le fond orange/bordeaux (`warning-fort`) distinct du bandeau `warning` pour une alerte dans 15 jours.
**Expected:** Le bandeau J-3 doit avoir `background: var(--couleur-warning-bg, #FFF4E6)` et le bandeau J-15 une simple bordure gauche sans fond.
**Why human:** Rendu CSS via variables CSS impossibles à vérifier sans navigateur.

#### 2. Comportement du lien externe CFE

**Test:** Depuis une alerte CFE active dans le dashboard, cliquer sur "Régler la CFE sur impots.gouv.fr".
**Expected:** Le lien s'ouvre dans un nouvel onglet (`target="_blank"` confirmé dans le partial). L'URL est bien `https://www.impots.gouv.fr/professionnel/cotisation-fonciere-des-entreprises-cfe`.
**Why human:** Comportement d'ouverture de lien externe — vérifiable dans un vrai navigateur uniquement.

### Gaps Summary

Deux des quatre critères de succès sont en échec ou partiellement en échec. Les lacunes partagent deux causes racines distinctes :

**Cause racine 1 — Mismatch de valeur littérale (WR-02) :** `alerte-helpers.ts:72` compare `'electricite'` alors que `TypeDiagnostic` vaut `'elec'`. La comparaison ne matche jamais. Fix chirurgical, 1 ligne.

**Cause racine 2 — Liens morts et données absentes (WR-01 + WR-03) :** Les ancres `#toutes-alertes-critiques` et `#toutes-actions-jour` n'ont pas été créées. Le champ `nomLocataire` est consommé dans le helper et la route mais jamais produit par les calculateurs de domaine. Ces deux défauts sont liés : ils révèlent que le contrat entre les calculateurs domaine et les consommateurs route/vue n'a pas été entièrement satisfait.

Aucun des deux problèmes n'affecte la cohérence TypeScript (tsc reste vert) ni les tests BDD existants (qui ne vérifient pas que les ancres existent ni que nomLocataire est non-vide). Ils sont donc passés sous le radar des gates automatiques.

---

_Verified: 2026-06-12T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
