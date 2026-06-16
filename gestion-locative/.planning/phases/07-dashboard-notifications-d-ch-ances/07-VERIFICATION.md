---
phase: 07-dashboard-notifications-d-ch-ances
verified: 2026-06-16T00:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Le système notifie à J-30/J-7 sur chaque échéance critique (WR-02 : libellé 'Électricité' pour typeDiagnostic 'elec' — corrigé alerte-helpers.ts:72)"
    - "Une notification déclenchée renvoie en un clic vers l'écran d'action correspondant (WR-01 : ancres mortes #toutes-alertes-critiques et #toutes-actions-jour supprimées/redirigées ; WR-03 : nomLocataire émis par les 2 calculateurs ; UAT test 4 : urlAction diagnostic corrigée vers /biens/:id#diagnostics-heading)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Vérifier le comportement 'J-7 critique' visuellement"
    expected: "Avec une alerte dont joursRestants=5, le bandeau doit afficher une couleur warning-fort (fond orange/bordeaux) différente du warning standard, et le libellé WCAG doit lire 'Échéance dans 5 jours' avec role='alert'"
    why_human: "Rendu visuel CSS — les variables --couleur-warning-bg et --couleur-destructive-bg ne peuvent pas être vérifiées programmatiquement sans rendu navigateur"
    resolution: "APPROUVÉ par l'utilisateur lors du checkpoint human-verify Task 4 de 07-07 (2026-06-16). Hiérarchie warning-fort vs warning confirmée conforme en navigateur."
  - test: "Vérifier que le lien 'Régler la CFE sur impots.gouv.fr' s'ouvre bien dans un nouvel onglet"
    expected: "Clic sur le lien ouvre impots.gouv.fr en nouvel onglet (target='_blank' rel='noopener noreferrer' présent dans le partial)"
    why_human: "Comportement d'ouverture de lien externe — vérifiable visuellement dans un vrai navigateur uniquement"
    resolution: "APPROUVÉ par l'utilisateur lors du checkpoint human-verify Task 4 de 07-07 (2026-06-16). Ouverture nouvel onglet confirmée conforme."
---

# Phase 7 : Dashboard & Notifications d'échéances — Rapport de vérification (re-vérification)

**Phase Goal:** L'utilisateur dispose d'une vue synthétique des actions à mener (impayés, échéances à venir, action du jour) et reçoit des notifications J-30 et J-7 sur toutes les échéances critiques agrégées par les phases précédentes.
**Verified:** 2026-06-16T00:00:00Z
**Status:** passed
**Re-verification:** Oui — après plans de gap-closure 07-07 (WR-01..05) et 07-08 (UAT test 4)

## Re-verification Context

La vérification initiale (2026-06-12) avait retourné `gaps_found` (2/4). Deux plans de fermeture ont été exécutés :

