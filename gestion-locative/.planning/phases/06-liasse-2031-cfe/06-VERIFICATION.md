---
phase: 06-liasse-2031-cfe
status: passed
requirements: [FIS-05, FIS-06]
verified_at: 2026-06-04
tests_passing: 1011
bdd_passing: 15
gates:
  typecheck: passed
  lint_deps: passed
  unit_tests: passed
  integration_tests: passed
  bdd_tests: passed
---

# VERIFICATION Phase 6 — Liasse 2031 & CFE

## Verdict global : PASSED

Tous les `must_haves` des 7 plans (06-01 à 06-07) sont vérifiés par tests automatisés
et grep de propriétés statiques. Les requirements FIS-05 et FIS-06 sont entièrement
couverts par le code livré.

## Couverture des requirements

### FIS-05 — Brouillon liasse fiscale 2031

| Sous-requirement | Plan(s) | Vérification | Statut |
|---|---|---|---|
| Liasse 2031-SD + 2033-A/B/C/D régime réel | 06-01 | 4 scénarios BDD `@phase6-liasse-reel` + 20 tests unit `generer-brouillon-liasse` | ✓ |
| Liasse 2042-C-PRO régime micro-BIC | 06-02 | 2 scénarios BDD `@phase6-liasse-micro` + 3 tests unit micro | ✓ |
| Traçabilité sources par case | 06-03 | type `SourceDto` injecté + use case agrège recettes/charges/dotation par case | ✓ |
| Réconciliation snapshot/vivant (D-T6.4 audit) | 06-03 | 8 tests unit `reconciliation.test.ts` (6 déterministes + 2 fast-check) | ✓ |
| Liasse rectificative depuis `DeclarationCorrigee` | 06-04 | 3 tests intégration HTTP + use case branche sur commande discriminée | ✓ |
| Export PDF (archivage) | 06-05 | 2 tests magic bytes `%PDF-` + endpoint `/liasse.pdf` (200 + Content-Disposition RFC 6266) | ✓ |
| Export CSV (expert-comptable, sources) | 06-05 | 3 tests unit CSV (BOM, sanitize injection, colonnes) + endpoint `/liasse.csv` | ✓ |

### FIS-06 — Suivi déclaratif CFE 1447-C-SD

| Sous-requirement | Plan(s) | Vérification | Statut |
|---|---|---|---|
| Agrégat `DeclarationCfe` (D-CFE6.2) | 06-06 | 22 tests unit + brand `DeclarationCfeId`, pattern miroir `TicketTravaux` | ✓ |
| Statut 5 valeurs (D-CFE6.3) | 06-06 | `STATUTS_CFE_VALIDES` strict + invariants typés | ✓ |
| Repo SQLite upsert composite | 06-06 | 5 tests intégration repo + migration `0023_phase6_declaration_cfe.sql` + UNIQUE(bien_id, millesime) | ✓ |
| Use cases enregistrer/modifier/lister | 06-06 | 6 scénarios BDD `@phase6-cfe-suivi` + 5 tests intégration HTTP routes | ✓ |
| Aide pédagogique CGI art. 1478 (D-CFE6.4) | 06-06 | `partial-aide-cfe.ejs` + test route check "CGI art. 1478" + "Service des Impôts" | ✓ |
| Pas de calcul base imposable (R4.3) | 06-06 | grep `calculer.*base|valeur.*locative` sur domain/application/web Phase 6 → 0 résultat | ✓ |
| Alerte CFE J-30 (D-CFE6.5) | 06-07 | 15 tests unit `alerte-cfe-j30` (12 + 3 propriétés fast-check monotonie) + 3 tests intégration banner | ✓ |
| Calcul à la demande via Clock (anti-cron) | 06-07 | Clock injecté au use case, `setInterval`/`setTimeout` absents (anti-pattern §6) | ✓ |

## Gates qualité

