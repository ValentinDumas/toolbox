---
phase: 04-coffre-documentaire-travaux
plan: 02
plan_id: 04-02
subsystem: documents

tags: [phase-4, documents, recherche, corbeille, purge, retention-10y, fiches-augmentees, modifier-metadata, D-120]

# Dependency graph
requires:
  - phase: 04-coffre-documentaire-travaux
    provides: [Justificatif aggregate, JustificatifRepository, StockageJustificatifs port, BC Documents complet, typeIn future-proof D-120]

provides:
  - "7 use cases application/documents : rechercher (5 filtres), lister-corbeille, restaurer, purger (gate D-109 3 branches), modifier (patch metadata D-103 re-valide), lister-par-bien, lister-par-locataire"
  - "constante TYPES_AUTORISES_LOCATAIRE (D-120 verbatim : piece_locataire, releve_bancaire, attestation, autre)"
  - "filtresCoffreSchema Zod + modifierJustificatifSchema Zod (T-04-10 + T-04-14 mitigate)"
  - "partial-filters-coffre.ejs (UI-3.2 form GET 5 filtres + Effacer)"
  - "pages/coffre/corbeille.ejs (UI-5.1 colonnes verbatim + bouton purger disabled WCAG 2.5.5/1.4.13)"
  - "pages/justificatifs/modifier.ejs (UI-4.4 sans fichier)"
  - "section Documents fiche Bien (UI-5.4)"
  - "section Documents fiche Locataire filtrable D-120 (UI-5.4 + 4 liens filtre type)"
  - "6 routes /coffre/corbeille + /justificatifs/:id/restaurer + /purger + /modifier (GET + POST)"
  - "pagination 20/page sur /coffre préservant les query params"

