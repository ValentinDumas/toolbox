---
phase: 02-quittancement-ch-ances-encaissements-relances
plan: 07
verified: 2026-05-16T10:25:00Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 02 Plan 07: Gap Closure (G3–G8) — Rapport de vérification

**Objectif du plan :** Fermeture des 6 gaps UAT phase 02 — CTA conditionnel empty-state (G3), déduplication bannière succès (G4), affichage actifDepuis fiche bail (G5), route globale /echeances avec filtres (G6), discoverability CTA quittances (G7), page intermédiaire mailto relances (G8).
**Vérifié :** 2026-05-16T10:25:00Z
**Statut :** passed
**Re-vérification :** Non — vérification initiale du plan 02-07

## Atteinte de l'objectif

### Vérités observables

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| G3 | empty-state.ejs ne rend aucun élément CTA quand ctaUrl=null ou ctaLabel=null | VERIFIED | `src/web/views/partials/empty-state.ejs` ligne 4 : `<% if (locals.ctaUrl && locals.ctaLabel) { %>` — conditionnel strict. Test `tests/unit/views/empty-state.test.ts` couvre les 4 branches (CTA présent, ctaLabel null, ctaUrl null, les deux null) avec assertion `html.match(/<a\b/)` toBeNull. |
| G4 | aucune bannière succès dupliquée — layout-debut.ejs ligne 24 reste l'unique point de rendu | VERIFIED | Grep sur les 5 pages (profil.ejs, baux/detail.ejs, quittances/liste.ejs, quittances/fiche.ejs, relances/liste.ejs) : 0 occurrence de `banniere-success`. `src/web/views/partials/layout-debut.ejs` ligne 24 : seul include restant. |
| G5 | fiche bail affiche `Actif depuis : DD/MM/YYYY` quand bail.actifDepuis !== null — invisible pour brouillons | VERIFIED | `src/web/views/pages/baux/detail.ejs` lignes 45-47 : `<% if (bail.actifDepuis !== null) { %><dt>Actif depuis</dt><dd><%= formatDate(bail.actifDepuis) %></dd>`. Rendu conditionnel confirmé (null = rien affiché). |
| G6 | GET /echeances liste toutes les échéances avec filtres ?bail= et ?statut= cumulables | VERIFIED | `src/web/routes/echeances.ts` ligne 38 : `app.get('/echeances', ...)` appelle `listerToutesEcheances(filtres, opts.echeanceLoyerRepo)`. Port `EcheanceLoyerRepository.listerTous(filtres?)` ligne 35. SQLite adapter ligne 109 implémente filtres bailId + statut avec ORDER BY. Vue `liste-globale.ejs` : `<form method="GET" action="/echeances">` avec `<select name="bail">` et `<select name="statut">`. Sidebar : lien "Toutes les échéances" → `/echeances`. |
| G7 | /quittances affiche CTA "Émettre une quittance" → /echeances?statut=payee — TOUJOURS visible | VERIFIED | `src/web/views/pages/quittances/liste.ejs` ligne 12 : `<a href="/echeances?statut=payee" role="button">Émettre une quittance</a>` — positionné avant le bloc conditionnel `if quittancesEnrichies.length === 0`, donc unconditionnellement visible. Empty-state également mis à jour avec le même ctaUrl. |
| G8 | POST /relances canal='email' retourne HTML 200 avec page ouverture-mail.ejs contenant window.location.href + fallback + retour /impayes | VERIFIED | `src/web/routes/relances.ts` ligne 118 : `reply.view('pages/relances/ouverture-mail.ejs', { mailtoUri, niveau, retourUrl: '/impayes', navActive: 'relances' })`. Vue `ouverture-mail.ejs` : `window.location.href = <%- JSON.stringify(mailtoUri) %>` (auto-trigger), `<a href="<%= mailtoUri %>">Ouvrir le mail</a>` (fallback), `<a href="<%= retourUrl %>">← Retour aux impayés</a>`. Test integration `relances-mailto.test.ts` (T1 canal email HTML 200 + T2 régression PDF). |