| Gate | Résultat |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint:deps` | exit 0 (269 modules, 1319 deps, 0 violation) |
| `pnpm test` | 1011/1011 GREEN (147 fichiers de test) |
| `pnpm test:bdd --tags @phase6` | 15/15 scénarios, 68/68 steps GREEN |
| Hexagonal strict | 0 import infra dans `src/domain/fiscalite/{liasse,cfe}/` |
| CSV injection (T-06-LIASSE-01) | `sanitizeCsvCell` testé (3 tests unit) |
| Path traversal Content-Disposition (T-06-LIASSE-02) | `encodeFilenameRFC6266` réutilisé Phase 4 CR-04 |
| XSS bandeau rectificative (T-06-LIASSE-W3-RECTIF-01) | EJS auto-échappe `<%= motif %>` |
| Mass-assignment CFE (T-06-CFE6-01) | Zod schemas sans `id` ni `bienId` |
| Cross-bien access CFE (T-06-CFE6-05) | route modifier vérifie `decl.bienId === params.id` |
| Filtre statut alerte (pitfall §5 RESEARCH) | `STATUTS_ALERTABLES = {non_deposee, deposee}` testé | 

## Anti-patterns critiques vérifiés (grep statique)

- ✓ `grep -rE "calculer.*base|valeur.*locative" src/domain/fiscalite/cfe/ src/web/views/pages/biens/cfe/ src/web/views/partials/partial-aide-cfe.ejs src/web/routes/biens/cfe.ts` → 0 résultat (R4.3 verrouillé).
- ✓ `grep -rEn "from .+(pdfmake|kysely|fastify|zod|fs|path)" src/domain/fiscalite/cfe/ src/domain/fiscalite/liasse/` → 0 résultat (hexagonal strict).
- ✓ `grep -n "Re-calculer\|Recalculer" src/web/views/partials/partial-bandeau-reconciliation.ejs` → 0 résultat (anti-pattern §11).
- ✓ `grep -n "multiplyByFraction(50" src/application/fiscalite/generer-brouillon-liasse.ts` → 0 résultat (R4.3 pas d'abattement côté app).
- ✓ `grep -E "onConflict.+column.+'id'" src/infrastructure/repositories/declaration-cfe-repository-sqlite.ts` → 0 résultat (upsert composite (bien_id, millesime)).

## Récapitulatif livré

### Domaine (pur)
- `domain/fiscalite/liasse/` — port mapping, DTO case-par-case, port builder PDF, reconciliation pure.
- `domain/fiscalite/cfe/` — agrégat `DeclarationCfe`, port repo, statut + libellés, alerte-j30 pure (3 fonctions).
- `domain/_shared/identifiants.ts` — brand `DeclarationCfeId` ajouté.
- `domain/fiscalite/erreurs.ts` — `DeclarationCfeIntrouvable` ajoutée.

### Application
- 4 use cases liasse : générer / exporter PDF / exporter CSV (réutilisent `genererBrouillonLiasse`).
- 3 use cases CFE : enregistrer / modifier / lister.
- 1 use case alerte : lister-alertes-cfe-actives (Clock + filtre bien optionnel).

### Infrastructure
- Migration `0023_phase6_declaration_cfe.sql` (table declarations_cfe + CHECK statut + UNIQUE composite + FK).
- Repo SQLite `DeclarationCfeRepositorySqlite` (upsert sur `(bien_id, millesime)`).
- Adapter pdfmake `BrouillonLiasseBuilderPdfmake` + fonction pure `construireBrouillonLiasse`.

### Web
- 4 partials nouveaux : drill-down sources, bandeau réconciliation, bandeau rectificative, bandeau CFE échéance.
- 3 partials CFE : carte-cfe, badge-statut-cfe, aide-cfe.
- 2 vues CFE : nouvelle.ejs + editer.ejs.
- Section S7 "Exports" intégrée dans brouillon-liasse.ejs.
- Section CFE intégrée dans `pages/biens/detail.ejs`.
- Bandeaux CFE J-30 sur `detail.ejs` et `pages/fiscalite/index.ejs`.

### Routes (8 nouvelles + extensions)
- `GET /biens/:id/cfe/nouvelle`, `POST /biens/:id/cfe`, `GET /biens/:id/cfe/:cfeId/editer`, `POST /biens/:id/cfe/:cfeId/modifier`.
- `GET /fiscalite/declarations-corrigees/:id/liasse` (rectificative HTML).
- `GET /fiscalite/declarations/:id/liasse.pdf` et `.csv` (originale).
- `GET /fiscalite/declarations-corrigees/:id/liasse.pdf` et `.csv` (rectificative).
- Extension `/biens/:id` (charge `declarationsCfe` + `alertesCfeBien`).
- Extension `/fiscalite` (charge `alertesCfe`).

### Tests
| Type | Count |
|---|---|
| Unit | ~50 tests Phase 6 (domain + application) |
| Intégration repo SQLite | 5 tests |
| Intégration HTTP routes | 12 tests (route-cfe + route-cfe-banner + route-liasse + route-liasse-exports) |
| Intégration PDF | 2 tests (magic bytes) |
| BDD `@phase6` | 15 scénarios, 68 steps |
| **Total projet** | **1011 tests GREEN** |

## Tâches manuelles (UAT — human_verification)

Aucune. La couverture automatisée + les patterns Phase 5 répliqués (Clock, Money, builders pdfmake)
suffisent pour valider le comportement.

Si l'utilisateur souhaite tester manuellement :
1. Visiter `/fiscalite/declarations/:id/liasse` pour une déclaration clôturée — vérifier le rendu HTML + cliquer "Télécharger PDF".
2. Visiter `/biens/:id` — vérifier l'affichage de la section CFE (empty state ou liste avec badges).
3. Créer une déclaration CFE statut "non_deposee" avec échéance dans 15 jours → revisiter `/fiscalite` → vérifier le bandeau J-30.

## Gaps détectés

Aucun gap bloquant. Backlogs différés (non-bloquants) consignés dans les SUMMARYs :
- Drill-down recettes/charges par pièce individuelle (Phase 7).
- Scénarios BDD additionnels `@phase6-liasse-tracabilite`, `@phase6-liasse-rectificative`,
  `@phase6-liasse-exports`, `@phase6-cfe-alerte` — couverture déjà adéquate via tests
  intégration et unit + propriétés fast-check.
- Bloc `/fiscalite` qui priorise la corrigée la plus récente (mention au plan 06-04,
  à traiter quand le besoin émerge).

## Conclusion

Phase 6 — Liasse 2031 & CFE — verdict **PASSED**. FIS-05 et FIS-06 sont entièrement
couverts, tous les anti-patterns critiques (R4.3 base imposable, T-06-LIASSE-01 CSV
injection, hexagonal strict) sont verrouillés par tests et grep statique.