affects: [04-03-travaux, 05-fiscalite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern : use case avec gate domaine (D-109 peutEtrePurge) testé 3 branches"
    - "Pattern : modifier-metadata via creer({...toProps(), patch}) re-valide invariants (défense en profondeur — Zod schema + use case force champs immuables depuis existant.toProps())"
    - "Pattern : transaction Kysely + cleanup best-effort hors trx (Pattern 5 wave 1 adapté à hard-delete au lieu de soft-delete)"
    - "Pattern : URL params verbeux préservés dans pagination (helper paginationUrl inline EJS)"
    - "Pattern : fiches augmentées avec dépendance optionnelle (justificatifRepo?: JustificatifRepository) — backward-compatible si non passé"
    - "Pattern : empty states 4 contextes verbatim D-119 (filtré, corbeille, doc bien, doc locataire)"

key-files:
  created:
    - "src/application/documents/rechercher-justificatifs.ts"
    - "src/application/documents/lister-corbeille.ts"
    - "src/application/documents/restaurer-justificatif.ts"
    - "src/application/documents/purger-justificatif.ts"
    - "src/application/documents/modifier-justificatif.ts"
    - "src/application/documents/lister-justificatifs-par-bien.ts"
    - "src/application/documents/lister-justificatifs-par-locataire.ts"
    - "src/web/views/pages/coffre/corbeille.ejs"
    - "src/web/views/pages/justificatifs/modifier.ejs"
    - "src/web/views/partials/partial-filters-coffre.ejs"
    - "tests/unit/documents/use-cases.test.ts"
    - "tests/unit/documents/purger-justificatif.test.ts"
  modified:
    - "src/web/routes/coffre.ts (GET /coffre + GET /coffre/corbeille + 4 nouvelles routes)"
    - "src/web/routes/biens.ts (justificatifRepo + section Documents fiche Bien)"
    - "src/web/routes/locataires.ts (justificatifRepo + filtre type Zod + section Documents D-120)"
    - "src/web/schemas/justificatif-schemas.ts (+ filtresCoffreSchema + modifierJustificatifSchema)"
    - "src/web/views/pages/coffre/liste.ejs (filtres partial + pagination + empty state filtré)"
    - "src/web/views/pages/biens/detail.ejs (section Documents UI-5.4)"
    - "src/web/views/pages/locataires/detail.ejs (section Documents UI-5.4 + 4 filtres type)"
    - "src/main.ts (passe justificatifRepo aux plugins biens + locataires)"
    - "tests/bdd/features/coffre.feature (+15 scénarios @doc-02 + @doc-03)"
    - "tests/bdd/step_definitions/coffre.steps.ts (+steps Wave 2 + escape HTML pour bannières apostrophe)"
    - "tests/unit/documents/justificatif.test.ts (+modifier-via-creer)"
    - "tests/integration/repositories/justificatif-repository-sqlite.test.ts (+LIKE + facettes + pagination 25 + ORDER BY corbeille_le + typeIn 4 D-120)"
    - "tests/_builders/documents.ts (+desJustificatifsPourPagination)"

key-decisions:
  - "D-109 (rétention 10 ans hard-block — gate domaine ET use case, défense en profondeur)"
  - "D-110 (recherche SQL LIKE case-insensitive + 5 facettes combinables — search/bien/locataire/annee/type + pagination)"
  - "D-111 (page /coffre/corbeille séparée — pas de tab inline)"
  - "D-119 (4 empty states verbatim : coffre filtré, corbeille, doc bien, doc locataire)"
  - "D-120 (dossier locataire = filtrage par 4 types autorisés — pas d'agrégat dédié)"
  - "UI-3.2 (filtres barre haute compacte, form GET)"
  - "UI-3.3 (URL params verbeux ?search=&bien=&locataire=&annee=&type=&page=)"
  - "UI-4.4 (modifier metadata sans toucher au fichier — défense en profondeur Zod + use case)"
  - "UI-5.1 (corbeille colonnes + bouton purger disabled avec aria-disabled + title + aria-describedby)"
  - "UI-5.4 (section Documents fiche Bien + Locataire augmentées)"
  - "UI-6.1/UI-6.2/UI-6.3 verbatim (Conservation légale obligatoire jusqu'au {date}. + Effacer les filtres + Document mis à jour. + Document restauré. + Document supprimé définitivement.)"

patterns-established:
  - "Pattern 6 : gate domaine + use case parallèle — D-109 garde est dans Justificatif.peutEtrePurge ET dans purger-justificatif.ts. T-04-13 impossible à contourner via HTTP."
  - "Pattern 7 : modifier via creer({...toProps(), patch}) — force re-validation invariants D-103 + force champs immuables depuis instance existante (T-04-14 défense en profondeur niveau use case)"
  - "Pattern 8 : best-effort cleanup post-purge — row supprimée commit, fichier orphelin tolérable (log warn, pas de rollback). Réparable manuellement si ENOENT."
  - "Pattern 9 : pagination URL params verbeux — helper paginationUrl(page) inline préserve search/bien/locataire/annee/type"
  - "Pattern 10 : fiches augmentées avec dépendance optionnelle — opts.justificatifRepo? permet tests biens/locataires Wave 1 sans casser, et tests Wave 2 avec section Documents intégrée"

requirements-completed: [DOC-01, DOC-02, DOC-03]

# Metrics
duration: ~24min
completed: 2026-05-18
---

# Phase 04 Plan 02: Documents extras — recherche + corbeille + modifier + fiches augmentées Summary

**Recherche facettée 5 filtres + gestion corbeille avec gate D-109 (rétention 10 ans hard-block UI-6.2) + modifier metadata sans toucher au fichier + sections Documents augmentées sur fiches Bien (UI-5.4) et Locataire (D-120 — filtrage 4 types autorisés).**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-18T13:45:41Z
- **Completed:** 2026-05-18T14:10:03Z
- **Tasks:** 3 (RED foundation + GREEN use cases + Wire UI)
- **Commits:** 3 task commits + 1 docs metadata
- **Tests added:** 20 unit (use-cases) + 5 unit (purger 3 branches) + 9 integration (LIKE + facettes + pagination + ORDER BY + typeIn D-120) + 14 BDD (@doc-02 + @doc-03 extras) = **48 nouveaux tests**
- **Files created:** 12 (7 use cases + 3 EJS + 2 tests)
- **Files modified:** 13 (routes, schemas, EJS, builders, tests)

## Accomplishments

- **7 use cases BC Documents** complets : recherche facettée (5 filtres combinables + pagination 20 cap 100), corbeille (lister), restauration (copy-on-write `corbeille_le=null`), purge (gate D-109 3 branches — pas en corbeille / avant 10 ans / après 10 ans hard-delete + cleanup), modifier metadata (UI-4.4 patch avec re-validation D-103), fiche Bien (5 derniers), fiche Locataire (4 types D-120).
- **Constante `TYPES_AUTORISES_LOCATAIRE`** exportée depuis `lister-justificatifs-par-locataire.ts` avec les 4 valeurs D-120 verbatim.
- **6 nouvelles routes Fastify** : `GET /coffre/corbeille`, `POST /justificatifs/:id/restaurer`, `POST /justificatifs/:id/purger`, `GET /justificatifs/:id/modifier`, `POST /justificatifs/:id/modifier`. `GET /coffre` étendu avec filtres + pagination.
- **2 nouvelles EJS pages** : `coffre/corbeille.ejs` + `justificatifs/modifier.ejs` + 1 partial `partial-filters-coffre.ejs`.
- **2 fiches augmentées** : sections Documents sur fiches Bien et Locataire (UI-5.4). Locataire dispose de 4 liens filtres type (D-120 — Tous / Pièces locataire / Relevés bancaires / Attestations / Autres).
- **Pagination 20/page** sur `/coffre` préservant les filtres dans les liens précédent/suivant (helper inline `paginationUrl`).
- **Empty states verbatim D-119** : coffre filtré, corbeille vide, doc Bien vide, doc Locataire vide — 4 contextes.
- **Bouton "Purger définitivement" disabled** avant 10 ans avec `aria-disabled="true"` + `title="Disponible le {date}"` + `aria-describedby="purge-date-{id}"` + touch ≥ 44x44px (WCAG 2.5.5 + 1.4.13).
- **14 nouveaux scénarios BDD `@phase4`** verts (T9–T22, tags @doc-02 + @doc-03) — total Phase 4 = **21 scénarios verts**.
- **Coverage** : `purger-justificatif.ts` lignes 100% (3 branches D-109 testées en unit), `justificatif.ts` domain reste à 98%.

## Task Commits

1. **Task 1 (RED foundation)** — `fbdf8f3` (test) — 5 fichiers : feature + step defs + unit + integration + builders
2. **Task 2 (GREEN use cases)** — `a2b661e` (feat) — 7 fichiers : 7 use cases application/documents (rechercher, lister-corbeille, restaurer, purger, modifier, lister-par-bien, lister-par-locataire)
3. **Task 3 (Wire UI + Cucumber GREEN)** — `a04bb53` (feat) — 14 fichiers : 6 routes + 2 fiches augmentées + 3 EJS + 2 schemas Zod + 2 nouveaux tests unit use cases

## Verification

| Étape | Résultat |
|-------|----------|
| `pnpm typecheck` | ✅ 0 erreur |
| `pnpm depcruise src --config .dependency-cruiser.cjs` | ✅ 0 violation (163 modules, 734 dependencies cruised) |
| `pnpm vitest run` (unit + integration) | ✅ **525 tests verts** (+34 vs Wave 1 baseline 491→525) |
| `pnpm test:bdd --tags @phase4` | ✅ **21/21 scénarios verts** (7 Wave 1 + 14 Wave 2) |
| `pnpm test:bdd` (tous) | ✅ **96/96 scénarios verts** |
| `pnpm exec eslint src/application/documents/` (nouveaux files) | ✅ 0 warning |
| Snapshots EJS Phase 3 | ✅ 17/17 toujours verts (aucune régression) |

## Files Created/Modified

Voir frontmatter `key-files`. 12 fichiers créés, 13 modifiés.

## Decisions Made

Toutes les décisions D-109 → D-120 + UI-3.2 → UI-6.3 du plan ont été respectées verbatim. Aucune décision additionnelle nécessaire.

**Point d'attention pour la suite (04-03)** : le BC Documents est complet et stable. `JustificatifRepository.rechercher` expose les 5 filtres + `typeIn` consommé par `lister-justificatifs-par-locataire`. Phase 04-03 (travaux) consommera directement les use cases existants (notamment `uploaderJustificatif` pour les pièces jointes du ticket).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Step BDD "la session porte la bannière" devait gérer l'apostrophe HTML-escaped**

- **Found during:** Task 3 (Wire UI + Cucumber GREEN — scénario T18 Purge bloquée avant 10 ans)
- **Issue:** La verbatim UI-6.2 contient `jusqu'au` (apostrophe). EJS escape automatiquement les apostrophes en `&#39;` dans `<%= %>`. Le step Cucumber comparait la verbatim brute au corps HTML, donc `body.includes("jusqu'au")` retournait `false` alors que la bannière était bien rendue avec `&#39;`.
- **Fix:** Étendu le step `Then la session porte la bannière "..."` pour tester l'inclusion sur 2 variantes : brute ET HTML-escaped (`'` → `&#39;`, `"` → `&#34;`, `<` → `&lt;`, etc.). Approche minimale, préserve la verbatim UI-6.2 sans modifier le partial `warning-live` (qui sert aussi à Phase 1/2/3 — éviter régressions).
- **Files modified:** `tests/bdd/step_definitions/coffre.steps.ts`
- **Verification:** T18 passe (`la session porte la bannière "Conservation légale obligatoire jusqu'au 18/05/2036..."`).
- **Committed in:** `a04bb53` (Task 3)

**2. [Rule 2 - Missing critical] Ajout d'un fallback "filtres invalides → defaults" sur GET /coffre**

- **Found during:** Task 3 (Wire UI — validation Zod filtres)
- **Issue:** Le plan demandait `filtresCoffreSchema.parse(req.query)` mais sans préciser le comportement si Zod fail (UUID malformé, type invalide, page=-5). Renvoyer 400 serait hostile UX (un utilisateur qui tape une URL avec un mauvais paramètre voit une page d'erreur). Renvoyer 500 (Zod throw) serait pire.
- **Fix:** Pattern fallback silent : `parsed.success ? parsed.data : { page: 1 }`. Les filtres invalides sont silencieusement ignorés (UX dégradée mais pas crash). La validation Zod garde son rôle de défense (T-04-10), mais on tolère les erreurs d'input côté liste car le coût d'un faux positif est faible.
- **Files modified:** `src/web/routes/coffre.ts`
- **Verification:** Tests BDD T9/T13 verts (filtres invalides ne plantent pas).
- **Committed in:** `a04bb53` (Task 3)

**3. [Rule 1 - Bug] Ajout de tests unit dédiés pour atteindre 100% coverage purger-justificatif.ts**

- **Found during:** Task 3 (verification coverage avant final commit)
- **Issue:** Le plan demandait 100% coverage sur `purger-justificatif.ts` (3 branches D-109). Mais la coverage vitest exclut les exécutions cucumber, et les use cases n'étaient testés QUE via BDD. Résultat : 0% coverage vitest sur les 7 use cases.
- **Fix:** Créé `tests/unit/documents/use-cases.test.ts` (20 tests) + `tests/unit/documents/purger-justificatif.test.ts` (5 tests dédiés aux 3 branches D-109 + JustificatifIntrouvable + cleanup ENOENT). Tests vitest avec `vi.fn()` mocks pour le stockage.
- **Files modified:** `tests/unit/documents/use-cases.test.ts` (créé), `tests/unit/documents/purger-justificatif.test.ts` (créé)
- **Verification:** Coverage `purger-justificatif.ts` = 100% lignes, 3 branches D-109 explicitement testées. Coverage globale BC Documents application = 59.39% lignes (le reste est du code Wave 1 exercé uniquement en BDD — pas une régression).
- **Committed in:** `a04bb53` (Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking — Cucumber escape, 1 missing critical — UX fallback, 1 bug — tests coverage manquants).
**Impact on plan:** Aucun scope creep. Les 3 corrections sont nécessaires pour atteindre l'état "tous tests verts + coverage 100%" exigé. Aucune décision métier modifiée — UI-6.2 verbatim respectée à la lettre.

## Issues Encountered

**Cleanup ENOENT post-purge en environnement test BDD.** Les BDD scénarios créent les justificatifs en corbeille directement via le repo (`enregistrer`) sans écrire de fichier physique. Quand `purger-justificatif.ts` essaie ensuite `stockage.supprimer(cheminFichier)`, ça jette `ENOENT`. Le use case loggue un warning et continue (best-effort cleanup). Comportement correct côté production : si le fichier n'existe pas, on tolère. Le log warn est attendu en BDD et n'affecte aucun test.

**Coverage globale (60% lines) sous le seuil 80%.** Pre-existing condition (déjà 60% avant Wave 2). Les use cases Wave 1 (`uploader-justificatif`, `mettre-justificatif-en-corbeille`, `lire-justificatif`) ne sont testés QUE via BDD, pas vitest. Hors scope Wave 2 — à adresser si nécessaire dans une future itération.

**Node version warning.** Environnement Node 20.20.1 vs `engines.node` `>=22.0.0`. Cosmétique (warning pnpm), n'affecte aucun test.

## Threat Flags

Aucun threat flag nouveau découvert. Tous les threats du `<threat_model>` du plan ont été mitigés :

| ID | Mitigation appliquée | Fichier |
|----|----------------------|---------|
| T-04-10 (T) | `filtresCoffreSchema` Zod : UUID + integer + enum + page≥1 + search≤200 chars | `src/web/schemas/justificatif-schemas.ts:111+` |
| T-04-11 (I) | Kysely `.where('titre', 'like', pattern)` bind params (jamais string concat) | `src/infrastructure/repositories/justificatif-repository-sqlite.ts:85-93` (Wave 1) |
| T-04-12 (E) | `purger-justificatif.ts` check `corbeille_le === null` AVANT peutEtrePurge + route catch InvariantViolated → bannière warning | `src/application/documents/purger-justificatif.ts:43-47` + `src/web/routes/coffre.ts:495-498` |
| T-04-13 (E) | Use case + domaine `Justificatif.peutEtrePurge` — gate niveau use case impossible à contourner via HTTP | `src/application/documents/purger-justificatif.ts:49-56` + `src/domain/documents/justificatif.ts:219-222` |
| T-04-14 (T) | `modifier-justificatif.ts` force champs immuables depuis `existant.toProps()` (cheminFichier/mimeType/tailleOctets/nomFichierOriginal/creeLe/bienId/locataireId/corbeilleLe/raisonCorbeille). `modifierJustificatifSchema` Zod n'expose PAS ces champs au HTTP. | `src/application/documents/modifier-justificatif.ts:42-58` + `src/web/schemas/justificatif-schemas.ts:155-183` |
| T-04-15 (I) | accept — V1 mono-user local-first | — |
| T-04-16 (D) | accept — pagination 20 + local-first <10k docs typique | — |
| T-04-17 (I) | logs use case purger n'incluent que `cheminFichier` (jamais `notes`) | `src/application/documents/purger-justificatif.ts:69` |

## User Setup Required

Aucun — pas de service externe à configurer. Toutes les fonctionnalités Wave 2 sont du code applicatif + UI sur les infrastructures déjà en place depuis Wave 1.

## Next Phase Readiness

**04-03 (travaux)** prêt à démarrer :
- BC Documents complet — tous les use cases (uploader/lire/mettre-en-corbeille/rechercher/lister-corbeille/restaurer/purger/modifier/lister-par-bien/lister-par-locataire) opérationnels.
- Pattern fiches augmentées + sections Documents existant pour réutilisation (UI-5.4 — fiche Bien aura aussi une section Travaux à ajouter par 04-03).
- `JustificatifRepository` interface stable, exposé via `opts.justificatifRepo` pattern dependency-optional.
- Migration 0010 (tickets_travaux + ticket_justificatifs) déjà appliquée — 04-03 peut consommer directement.

## Self-Check: PASSED

- [x] `src/application/documents/rechercher-justificatifs.ts` existe.
- [x] `src/application/documents/lister-corbeille.ts` existe.
- [x] `src/application/documents/restaurer-justificatif.ts` existe.
- [x] `src/application/documents/purger-justificatif.ts` existe — 3 branches D-109 testées.
- [x] `src/application/documents/modifier-justificatif.ts` existe — défense en profondeur immuables.
- [x] `src/application/documents/lister-justificatifs-par-bien.ts` existe.
- [x] `src/application/documents/lister-justificatifs-par-locataire.ts` existe avec `TYPES_AUTORISES_LOCATAIRE`.
- [x] `src/web/views/pages/coffre/corbeille.ejs` existe.
- [x] `src/web/views/pages/justificatifs/modifier.ejs` existe.
- [x] `src/web/views/partials/partial-filters-coffre.ejs` existe.
- [x] Commit `fbdf8f3` (Task 1 RED) existe : `git log --oneline | grep fbdf8f3`.
- [x] Commit `a2b661e` (Task 2 GREEN use cases) existe.
- [x] Commit `a04bb53` (Task 3 Wire UI) existe.
- [x] `pnpm typecheck` exit 0.
- [x] `pnpm depcruise` exit 0.
- [x] 525/525 vitest verts.
- [x] 21/21 BDD `@phase4` verts (7 Wave 1 + 14 Wave 2).
- [x] 96/96 BDD totaux verts (aucune régression Phase 1/2/3).

---
*Phase: 04-coffre-documentaire-travaux*
*Plan: 02 (documents extras)*
*Completed: 2026-05-18*
