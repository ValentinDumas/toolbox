---
phase: 04-coffre-documentaire-travaux
verified: 2026-05-18T17:30:00Z
status: passed
score: "4/4 SC observable + 5/5 gaps closed (CR-01, CR-03, CR-06, CR-04+CR-05, CR-08)"
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "4/4 SC observable, mais 5 gaps défense en profondeur"
  gaps_closed: ["CR-01", "CR-03", "CR-06", "CR-04+CR-05", "CR-08"]
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification: []
---

# Phase 4 : Coffre documentaire & Travaux — Verification Report (re-verification)

**Phase Goal:** L'utilisateur peut centraliser tous ses justificatifs (factures, tickets, baux, EDL, diagnostics) avec rétention 10 ans, les retrouver par contexte (Bien / Locataire / année), et tracer les tickets travaux avec pièce jointe et coût.

**Verified:** 2026-05-18T17:30:00Z
**Status:** passed
**Re-verification:** Yes — après plan de gap closure `04-04`

## Synthèse re-verification

La verification initiale (`04-VERIFICATION.md` du 2026-05-18T15:08:00Z) avait acté les 4 success criteria comme observables côté UI mais documenté **5 gaps de défense en profondeur** (3 blockers + 2 partials) compromettant les invariants D-109 (rétention 10 ans), D-113 (cascade asymétrique pivot N:N) et la pureté DDD `application → infrastructure`.

Le plan `04-04-gap-closure` a livré 5 commits ciblés (`96f395a`, `2b63e70`, `f3f6b48`, `9a56c82`, `9b463e8`) plus un commit de finalisation (`dbee4fd`). La re-verification confirme **tous les gaps fermés**, **aucune régression**, et **les 4 success criteria toujours observables**.

## Gates post-merge (mesurées sur main)