**Score :** 6/6 vérités confirmées

### Artefacts requis

| Artefact | Description | Statut | Détails |
|----------|-------------|--------|---------|
| `src/web/views/partials/empty-state.ejs` | CTA conditionnel G3 | VERIFIED | 10 lignes, contient `if (locals.ctaUrl && locals.ctaLabel)`, substantif |
| `src/web/views/pages/echeances/liste-globale.ejs` | Vue globale /echeances + filtres G6 | VERIFIED | 92 lignes, form GET, 2 selects (bail + statut), tableau 7 colonnes, empty-state |
| `src/web/views/pages/relances/ouverture-mail.ejs` | Page intermédiaire mailto G8 | VERIFIED | 26 lignes, window.location.href + fallback + retour /impayes |
| `src/web/routes/echeances.ts` | Route GET /echeances globale G6 | VERIFIED | 271 lignes, `app.get('/echeances'` présent ligne 38 |
| `src/web/routes/relances.ts` | Branche canal='email' → reply.view G8 | VERIFIED | 188 lignes, `reply.view('pages/relances/ouverture-mail.ejs'` ligne 118 |
| `src/web/views/pages/quittances/liste.ejs` | CTA above-the-fold G7 | VERIFIED | CTA ligne 12, avant le `if length === 0` |
| `src/web/views/pages/baux/detail.ejs` | Affichage actifDepuis G5 | VERIFIED | Conditionnel `bail.actifDepuis !== null` ligne 45 |
| `src/domain/encaissements/echeance-loyer-repository.ts` | Port listerTous avec filtres optionnels | VERIFIED | `listerTous(filtres?: { bailId?, statut? })` ligne 35 |
| `tests/unit/views/empty-state.test.ts` | 4 branches render test G3 | VERIFIED | 34 lignes, 4 cas couverts (présent, ctaLabel null, ctaUrl null, les deux null) |
| `tests/integration/web/relances-mailto.test.ts` | T1 email HTML 200 + T2 régression PDF G8 | VERIFIED | 202 lignes, 2 tests integration |
| `tests/bdd/features/gaps-g6-g7.feature` | Scénarios BDD @gap-G6 + @gap-G7 | VERIFIED | 46 lignes |
| `tests/bdd/step_definitions/gaps-g6-g7.steps.ts` | Step definitions BDD | VERIFIED | 305 lignes |

### Vérification des liens clés

| De | Vers | Via | Statut | Détails |
|----|------|-----|--------|---------|
| `src/web/routes/relances.ts` | `src/web/views/pages/relances/ouverture-mail.ejs` | `reply.view('pages/relances/ouverture-mail.ejs', { mailtoUri, niveau, retourUrl: '/impayes' })` canal='email' | WIRED | Ligne 118, bloc conditionnel canal email (niveaux 1-2) |
| `src/web/views/pages/quittances/liste.ejs` | `/echeances?statut=payee` | CTA `<a href="/echeances?statut=payee">` ligne 12 | WIRED | Lien direct vers liste-globale.ejs filtrée statut=payee |
| `src/web/routes/echeances.ts` | `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts` | `listerToutesEcheances(filtres, opts.echeanceLoyerRepo)` → `repo.listerTous(filtres)` | WIRED | Ligne 49, filtres bailId + statut transmis |
| `src/web/views/pages/baux/detail.ejs` | `src/helpers/format-date.ts` | `<%= formatDate(bail.actifDepuis) %>` conditionnel | WIRED | Ligne 47, formatDate injecté via helper EJS |

### Trace de flux de données (Niveau 4)