- **07-07** (commits 0ba60c3, 6bed765, 653abf5) : correction libellé 'elec' (WR-02), émission `extra.nomLocataire` dans les 2 calculateurs domaine (WR-03), suppression/redirection des ancres mortes dans `accueil.ejs` (WR-01), réconciliation docs fenêtres juridiques fin-bail `[-30,+60]` et IRL `[0,+30]` (WR-04/WR-05), checkpoint human-verify approuvé par l'utilisateur.
- **07-08** (commit 966fac6) : correction `urlAction` alerte diagnostic de `/biens/:id/diagnostics#diag-dpe` (route 404) vers `/biens/:id#diagnostics-heading` (route GET /biens/:id 200 + ancre id="diagnostics-heading" existante dans detail.ejs:120).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Le dashboard affiche en un coup d'œil les impayés ouverts, les échéances de loyer à venir et les actions du jour (relances dues, indexations IRL imminentes). | VERIFIED | `racine.ts` implémente 4 sections (S2 alertes critiques, S3 impayés, S4 actions du jour, S5 échéances loyer) alimentées par `calculerToutesAlertes`, `listerImpayes`, `calculerRelanceDisponible`, et `listerNonPayees`. Vue `accueil.ejs` rend toutes les sections. Tests BDD `@phase7` : 34 scénarios verts. Pas de régression. |
| 2 | Le dashboard rend visible la hiérarchie d'urgence (en retard / à venir / à jour) sans nécessiter de drill-down pour qualifier la priorité. | VERIFIED | `partial-bandeau-alerte.ejs` implémente 3 variantes visuelles selon `joursRestants` : destructive (j<=0), warning-fort (j<=7), warning (j>=8). L'état global `a_jour` affiche un bandeau de succès. WCAG 1.4.1 respecté (libellé textuel + icône aria-hidden + couleur). Hiérarchie warning-fort vs warning validée visuellement par l'utilisateur (checkpoint Task 4, 07-07). |
| 3 | Le système notifie l'utilisateur à J-30 et J-7 sur chaque échéance critique : paiement CFE, révision IRL annuelle, expiration DPE / gaz / élec, fin de bail. | VERIFIED | 4 calculateurs agrégés. **WR-02 fermé** : `alerte-helpers.ts:72` compare désormais `typeDiag === 'elec'` → retourne `'Électricité'` (confirmé par grep). Test unitaire dédié dans `tests/unit/web/alerte-helpers.test.ts` couvre `libelleTypeAlerte` avec `typeDiagnostic: 'elec'`. 1089 tests verts. |
| 4 | Une notification déclenchée renvoie en un clic vers l'écran d'action correspondant (régler CFE, lancer l'indexation, renouveler diagnostic, préparer renouvellement bail). | VERIFIED | **WR-01 fermé** : ancre morte `#toutes-alertes-critiques` supprimée de S2 (commentaire explicite "pas de lien Voir tout en V1") ; ancre morte `#toutes-actions-jour` remplacée par `href='/baux/indexations'` en S4 (route réelle 07-06). **WR-03 fermé** : `calculerAlertesIrl` (ligne 110) et `calculerAlertesFinBail` (ligne 89) émettent `extra.nomLocataire` via `Map nomLocataireParBail` construite dans le use case (locataireRepo injecté dans `CalculerToutesAlertesDeps`). **UAT test 4 fermé** : `alerte-diagnostic.ts:62` pointe vers `/biens/${bien.id}#diagnostics-heading` ; ancre `id="diagnostics-heading"` existante dans `detail.ejs:120` ; route `GET /biens/:id` → 200. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/domain/_shared/alerte.ts` | TypeAlerte, Alerte, joursAvantEcheance | VERIFIED | Inchangé depuis vérification initiale. |
| `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` | calculerAlertesCfe produit Alerte[] | VERIFIED | Inchangé. |
| `src/domain/locatif/alerte-irl.ts` | calculerAlertesIrl produit Alerte[] + extra.nomLocataire | VERIFIED | 5e param optionnel `nomLocataireParBail?: Map<BailId, string>`. Ligne 110 : `nomLocataire: nomLocataireParBail?.get(bail.id) ?? ''`. |
| `src/domain/locatif/alerte-fin-bail.ts` | calculerAlertesFinBail produit Alerte[] + extra.nomLocataire | VERIFIED | 3e param optionnel `nomLocataireParBail?: Map<string, string>`. Ligne 89 : `extra: { nomLocataire: nomLocataireParBail?.get(bail.id) ?? '' }`. |
| `src/domain/patrimoine/alerte-diagnostic.ts` | calculerAlertesDiagnostic, urlAction vers route existante | VERIFIED | Ligne 62 : `urlAction: \`/biens/${bien.id}#diagnostics-heading\`` — route GET /biens/:id + ancre id="diagnostics-heading" dans detail.ejs:120. |
| `src/application/dashboard/calculer-toutes-alertes.ts` | Agrège 4 sources, locataireRepo injecté, Map nomLocataire | VERIFIED | `CalculerToutesAlertesDeps` inclut `locataireRepo`. Lignes 59-74 : construction `nomLocataireParBail`. Lignes 92/94 : passée aux 2 calculateurs. |
| `src/web/routes/racine.ts` | GET / avec les 4 sections + locataireRepo | VERIFIED | `locataireRepo` dans opts (ligne 49) et passé à `calculerToutesAlertes` (ligne 69). |
| `src/web/views/pages/dashboard/accueil.ejs` | Vue synthétique 4 sections, ancres corrigées | VERIFIED | S2 : commentaire "pas de lien Voir tout en V1", aucune ancre morte. S4 : `href='/baux/indexations'` (ligne 72). `action.nomLocataire` consommé ligne 94. |
| `src/web/helpers/alerte-helpers.ts` | libelleTypeAlerte : 'elec' → 'Électricité', nomLocataire fin_bail | VERIFIED | Ligne 72 : `if (typeDiag === 'elec') return 'Électricité';`. Ligne 77 : `if (nom && String(nom).trim()) return \`Fin de bail — ${String(nom).trim()}\`` — branche maintenant active. |
| `src/web/views/partials/partial-bandeau-alerte.ejs` | Bandeau unifié avec liens d'action | VERIFIED | Inchangé. |
| `src/web/routes/baux.ts` | GET /baux/indexations | VERIFIED | Inchangé. |
| `src/web/views/pages/baux/indexations.ejs` | Table révisions IRL + empty-state | VERIFIED | Inchangé. |
| `tests/unit/web/alerte-helpers.test.ts` | Couverture libelleTypeAlerte avec 'elec' | VERIFIED | Créé dans 07-07, couvre les 3 branches diagnostic + cas fin_bail + nomLocataire. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `racine.ts` | `calculer-toutes-alertes.ts` | import + appel GET / | WIRED | Ligne 35 import, ligne 64 appel avec locataireRepo inclus (ligne 69). |
| `calculer-toutes-alertes.ts` | 4 calculateurs domaine | imports directs | WIRED | Lignes 32-35, appels lignes 91-94. nomLocataireParBail passée aux calculateurs IRL (ligne 92) et fin_bail (ligne 94). |
| `accueil.ejs` | `partial-bandeau-alerte.ejs` | include EJS | WIRED | Ligne 29. |
| `accueil.ejs` S4 | `/baux/indexations` | href statique ligne 72 | WIRED | Route réelle 07-06. WR-01 fermé. |
| `accueil.ejs` S2 | (aucune cible V1) | commentaire explicite | RESOLVED | Lien "Voir tout" alertes critiques supprimé — aucune page dédiée n'existe en V1. |
| `alerte-diagnostic.ts` | `GET /biens/:id#diagnostics-heading` | urlAction | WIRED | Route 200 confirmée ; ancre id="diagnostics-heading" dans detail.ejs:120. UAT test 4 fermé. |
| `nomLocataireParBail` | `calculerAlertesIrl` / `calculerAlertesFinBail` | Map passée en paramètre | WIRED | Use case construit la Map (lignes 67-74), passe aux 2 calculateurs, domaine reste pur (aucun import repo). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `accueil.ejs` | `alertesCritiques` | `calculerToutesAlertes` → 4 repos DB | Oui — requêtes réelles | FLOWING |
| `accueil.ejs` | `impayes` | `listerImpayes` → `echeanceLoyerRepo`, `encaissementRepo` | Oui | FLOWING |
| `accueil.ejs` | `actionsJour[irl].nomLocataire` | `alerte.source.extra?.['nomLocataire']` via `calculerAlertesIrl` | Oui — `nomLocataireParBail` peuplée depuis `locataireRepo.listerTous()` | FLOWING (WR-03 fermé) |
| `accueil.ejs` | `libelleTypeAlerte` pour elec | `alerte-helpers.ts:72` comparaison `'elec'` | Oui — retourne `'Électricité'` | FLOWING (WR-02 fermé) |
| `partial-bandeau-alerte.ejs` | `alerte.urlAction` pour diagnostic | `alerte-diagnostic.ts:62` | Oui — `/biens/${bien.id}#diagnostics-heading` (route 200 + ancre existante) | FLOWING (UAT test 4 fermé) |
| `indexations.ejs` | `alertesIrl` + `locatairesParBail` | `calculerAlertesIrl` → repos réels | Oui | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests vitest complets | `pnpm vitest run` | 1089 PASS / 0 FAIL | PASS |
| Tests BDD @phase7 | `pnpm exec cucumber-js --tags "@phase7"` | 34 scénarios / 175 steps verts | PASS |
| TypeScript compilation | `pnpm tsc --noEmit` | 0 erreur | PASS |
| Correction 'elec' (WR-02) | `grep "typeDiag === 'elec'" src/web/helpers/alerte-helpers.ts` | Ligne 72 : match | PASS |
| 'electricite' supprimé (WR-02) | `grep "electricite" src/web/helpers/alerte-helpers.ts` | 0 résultat | PASS |
| Ancres mortes supprimées (WR-01) | `grep "toutes-alertes-critiques\|toutes-actions-jour" src/web/views/pages/dashboard/accueil.ejs` | 0 résultat | PASS |
| S4 redirigée vers /baux/indexations | `grep "/baux/indexations" src/web/views/pages/dashboard/accueil.ejs` | Ligne 72 : match | PASS |
| nomLocataire IRL produit (WR-03) | `grep "nomLocataire" src/domain/locatif/alerte-irl.ts` | Ligne 110 | PASS |
| nomLocataire fin-bail produit (WR-03) | `grep "nomLocataire" src/domain/locatif/alerte-fin-bail.ts` | Ligne 89 | PASS |
| urlAction diagnostic corrigée (UAT 4) | `grep "diagnostics-heading" src/domain/patrimoine/alerte-diagnostic.ts` | Ligne 62 | PASS |
| Ancre id=diagnostics-heading existante | `grep "id=\"diagnostics-heading\"" src/web/views/pages/biens/detail.ejs` | Ligne 120 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DAS-01 | 07-05, 07-06, 07-07 | Dashboard récap synthétique (impayés, échéances à venir, actions du jour) | SATISFIED | `racine.ts` + `accueil.ejs` + ancres mortes corrigées + nomLocataire visible dans S4. |
| DAS-02 | 07-01..07-04, 07-07, 07-08 | Notifications J-30 et J-7 sur échéances critiques (CFE, IRL, DPE/gaz/elec, fin de bail) | SATISFIED | 4 calculateurs. Label 'Électricité' correctement rendu. urlAction diagnostic vers route 200. |

### Anti-Patterns Resolved

Les blockers identifiés dans la vérification initiale sont tous fermés :

| File | Line | Pattern | Severity | Resolution |
|------|------|---------|----------|------------|
| `src/web/helpers/alerte-helpers.ts` | 72 | ~~`typeDiag === 'electricite'`~~ → `typeDiag === 'elec'` | BLOCKER → CLOSED | Commit 0ba60c3 (07-07) |
| `src/web/views/pages/dashboard/accueil.ejs` | 22 | ~~`href="#toutes-alertes-critiques"`~~ → supprimé | BLOCKER → CLOSED | Commit 653abf5 (07-07) |
| `src/web/views/pages/dashboard/accueil.ejs` | 76 | ~~`href="#toutes-actions-jour"`~~ → `href="/baux/indexations"` | BLOCKER → CLOSED | Commit 653abf5 (07-07) |
| `src/domain/locatif/alerte-fin-bail.ts` | 89 | `source` sans `extra` → `extra: { nomLocataire }` | WARNING → CLOSED | Commit 6bed765 (07-07) |
| `src/domain/locatif/alerte-irl.ts` | 110 | `extra` sans `nomLocataire` → `nomLocataire` ajouté | WARNING → CLOSED | Commit 6bed765 (07-07) |
| `src/domain/locatif/alerte-fin-bail.ts` | 43-45 (JSDoc) | Doc `[-30,+60]` alignée avec code `j <= 30 && j >= -60` | WARNING → CLOSED | Commit 6bed765 (07-07) |
| `src/domain/locatif/alerte-irl.ts` | 5 | Doc forward-only `[0,+30]` réconciliée ; borne -30 documentée défensive/inatteignable | WARNING → CLOSED | Commit 6bed765 (07-07) |
| `src/domain/patrimoine/alerte-diagnostic.ts` | 62 | ~~`/biens/:id/diagnostics#diag-dpe`~~ → `/biens/:id#diagnostics-heading` | BLOCKER → CLOSED | Commit 966fac6 (07-08) |

Aucun nouvel anti-pattern détecté dans les fichiers modifiés.

### Human Verification Required

Les deux checkpoints visuels requis ont été approuvés par l'utilisateur lors du checkpoint human-verify Task 4 de 07-07 (2026-06-16) :

1. **Hiérarchie d'urgence warning-fort vs warning** — Confirmée conforme en navigateur (fond orange/bordeaux pour J<=7, bordure gauche simple pour J>7). APPROUVÉ.
2. **Lien CFE impots.gouv.fr en nouvel onglet** — `target="_blank" rel="noopener noreferrer"` confirmé fonctionnel. APPROUVÉ.

Aucun nouvel item de vérification humaine requis.

### Gaps Summary

Aucun gap résiduel. Les 2 truths précédemment en échec sont maintenant VERIFIED :

- **Truth #3** (libellé type diagnostic) : WR-02 fermé — `'elec'` comparaison correcte, `'Électricité'` rendu, test unitaire dédié.
- **Truth #4** (navigation en un clic) : WR-01 + WR-03 + UAT test 4 fermés — ancres mortes supprimées/redirigées, `nomLocataire` produit dans les 2 calculateurs, `urlAction` diagnostic vers route 200 avec ancre existante.

---

_Verified (re-vérification): 2026-06-16T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