| Gate | Résultat |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm test` (vitest) | **594/594 verts** (89 fichiers) — incluant sentinel CR-01 + tests CR-04/CR-05/CR-08 |
| `pnpm test:bdd` | **112/112 scénarios verts**, 653/653 steps |
| `pnpm lint:deps` | **0 violation** (179 modules, 823 dépendances) — règle `no-application-to-infra` active |
| Fichiers clés créés | `src/domain/_shared/slug.ts`, `src/web/helpers/content-disposition.ts`, `tests/integration/db/foreign-keys-sentinel.test.ts` |

## Success Criteria — Re-évaluation

| # | Truth (ROADMAP SC) | Statut initial | Statut après gap closure | Évidence |
|---|---|---|---|---|
| SC-1 | L'utilisateur peut uploader des Justificatifs et les rattacher à un Bien et/ou un Locataire | VERIFIED | **VERIFIED** | `coffre.ts:189` POST /coffre/upload + `uploader-justificatif.ts` ; BDD T1 vert ; magic-bytes D-118 durci (CR-08) |
| SC-2 | L'utilisateur peut rechercher et filtrer par Bien, Locataire ou année fiscale | VERIFIED | **VERIFIED** | `rechercher-justificatifs.ts` + 5 filtres + pagination ; BDD T9–T14 verts ; sections fiches Bien/Locataire |
| SC-3 | Le système conserve les documents au moins 10 ans et empêche toute suppression avant ce délai | PARTIAL (D-113 SQL inopérant) | **VERIFIED** | Gate D-109 applicatif (`purger-justificatif.ts` 3 branches) + UI corbeille + **PRAGMA foreign_keys = ON activé par connexion (CR-01)** → cascade D-113 opérationnelle |
| SC-4 | L'utilisateur peut créer un ticket d'incident / travaux avec pièce jointe et coût | VERIFIED | **VERIFIED** | `creer-ticket-travaux.ts` + `ajouter-pj-ticket.ts` dual-mode + 8 routes ; BDD T1–T15 `@inc-01` verts ; **fiche ticket filtre désormais les PJ en corbeille (CR-03)** |

**Score final :** 4/4 SC pleinement verified (vs 3/4 + 1 partial avant gap closure).

## Gap Closure Analysis

### CR-01 — PRAGMA foreign_keys = ON par connexion [CLOSED]

**Severity initiale :** blocker (D-113 cascade silencieusement désactivée en prod).

**Commit :** `96f395a fix(04-04): CR-01 activer PRAGMA foreign_keys = ON par connexion + sentinel`

**Évidence codebase :**
- `src/infrastructure/db/database.ts:24-26` : helper `activerPragmas(sqlite)` exporté qui appelle `sqlite.pragma('foreign_keys = ON')`.
- `src/infrastructure/db/database.ts:33` : `ouvrirDb()` appelle `activerPragmas(sqlite)` juste après `new BetterSqlite3(...)`.
- `tests/integration/db/foreign-keys-sentinel.test.ts` créé (23 lignes) : assert `sqlite.pragma('foreign_keys', { simple: true }) === 1` après `ouvrirDb()`.
- `grep -c "PRAGMA foreign_keys = ON" tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts` = **0** : l'activation manuelle ligne 271 a été supprimée — le test cascade hérite désormais du PRAGMA via `ouvrirDb`.
- 38 occurrences de `activerPragmas` dans `tests/` : propagation effective sur les tests qui ouvrent `new Database(':memory:')` directement.

**Verdict :** CR-01 fermé. Défense en profondeur D-113 opérationnelle en prod.

### CR-03 — Filtre corbeilleLe sur fiche ticket [CLOSED]

**Severity initiale :** blocker (fiche ticket affichait des PJ en corbeille comme actives).

**Commit :** `2b63e70 fix(04-04): CR-03 filtrer Justificatifs en corbeille sur fiche ticket`

**Évidence codebase :**
- `src/application/travaux/lire-ticket.ts:50` :
  ```ts
  if (j && j.corbeilleLe === null) justificatifs.push(j);
  ```
  (avant : `if (j)`).
- `tests/bdd/features/travaux.feature:127` : scénario `@gap-04 @inc-01` ajouté ("Une PJ mise en corbeille n'apparaît plus sur la fiche du ticket").
- Test unitaire `tests/unit/travaux/use-cases.test.ts` : describe `lireTicket` enrichi du cas "filtre les Justificatifs en corbeille (CR-03)".
- BDD post-merge : 112/112 scénarios verts (111 existants + 1 nouveau `@gap-04`).

**Verdict :** CR-03 fermé. La pivot `ticket_justificatifs` reste intacte (cohérent avec D-113 : la rétention prime) ; seul l'affichage filtre les soft-deleted.

### CR-06 — slugify dans domain/_shared + règle no-application-to-infra [CLOSED]

**Severity initiale :** blocker (DDD pureté violée — `application/` importait `StockageJustificatifsLocal` infra).

**Commit :** `f3f6b48 fix(04-04): CR-06 déplacer slugify dans domain/_shared + règle no-application-to-infra`

**Évidence codebase :**
- `src/domain/_shared/slug.ts` créé (19 lignes) : fonction pure `slugify(input: string): string`, sans dépendance technique.
- `src/application/documents/uploader-justificatif.ts:29` :
  ```ts
  import { slugify } from '../../domain/_shared/slug.js';
  ```
  (avant : `import { StockageJustificatifsLocal } from '../../infrastructure/storage/...'`).
- `src/application/documents/uploader-justificatif.ts:154` : `const slug = slugify(commande.titre);` (avant : `StockageJustificatifsLocal.slugify(...)`).
- `grep -rn "StockageJustificatifsLocal\.slugify" src/ tests/` = **0 hit** : la méthode statique a été supprimée de l'adapter et plus aucun caller n'y fait référence.
- `grep -rn "import.*StockageJustificatifsLocal" src/application/` = **0 hit**.
- `.dependency-cruiser.cjs:30-49` : règle `no-application-to-infra` ajoutée avec `severity: error`.
- `pnpm lint:deps` post-merge : 0 violation.

**Note transparence (héritée du SUMMARY) :** la règle exclut via `pathNot` 7 modules pour lesquels une violation pré-existante (type leakage `Kysely<DB>` ou import PDF infra dans `generer-quittance`) n'a pas pu être résolue dans le scope du plan 04-04. Ces violations sont trackées pour un refactoring dédié (cf. RISKS.md). L'objet de CR-06 — empêcher *toute nouvelle* violation et fermer la voie d'évasion `slugify` — est tenu.

**Verdict :** CR-06 fermé.

### CR-04 + CR-05 — Path-traversal défensif + Content-Disposition RFC 6266 [CLOSED]

**Severity initiale :** partial (bombe à retardement futurs callers + UX header cassé sur noms non-ASCII).

**Commit :** `9a56c82 fix(04-04): CR-04+CR-05 path-traversal défensif + Content-Disposition RFC 6266`

**Évidence codebase :**
- `src/domain/documents/erreurs.ts:72` : classe `CheminInvalide extends Error` ajoutée.
- `src/infrastructure/storage/stockage-justificatifs-local.ts:27-38` : `ecrire()` valide défensivement avant `path.join` :
  - `annee` : `Number.isInteger && >= 1900 && <= 2200`
  - `slug` : `^[a-z0-9-]{1,80}$`
  - `ext` : `^[a-z0-9]{1,5}$`
- `src/infrastructure/storage/stockage-justificatifs-local.ts:49-56` : check `cheminAbsoluResolu.startsWith(baseDirResolu + path.sep)` après `path.join` (parité avec `lire()`) — `throw new CheminInvalide()` sinon.
- `src/web/helpers/content-disposition.ts` créé (19 lignes) : helper `encodeFilenameRFC6266()` génère `attachment; filename="ascii-fallback"; filename*=UTF-8''percent-encoded` conforme RFC 6266 + RFC 8187.
- `src/web/routes/coffre.ts:52` : `import { encodeFilenameRFC6266 } from '../helpers/content-disposition.js';`
- `src/web/routes/coffre.ts:409` :
  ```ts
  .header('Content-Disposition', encodeFilenameRFC6266(j.nomFichierOriginal))
  ```
  (avant : `attachment; filename="${j.nomFichierOriginal}"` brut).
- Tests : `tests/unit/_shared/content-disposition.test.ts` (4 cas) + nouveaux cas dans `tests/integration/storage/stockage-justificatifs-local.test.ts` (slug `../etc/passwd`, ext malformée, annee invalide → `CheminInvalide`).

**Verdict :** CR-04 + CR-05 fermés. L'adapter porte désormais son propre invariant anti-path-traversal indépendamment des appelants ; le header est UX-correct sur noms français (`été.pdf`, etc.).

### CR-08 — Magic-bytes WebP sous-format + HEIC box_size [CLOSED]

**Severity initiale :** partial (fichiers RIFF...WEBP+payload arbitraire passaient la validation).

**Commit :** `9b463e8 fix(04-04): CR-08 magic-bytes WebP sous-format VP8 + HEIC box_size`

**Évidence codebase :**
- `src/application/documents/valider-magic-bytes.ts:69-87` : branche WebP étendue à 16 bytes minimum, lit `bytes.subarray(12, 16).toString('ascii')` et accepte uniquement `'VP8 '`, `'VP8L'`, `'VP8X'`. Tout autre sous-format → `return null` → `{ ok: false, raison: 'format-non-accepte' }`.
- `src/application/documents/valider-magic-bytes.ts:90-105` : branche HEIC lit `boxSize = bytes.readUInt32BE(0)` et vérifie `boxSize >= 16 && boxSize <= bytes.length` avant le check `ftyp` + brand.
- `grep -c "VP8" src/application/documents/valider-magic-bytes.ts` = **4 matches** (1 commentaire + les 3 sous-formats officiels).
- `grep -c "readUInt32BE" src/application/documents/valider-magic-bytes.ts` = **1 match**.
- Tests `tests/unit/documents/valider-magic-bytes.test.ts` : 7 nouveaux cas (3 WebP positifs + 1 WebP négatif hybride + 3 HEIC dont 2 négatifs box_size).
- Fixtures `magicWebp()` et `magicHeic()` mises à jour pour respecter les nouvelles contraintes (déviation Rule 1 documentée dans SUMMARY).

**Verdict :** CR-08 fermé.

## Key Link Verification (post-fix)

| From | To | Via | Statut |
|---|---|---|---|
| `src/infrastructure/db/database.ts` | `sqlite.pragma('foreign_keys = ON')` | `activerPragmas` appelé dans `ouvrirDb` | **WIRED** |
| `src/application/documents/uploader-justificatif.ts` | `src/domain/_shared/slug.ts` | `import { slugify }` (plus de StockageJustificatifsLocal) | **WIRED** |
| `src/application/travaux/lire-ticket.ts` | `Justificatif.corbeilleLe` | `if (j && j.corbeilleLe === null)` ligne 50 | **WIRED** |
| `src/infrastructure/storage/stockage-justificatifs-local.ts` | `CheminInvalide` (domain) | `throw new CheminInvalide()` × 3 (slug/ext/annee + startsWith) | **WIRED** |
| `src/web/routes/coffre.ts` | `src/web/helpers/content-disposition.ts` | `encodeFilenameRFC6266(j.nomFichierOriginal)` ligne 409 | **WIRED** |
| `.dependency-cruiser.cjs` | `src/application/* → src/infrastructure/*` | règle `no-application-to-infra` severity:error | **WIRED** |

## Requirements Coverage (re-évaluation)

| Requirement | Description | Statut | Évidence |
|---|---|---|---|
| **DOC-01** | Uploader des Justificatifs | **SATISFIED** | Route POST /coffre/upload + `uploader-justificatif.ts` ; magic-bytes durcis (CR-08) ; slugify pur (CR-06) |
| **DOC-02** | Rechercher par Bien / Locataire / année fiscale | **SATISFIED** | `rechercher-justificatifs.ts` + 5 filtres + BDD T9–T14 |
| **DOC-03** | Conservation 10 ans | **SATISFIED** | Gate D-109 applicatif + **PRAGMA foreign_keys actif (CR-01) → D-113 cascade opérationnelle** |
| **INC-01** | Ticket travaux avec PJ et coût | **SATISFIED** | `creer-ticket-travaux.ts` + `ajouter-pj-ticket.ts` ; **fiche ticket filtre PJ corbeille (CR-03)** |

## Régressions

**Aucune.**
- 594/594 tests vitest verts (vs 573 avant gap closure → +21 nouveaux tests additifs).
- 112/112 scénarios BDD verts (vs 111 avant → +1 `@gap-04`).
- 653/653 BDD steps verts.
- 0 violation dependency-cruiser avec la nouvelle règle active.
- `pnpm typecheck` exit 0.

## Anti-Patterns résiduels

Les warnings non-bloquants documentés dans la verification initiale et explicitement hors périmètre du plan 04-04 restent ouverts :
- **WR-02** : `uploader-justificatif.ts:201-213` — compensation soft-delete (au lieu de hard-delete) en cas d'échec d'écriture disque. À tracer dans RISKS.md.
- **WR-06** : `justificatif-repository-sqlite.ts:107-150` — `substr(date_document, 1, 4)` au lieu de plage `>=/<=` casse l'index `idx_justificatifs_date_document`. À tracer dans RISKS.md.

Ces deux items n'affectent ni les success criteria ni les invariants D-109/D-113 — décision documentée dans `04-04-gap-closure-PLAN.md` (section "Hors périmètre").

## Conclusion

Phase 4 atteint son goal : **L'utilisateur peut centraliser tous ses justificatifs avec rétention 10 ans, les retrouver par contexte (Bien / Locataire / année fiscale), et tracer les tickets travaux avec pièce jointe et coût.**

Les 4 success criteria du ROADMAP sont **observables bout-en-bout côté UI** (36 scénarios BDD `@phase4` verts + 1 scénario `@gap-04`). La défense en profondeur SQL (D-113), la pureté DDD `application/`, et les invariants de sécurité (magic-bytes, path-traversal, RFC 6266) sont désormais **portés par le code et vérifiés programmatiquement**.

**Statut final : `passed`.** Aucun blocker, aucun gap remaining, aucune régression. Prêt pour Phase 5 (Fiscalité LMNP).

---

_Verified: 2026-05-18T17:30:00Z_
_Verifier: Claude (gsd-verifier) — re-verification après plan 04-04_