| Artefact | Variable | Source | Données réelles | Statut |
|----------|----------|--------|-----------------|--------|
| `pages/echeances/liste-globale.ejs` | `echeances`, `bails`, `lignes` | `listerToutesEcheances()` → `echeanceLoyerRepo.listerTous(filtres)` + enrichissement async locataire/bail | SQLite query avec ORDER BY periode_debut DESC, filtres optionnels | FLOWING |
| `pages/relances/ouverture-mail.ejs` | `mailtoUri`, `niveau`, `retourUrl` | Construit par `enregistrerRelance` → `buildMailto({to, subject, body})` depuis données DB locataire | URI mailto RFC 6068, données persistées en DB | FLOWING |

### Vérifications comportementales

| Comportement | Commande | Résultat | Statut |
|--------------|---------|---------|--------|
| Tests unitaires (190 tests) | `pnpm test:unit` | 30 fichiers, 190 passed | PASS |
| Tests intégration (67 tests) | `pnpm test:integration` | 16 fichiers, 67 passed | PASS |
| BDD scenarios (47 scenarios) | `pnpm test:bdd` | 47 scenarios, 245 steps, 0 failures | PASS |
| TypeScript compilation | `pnpm tsc --noEmit` | 0 erreurs | PASS |

### Exécution des probes

Aucun probe déclaré ou conventionnel trouvé pour ce plan. Étape ignorée.

### Couverture des exigences

| Exigence | Plan source | Description | Statut | Preuve |
|----------|------------|-------------|--------|--------|
| ENC-02 | 02-07 | Avis d'échéance — vue globale /echeances (G6 étend le périmètre) | SATISFIED | Route GET /echeances, listerTous, liste-globale.ejs |
| ENC-03 | 02-07 | Saisie Encaissement — discoverability depuis /quittances (G7) | SATISFIED | CTA /echeances?statut=payee dans quittances/liste.ejs |
| ENC-04 | 02-07 | Calcul impayés — empty-state conditionnel (G3) corrige UX | SATISFIED | empty-state.ejs conditionnel, test render 4 branches |
| ENC-05 | 02-07 | Relances — canal email ouvre client mail (G8) | SATISFIED | ouverture-mail.ejs, window.location.href, tests intégration T1+T2 |

### Anti-patterns détectés

| Fichier | Ligne | Pattern | Sévérité | Impact |
|---------|-------|---------|----------|--------|
| `src/web/views/pages/relances/ouverture-mail.ejs` | 23 | `<%- JSON.stringify(mailtoUri) %>` — injection non-HTML-échappée | INFO | Reconnu dans SUMMARY comme menace XSS résiduelle acceptée. `JSON.stringify` échappe `"` et `\` ; mailtoUri construit par le serveur depuis données DB non contrôlables par l'utilisateur dans ce flux single-user. Risque résiduel documenté et acceptable pour ce profil d'usage. |

Aucun marqueur `TBD`, `FIXME`, `XXX` dans les fichiers produits. Aucun placeholder ni implémentation stub.

### Vérification humaine requise

Aucun item — toutes les vérités sont confirmables programmatiquement et couvertes par les suites de tests (190 unit + 67 integration + 47 BDD scenarios, 0 failure).

### Résumé

Les 6 gaps UAT de la phase 02 sont fermés et vérifiés dans le code :

- **G3** : empty-state.ejs est conditionnel avec test prouvant les 4 branches.
- **G4** : les 5 pages ne ré-incluent plus banniere-success — layout-debut.ejs est l'unique point de rendu.
- **G5** : baux/detail.ejs affiche `Actif depuis` conditionnellement via formatDate.
- **G6** : route GET /echeances globale avec filtres bail+statut câblée de la route jusqu'au SQLite via use case hexagonal.
- **G7** : CTA "Émettre une quittance" positionné au-dessus de la table (ligne 12), toujours visible.
- **G8** : canal email retourne reply.view ouverture-mail.ejs avec window.location.href + fallback, couvert par test intégration T1 (HTML 200) + T2 (régression PDF).

Suites de tests : 190 unit + 67 integration + 47 BDD (245 steps) — 100 % passed. TypeScript : 0 erreur.

---

_Vérifié : 2026-05-16T10:25:00Z_
_Verifier : Claude (gsd-verifier)_
