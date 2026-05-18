---
phase: 04-coffre-documentaire-travaux
verified: 2026-05-18T15:08:00Z
status: gaps_found
score: 4/4 success criteria observable, but 3 blockers undermine D-109/D-113 invariants
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "Le système empêche toute suppression avant 10 ans (SC-3) — défense en profondeur SQL + cascade asymétrique D-113"
    status: failed
    reason: >-
      `PRAGMA foreign_keys = ON` n'est JAMAIS exécuté côté production
      (`src/infrastructure/db/database.ts:13-20` et aucune migration ne le contient).
      Conséquences observables :
        1. La cascade `ON DELETE CASCADE` sur `ticket_justificatifs.ticket_id` est
           silencieusement désactivée. La décision D-113 (suppression ticket → suppression
           pivot) ne se déclenche pas en runtime.
        2. La protection D-113 inverse (pas de CASCADE sur `justificatif_id`) est non
           vérifiable par SQL : `justificatifs` peut référencer un Bien ou Locataire
           inexistant via `bien_id`/`locataire_id` REFERENCES.
        3. Seul le test `ticket-travaux-repository-sqlite.test.ts:271` active
           `PRAGMA foreign_keys = ON` manuellement pour faire passer la couverture
           cascade — cela rend le test trompeur (il atteste de SQLite, pas de l'app).
      D-113 et D-109 défense en profondeur sont donc une promesse non tenue.
    artifacts:
      - path: "src/infrastructure/db/database.ts"
        issue: "ouvrirDb() ne fait pas sqlite.pragma('foreign_keys = ON')"
      - path: "migrations/0001_init.sql ... migrations/0010_phase4_documents_travaux.sql"
        issue: "Aucune migration n'exécute PRAGMA foreign_keys = ON"
      - path: "tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts"
        issue: "Le test cascade D-113 active manuellement le PRAGMA (ligne 271) — preuve que la prod ne le fait pas"
    missing:
      - "Ajouter sqlite.pragma('foreign_keys = ON') dans ouvrirDb()"
      - "Ajouter une migration 0011_enable_foreign_keys.sql (ou amender 0001) qui exécute PRAGMA foreign_keys = ON;"
      - "Ajouter un test sentinel : `SELECT * FROM pragma_foreign_keys` retourne `[{foreign_keys: 1}]`"
      - "Retirer l'activation manuelle ligne 271 du test cascade — la suite doit hériter du PRAGMA via ouvrirDb"
  - truth: "Sur la fiche d'un ticket de travaux, les pièces jointes affichées sont des Justificatifs ACTIFS (pas en corbeille)"
    status: failed
    reason: >-
      `src/application/travaux/lire-ticket.ts:44-51` boucle sur les IDs liés via
      le pivot N:N et appelle `justificatifRepo.trouverParId(jid)` sans filtrer
      `corbeilleLe`. Quand un Justificatif est mis en corbeille (`mettreJustificatifEnCorbeille`),
      la pivot `ticket_justificatifs` n'est pas nettoyée (cohérent avec D-113 :
      la rétention prime), MAIS la fiche ticket continue d'afficher la PJ
      soft-deleted comme active. L'utilisateur voit un lien fonctionnel
      `/justificatifs/:id` qui redirige ensuite avec bannière "Ce document est
      en corbeille" (`coffre.ts:401-402`) — UX cassée + masque la corbeille.
    artifacts:
      - path: "src/application/travaux/lire-ticket.ts"
        issue: "Lignes 47-51 : `if (j)` au lieu de `if (j && j.corbeilleLe === null)`"
    missing:
      - "Filtrer `j.corbeilleLe === null` dans la boucle d'hydratation"
      - "OU enrichir `listerJustificatifsLies` avec un JOIN SQL qui exclut corbeille_le NOT NULL"
      - "Ajouter un scénario BDD `@inc-01` qui couvre l'affichage d'un ticket avec une PJ soft-deleted"
  - truth: "L'écriture d'un Justificatif sur disque ne permet pas de path-traversal ni d'injection via slug/extension"
    status: failed
    reason: >-
      `StockageJustificatifsLocal.ecrire(annee, justificatifId, slug, ext, bytes)`
      construit `path.join('documents/justificatifs', annee, '${id}-${slug}.${ext}')`
      sans valider `slug` ni `ext` côté adapter. En pratique l'unique appelant
      Phase 4 (`uploaderJustificatif`) passe par `slugify` (whitelist `[a-z0-9-]`)
      et `EXT_PAR_MIME` (whitelist), donc le bug n'est pas exploitable
      AUJOURD'HUI — mais l'invariant n'est pas porté par l'adapter, c'est une
      bombe à retardement pour un futur use case (export, import legacy, attach
      depuis ticket travaux dual-mode). Cf. CR-04.
      De plus, le header `Content-Disposition` (coffre.ts:407-412) interpole
      `j.nomFichierOriginal` sans escape ni RFC 6266 — un nom de fichier non-ASCII
      ou contenant `"` casse le header (UX dégradée + risque théorique de
      response splitting bloqué par Fastify mais non documenté).
    artifacts:
      - path: "src/infrastructure/storage/stockage-justificatifs-local.ts"
        issue: "ecrire() ne re-valide pas slug/ext/annee défensivement avant path.join"
      - path: "src/web/routes/coffre.ts"
        issue: "Lignes 409-410 : Content-Disposition interpole nomFichierOriginal sans escape RFC 6266"
    missing:
      - "Re-valider slug (regex `^[a-z0-9-]+$`, max 80) et ext (regex `^[a-z0-9]+$`) défensivement dans ecrire()"
      - "Implémenter `encodeFilenameRFC6266()` et l'utiliser sur Content-Disposition"
      - "Vérifier que cheminAbsolu.startsWith(baseDirResolu) AVANT writeFile (parité avec lire())"
  - truth: "La validation magic-bytes empêche un fichier hybride WebP-then-binary ou HEIC avec box_size frauduleux"
    status: partial
    reason: >-
      `valider-magic-bytes.ts:69-96` ne vérifie pour WebP que `RIFF` (bytes 0-3)
      et `WEBP` (bytes 8-11). Le sous-format `VP8 `/`VP8L`/`VP8X` (bytes 12-15)
      n'est pas validé → un fichier `RIFF....WEBP` suivi d'un payload arbitraire
      (PE Windows, exécutable concaténé) passe la validation côté magic-bytes,
      est persisté tel quel (pas de re-encodage côté infra pour WebP),
      et reste accessible via `/justificatifs/:id/fichier`. Sharp n'est pas
      utilisé pour WebP/PDF/JPEG/PNG — seul HEIC traverse une conversion qui
      pourrait re-valider la structure.
      HEIC : le `box_size` (bytes 0-3) n'est pas vérifié non plus.
      Cf. CR-08.
    artifacts:
      - path: "src/application/documents/valider-magic-bytes.ts"
        issue: "WebP sous-format VP8/VP8L/VP8X non vérifié, HEIC box_size non vérifié"
    missing:
      - "Étendre la branche WebP pour vérifier `subType ∈ {VP8 , VP8L, VP8X}` (offset 12-15)"
      - "Étendre la branche HEIC pour vérifier `boxSize = bytes.readUInt32BE(0)` plausible (>= 16 et <= bytes.length)"
      - "Documenter la défense en profondeur attendue (validation streaming via sharp.metadata() pour tous les formats image)"
  - truth: "Le domaine application ne dépend pas de l'infrastructure (DDD pureté — règle CLAUDE.md non négociable)"
    status: failed
    reason: >-
      `src/application/documents/uploader-justificatif.ts:29,154` importe
      `StockageJustificatifsLocal` (classe concrète infra) au lieu d'utiliser
      uniquement le port `StockageJustificatifs`. La fonction `slugify` est
      statique sur l'adapter. Trois conséquences :
        1. Violation de la règle "Domaine pur : aucun import technique" (CLAUDE.md)
           étendue implicitement à `application/` (ports & adapters strict).
        2. `dependency-cruiser` ne détecte PAS ce cas — il n'existe pas de règle
           `no-application-to-infra` dans `.dependency-cruiser.cjs` (seulement
           `no-domain-to-infra` et `no-application-to-web`). Le check
           `pnpm depcruise` passe à 0 violation mais reste myope. CR-06.
        3. Le swap d'adapter (S3, mémoire pour tests) impose de reimplementer
           `slugify` ailleurs.
    artifacts:
      - path: "src/application/documents/uploader-justificatif.ts"
        issue: "Ligne 29 : import direct de StockageJustificatifsLocal (infra)"
      - path: ".dependency-cruiser.cjs"
        issue: "Pas de règle no-application-to-infra"
    missing:
      - "Déplacer `slugify` dans `src/domain/_shared/slug.ts` ou `src/application/documents/slugify.ts` (fonction pure)"
      - "Ajouter règle dependency-cruiser `no-application-to-infra` (severity error)"
      - "Retirer l'import de StockageJustificatifsLocal dans uploader-justificatif.ts"
deferred: []
---

# Phase 4: Coffre documentaire & Travaux Verification Report

**Phase Goal:** L'utilisateur peut centraliser tous ses justificatifs (factures, tickets, baux, EDL, diagnostics) avec rétention 10 ans, les retrouver par contexte (Bien / Locataire / année), et tracer les tickets travaux avec pièce jointe et coût.

**Verified:** 2026-05-18T15:08:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria + PLAN must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | L'utilisateur peut uploader des Justificatifs et les rattacher à un Bien et/ou un Locataire | ✓ VERIFIED | Routes `POST /coffre/upload` (coffre.ts:189), use case `uploaderJustificatif` avec invariant D-103 (titre + bien_id OR locataire_id) ; BDD T1, T2 verts ; magic-bytes D-118 ; conversion HEIC D-105 |
| SC-2 | L'utilisateur peut rechercher et filtrer par Bien, Locataire ou année fiscale et accéder à la pièce | ✓ VERIFIED | `rechercher-justificatifs.ts` + `filtresCoffreSchema` Zod ; 5 filtres combinables (search, bien, locataire, annee, type) + pagination 20/page ; `partial-filters-coffre.ejs` ; BDD T9-T14 verts ; routes `GET /coffre`, `GET /justificatifs/:id/fichier` |
| SC-3 | Le système conserve tous les documents au moins 10 ans et empêche toute suppression avant ce délai (corbeille) | ⚠️ PARTIAL | Gate D-109 visible côté domain (`peutEtrePurge`) et application (`purger-justificatif.ts` 3 branches testées) + UI corbeille avec bouton disabled. **MAIS** la défense en profondeur SQL est non opérante : `PRAGMA foreign_keys = ON` jamais exécuté → cascade D-113 silencieusement désactivée en prod. Cf. gaps. |
| SC-4 | L'utilisateur peut créer un ticket d'incident / travaux rattaché à un Bien avec pièce jointe et coût | ✓ VERIFIED | `creer-ticket-travaux.ts` + 8 routes Fastify travaux ; `ajouter-pj-ticket.ts` dual-mode (upload ou attach) ; `partial-ticket-pj-section.ejs` ; section "Travaux" sur fiche Bien (biens/detail.ejs:237) ; BDD T1-T15 `@inc-01` verts |

**Score:** 3/4 SC pleinement verified, 1/4 partial (SC-3 défense en profondeur compromise) + 4 issues bloquantes documentées dans `gaps`

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `migrations/0010_phase4_documents_travaux.sql` | 3 tables (justificatifs + tickets_travaux + ticket_justificatifs) + indexes + CHECK D-103 | ✓ VERIFIED | 94 lignes, 3 tables CREATE, 7 indexes, CHECK D-103 ligne 41 |
| `src/domain/documents/justificatif.ts` | Agrégat racine + peutEtrePurge | ✓ VERIFIED | 7.2K, class Justificatif + peutEtrePurge ligne 219-222 (compare >= 0 — limite testée 3 cas) |
| `src/domain/documents/stockage-justificatifs.ts` | Port domain pur | ✓ VERIFIED | 1.2K, interface StockageJustificatifs |
| `src/domain/documents/convertisseur-image.ts` | Port HEIC → JPEG | ✓ VERIFIED | 775B, interface ConvertisseurImage |
| `src/domain/documents/justificatif-repository.ts` | Port repo + filtres facettés + typeIn | ✓ VERIFIED | 1.1K, `typeIn?: TypeJustificatif[]` exposé Wave 1 |
| `src/domain/travaux/ticket-travaux.ts` | Agrégat TicketTravaux + transitions | ✓ VERIFIED | 6.5K, workflow 3 statuts |
| `src/domain/travaux/ticket-travaux-repository.ts` | Port repo + lierJustificatif/delier | ✓ VERIFIED | 2.1K, 6 méthodes |
| `src/application/documents/uploader-justificatif.ts` | Use case upload + magic-bytes + conversion | ⚠️ ORPHANED-LITE | 6.7K présent et wiré mais importe directement `StockageJustificatifsLocal` (infra). CR-06. |
| `src/application/documents/mettre-justificatif-en-corbeille.ts` | Use case soft-delete | ✓ VERIFIED | 1.1K |
| `src/application/documents/rechercher-justificatifs.ts` | Use case 5 filtres + pagination | ✓ VERIFIED | 1.8K, signature retourne items + total + page + pageSize |
| `src/application/documents/lister-corbeille.ts` | Use case corbeille | ✓ VERIFIED | 569B |
| `src/application/documents/restaurer-justificatif.ts` | Use case restaurer | ✓ VERIFIED | 1.1K |
| `src/application/documents/purger-justificatif.ts` | 3 branches D-109 + cleanup | ✓ VERIFIED | 2.7K, branches "pas en corbeille" / "avant 10 ans" / "après 10 ans" — 100 % couverture |
| `src/application/documents/modifier-justificatif.ts` | Patch metadata avec re-validation | ✓ VERIFIED | 2.3K, force champs immuables depuis toProps() |
| `src/application/documents/lister-justificatifs-par-bien.ts` | Use case fiche Bien | ✓ VERIFIED | 951B, pageSize=5 default |
| `src/application/documents/lister-justificatifs-par-locataire.ts` | Use case D-120 filtre type | ✓ VERIFIED | 2.1K, `TYPES_AUTORISES_LOCATAIRE` exporté avec 4 valeurs |
| `src/application/travaux/creer-ticket-travaux.ts` | Use case création ticket | ✓ VERIFIED | 2.0K |
| `src/application/travaux/clore-ticket-travaux.ts` | Use case clôture + coût réel | ✓ VERIFIED | 1.5K |
| `src/application/travaux/annuler-ticket-travaux.ts` | Use case annulation + raison | ✓ VERIFIED | 1.2K |
| `src/application/travaux/ajouter-pj-ticket.ts` | Dual-mode upload OU attach | ✓ VERIFIED | 4.5K |
| `src/application/travaux/delier-pj-ticket.ts` | Use case délier PJ | ✓ VERIFIED | 1.1K |
| `src/application/travaux/lire-ticket.ts` | Use case fiche ticket | ✗ HOLLOW | 1.8K présent et wiré, **MAIS ne filtre PAS `corbeilleLe`** sur les PJ liées via le pivot. Cf. gaps. |
| `src/infrastructure/repositories/justificatif-repository-sqlite.ts` | Adapter SQLite avec rechercher facettes | ✓ VERIFIED | 234 lignes, supporte typeIn, search LIKE, anneeFiscale (via substr) |
| `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts` | Adapter SQLite + pivot N:N | ✓ VERIFIED | Confirmé via `find` directory listing |
| `src/web/routes/coffre.ts` | 11 routes coffre + justificatifs | ✓ VERIFIED | Routes GET/POST verbatim listées plus haut |
| `src/web/routes/travaux.ts` | 8 routes travaux | ✓ VERIFIED | Order /travaux/nouveau AVANT /travaux/:id (ligne 113 vs 193) |
| `src/web/views/pages/coffre/liste.ejs` | Liste + filtres + pagination | ✓ VERIFIED | 3.8K |
| `src/web/views/pages/coffre/corbeille.ejs` | Corbeille avec bouton purge conditionnel | ✓ VERIFIED | 4.4K, peutEtrePurge JS ligne 25 + bouton disabled avant 10 ans ligne 96 |
| `src/web/views/pages/coffre/upload.ejs` | Form upload | ✓ VERIFIED | 979B |
| `src/web/views/pages/justificatifs/detail.ejs` | Fiche détail | ✓ VERIFIED | 2.7K |
| `src/web/views/pages/justificatifs/modifier.ejs` | Form édition metadata | ✓ VERIFIED | 4.1K |
| `src/web/views/pages/travaux/liste.ejs` | Liste tickets par Bien | ✓ VERIFIED | 1.6K |
| `src/web/views/pages/travaux/detail.ejs` | Fiche ticket avec PJ | ⚠️ HOLLOW propagation | 4.2K présent, mais reçoit `justificatifs[]` depuis `lire-ticket.ts` non-filtré (cf. gaps). |
| `src/web/views/pages/travaux/nouveau.ejs` | Form création ticket | ✓ VERIFIED | 3.3K |
| `src/web/views/partials/partial-filters-coffre.ejs` | Form GET filtres facettés | ✓ VERIFIED | 3.9K |
| `src/web/views/partials/partial-badge-statut-ticket.ejs` | Badge statut 4 variantes | ✓ VERIFIED | 1.1K |
| `src/web/views/partials/partial-ticket-pj-section.ejs` | Panneau PJ ticket | ✓ VERIFIED | 3.5K |
| `src/web/views/partials/sidebar-nav.ejs` | Entrée "Coffre documentaire" | ✓ VERIFIED | Ligne 25 — `<a href="/coffre">Coffre documentaire</a>` |
| `src/web/views/pages/biens/detail.ejs` | Section Documents (UI-5.4) + section Travaux | ✓ VERIFIED | h2 "Documents" ligne 198, h2 "Travaux" ligne 237 (APRÈS Documents) |
| `src/web/views/pages/locataires/detail.ejs` | Section Documents D-120 filtre type | ✓ VERIFIED | h2 "Documents" ligne 70 + lien /coffre?locataire= ligne 126 |
| `src/infrastructure/db/database.ts` | Connexion SQLite + PRAGMA foreign_keys ON | ✗ STUB | 4.1K présent, **MAIS jamais d'appel à `sqlite.pragma('foreign_keys = ON')`** — D-113 cascade asymétrique inopérante. Cf. gaps. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `src/main.ts` | `coffrePlugin` (routes/coffre.ts) | register avec deps | ✓ WIRED | Ligne 285-293 — justificatifRepo, stockage, convertisseurImage, clock, db passés |
| `src/main.ts` | `travauxPlugin` (routes/travaux.ts) | register avec deps | ✓ WIRED | Ligne 296-305 — ticketRepo + justificatifRepo + stockage + db passés |
| `src/main.ts` | `biensPlugin` avec justificatifRepo + ticketRepo | register | ✓ WIRED | Ligne 211 — `{ repo, justificatifRepo, ticketRepo }` |
| `src/main.ts` | `locatairesPlugin` avec justificatifRepo | register | ✓ WIRED | Ligne 213 — `{ repo: locataireRepo, bailRepo, justificatifRepo }` |
| `src/web/routes/coffre.ts` | `uploaderJustificatif` | POST /coffre/upload | ✓ WIRED | coffre.ts:189-353 (route 165 lignes — handler complet) |
| `src/web/routes/coffre.ts` | `rechercherJustificatifs` + `listerCorbeille` | GET /coffre | ✓ WIRED | coffre.ts:100 + filtresCoffreSchema |
| `src/web/routes/coffre.ts` | `purgerJustificatif` (gate D-109) | POST /justificatifs/:id/purger | ✓ WIRED | coffre.ts:478 + catch PurgeAvantDixAnsRefusee → bannière warning verbatim |
| `src/web/routes/biens.ts` | `listerJustificatifsParBien` | GET /biens/:id détail | ✓ WIRED | biens.ts:13,105-106 (conditionnel `opts.justificatifRepo`) |
| `src/web/routes/locataires.ts` | `listerJustificatifsParLocataire` | GET /locataires/:id détail | ✓ WIRED | locataires.ts:17,143-144 |
| `src/web/views/pages/biens/detail.ejs` | GET /coffre?bien=:id | lien "Voir tous les documents de ce Bien" | ✓ WIRED | Ligne 231 |
| `src/web/views/pages/locataires/detail.ejs` | GET /coffre?locataire=:id | lien | ✓ WIRED | Ligne 126 |
| `src/web/views/pages/biens/detail.ejs` | section Travaux + lien /biens/:id/travaux | "Voir tous les tickets" | ✓ WIRED | h2 ligne 237 + lien ligne 281 |
| `src/web/views/pages/coffre/corbeille.ejs` | POST /justificatifs/:id/purger | form action conditionnel | ✓ WIRED | Bouton disabled avant 10 ans ligne 96 ; bouton actif ligne 108-109 |
| `src/application/travaux/lire-ticket.ts` | Justificatif filter actif (corbeilleLe === null) | rendering PJ ticket | ✗ NOT_WIRED | Ligne 50 `if (j)` au lieu de `if (j && j.corbeilleLe === null)` |
| `src/infrastructure/db/database.ts` | SQLite FK contraintes (D-113) | sqlite.pragma | ✗ NOT_WIRED | Pas d'appel `sqlite.pragma('foreign_keys = ON')` |
| `src/application/documents/uploader-justificatif.ts` | Port StockageJustificatifs uniquement | dependency injection | ⚠️ PARTIAL | Le port est injecté correctement, MAIS l'import direct de la classe concrète infra `StockageJustificatifsLocal` (pour `slugify`) viole la séparation hexagonale (CR-06) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `pages/coffre/liste.ejs` | `items, total, filtres, page, pageSize` | `rechercher-justificatifs.ts` → `justificatifRepo.rechercher` (Kysely SELECT + count) | Yes | ✓ FLOWING |
| `pages/coffre/corbeille.ejs` | `items, today` | `listerCorbeille()` (WHERE corbeille_le IS NOT NULL) + `clock.aujourdhui()` | Yes | ✓ FLOWING |
| `pages/biens/detail.ejs` (section Documents) | `documentsBien.items, documentsBien.total` | `listerJustificatifsParBien` → `rechercher({bienId, pageSize:5})` | Yes | ✓ FLOWING |
| `pages/locataires/detail.ejs` (section Documents) | `documentsLocataire.items, .total` | `listerJustificatifsParLocataire` → `rechercher({locataireId, typeIn:4})` | Yes | ✓ FLOWING |
| `pages/travaux/detail.ejs` (PJ section) | `justificatifs[]` (from lire-ticket) | `lire-ticket.ts` boucle sur pivot — **ne filtre pas corbeilleLe** | NO — peut inclure soft-deleted | ✗ HOLLOW_PROP propagation (CR-03) |
| `pages/travaux/liste.ejs` (par Bien) | `items, total` | `listerTicketsParBien` (filtre annule_le IS NULL ligne 96) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck strict | `pnpm typecheck` | exit 0, 0 erreur | ✓ PASS |
| BDD Phase 4 (36 scénarios) | `pnpm cucumber-js --tags @phase4` | 36/36 passed, 233/233 steps | ✓ PASS |
| Tous tests vitest | `pnpm vitest run` | 573/573 tests verts | ✓ PASS |
| Dependency cruiser | `pnpm depcruise src --config .dependency-cruiser.cjs` | 0 violation (177 modules, 822 dependencies) — **mais myope sur application → infra** | ✓ PASS (avec réserve CR-06) |
| Migration 0010 idempotente | présence de `IF NOT EXISTS` sur 3 tables + 7 indexes | confirmé ligne 18, 63, 88 | ✓ PASS |
| PRAGMA foreign_keys = ON | `grep -nE "PRAGMA foreign_keys" src/ migrations/` | aucun match en prod, seul le test cascade l'active manuellement | ✗ FAIL |
| Route order /travaux/nouveau AVANT /travaux/:id | grep | travaux.ts:113 < travaux.ts:193 | ✓ PASS |
| 11 routes coffre wiring | grep `app.(get\|post)` | 11/11 routes présentes | ✓ PASS |
| 8 routes travaux wiring | grep `app.(get\|post)` | 8/8 routes présentes | ✓ PASS |

### Probe Execution

Aucune probe `scripts/*/tests/probe-*.sh` n'est déclarée pour ce projet — Step 7c skipped (no formal probe contract).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| **DOC-01** | 04-01 + 04-02 | L'utilisateur peut uploader des `Justificatif`s (factures, tickets, baux, EDL, diagnostics) | ✓ SATISFIED | Route POST /coffre/upload + uploader-justificatif.ts ; BDD T1 vert ; magic-bytes D-118 ; HEIC→JPEG D-105 |
| **DOC-02** | 04-02 | L'utilisateur peut rechercher des documents par `Bien`, `Locataire`, ou année fiscale | ✓ SATISFIED | rechercher-justificatifs.ts + filtresCoffreSchema + 5 filtres combinables ; pagination ; BDD T9-T15 verts ; sections fiches Bien/Locataire |
| **DOC-03** | 04-01 + 04-02 | Le système conserve tous les documents pendant 10 ans (rétention légale fiscale) | ⚠️ NEEDS HUMAN + GAP | Le gate domain (Justificatif.peutEtrePurge) + use case (purger-justificatif.ts 3 branches) + UI corbeille (bouton disabled) sont en place. BDD T18 et T19 verts (D-109 verbatim). **MAIS** la défense en profondeur SQL D-113 est compromise par PRAGMA foreign_keys non activé — un opérateur ou un futur use case peut briser la cohérence référentielle. CR-01 + CR-07 |
| **INC-01** | 04-03 | L'utilisateur peut créer un incident / ticket de travaux avec pièce jointe et coût | ✓ SATISFIED | creer-ticket-travaux.ts + ajouter-pj-ticket.ts dual-mode + 8 routes ; BDD T1-T15 `@inc-01` verts ; section Travaux fiche Bien ; UI-6.2 verbatim "Le coût réel TTC est obligatoire pour clore le ticket." |

Aucune requirement orphan : tous les IDs déclarés en frontmatter des plans (DOC-01, DOC-02, DOC-03, INC-01) sont alignés avec REQUIREMENTS.md ligne 168 et les success criteria du ROADMAP.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/infrastructure/db/database.ts` | 13-20 | Absence de `sqlite.pragma('foreign_keys = ON')` | 🛑 Blocker | D-113 inopérant en prod (cascade silencieusement désactivée) |
| `src/application/documents/uploader-justificatif.ts` | 29, 154 | Import direct `StockageJustificatifsLocal` (infra) depuis application | 🛑 Blocker | Viole DDD pureté (CLAUDE.md non négociable) — non détecté par depcruise |
| `src/application/travaux/lire-ticket.ts` | 50 | `if (j)` n'exclut pas Justificatifs en corbeille | 🛑 Blocker | Fiche ticket affiche des PJ soft-deleted comme actives |
| `src/infrastructure/storage/stockage-justificatifs-local.ts` | 19-37 | `ecrire(slug, ext)` sans validation défensive | ⚠️ Warning | Bombe à retardement pour futurs callers (path-traversal potentiel) |
| `src/web/routes/coffre.ts` | 409-410 | `Content-Disposition` sans escape RFC 6266 | ⚠️ Warning | Headers malformés sur noms de fichier non-ASCII (été.pdf casse) |
| `src/application/documents/valider-magic-bytes.ts` | 69-96 | WebP sous-format VP8/VP8L/VP8X non vérifié ; HEIC box_size non vérifié | ⚠️ Warning | Fichiers hybrides RIFF...WEBP+payload passent la validation |
| `src/infrastructure/repositories/justificatif-repository-sqlite.ts` | 107-113, 144-150 | `substr(date_document, 1, 4)` au lieu de plage `>= AAAA-01-01 AND <= AAAA-12-31` | ⚠️ Warning | Index `idx_justificatifs_date_document` inutilisable (full table scan) ; format dépendant |
| `src/application/documents/uploader-justificatif.ts` | 186-215 | Compensation soft-delete (au lieu de hard-delete) en cas d'échec d'écriture disque | ⚠️ Warning | "Document en corbeille" sans fichier = pollution sémantique + race avec lecteur concurrent |

Aucun marqueur `TBD/FIXME/XXX` (debt) non référencé n'est présent dans les fichiers Phase 4.

### Human Verification Required

Aucun item bloquant ne nécessite une vérification humaine — les blockers identifiés sont vérifiables programmatiquement (présence/absence de PRAGMA, filtre sur corbeilleLe, etc.). Les améliorations UX restent à la discrétion du PO mais ne bloquent pas le goal.

### Gaps Summary

Le phase goal est **observable bout-en-bout côté UI** : un bailleur peut effectivement uploader → filtrer → consulter via fiches → créer un ticket avec PJ → tenter une purge bloquée 10 ans → restaurer. Les 4 success criteria sont couverts par 36 scénarios BDD verts (7 wave 1 + 14 wave 2 + 15 wave 3) et 573 tests vitest verts.

**Cependant, 3 défauts critiques compromettent la solidité de SC-3 (rétention 10 ans) et de la pureté DDD revendiquée par CLAUDE.md :**

1. **PRAGMA foreign_keys jamais activé** : la décision D-113 (cascade asymétrique) revendiquée par les SUMMARY est non-opérante en production. Le test cascade D-113 active manuellement le PRAGMA (`ticket-travaux-repository-sqlite.test.ts:271`) — c'est un témoin direct que la prod ne le fait pas. Un opérateur qui modifie la BD à la main (UPDATE direct) ou un futur use case (purge ticket, import legacy) brisera la cohérence référentielle silencieusement. SC-3 défense en profondeur n'est tenue que par les checks applicatifs ; les checks SQL CHECK polymorphes (D-103) restent OK mais ne suffisent pas pour D-113.

2. **`lire-ticket.ts` n'exclut pas les PJ en corbeille** : un Justificatif soft-deleted reste visible dans la fiche ticket avec un lien actif menant à un 410 silencieux. C'est une régression UX directement attribuable au plan 04-03.

3. **Violation DDD application → infrastructure** : `uploader-justificatif.ts` importe la classe concrète infra `StockageJustificatifsLocal` pour réutiliser `slugify`. Ceci viole CLAUDE.md ("Domaine pur : aucun import technique") étendu implicitement à `application/`, et n'est pas attrapé par `dependency-cruiser` (règle `no-application-to-infra` manquante).

Deux warnings additionnels (CR-05 Content-Disposition non-RFC-6266 ; CR-08 magic-bytes WebP/HEIC partiels) ne bloquent pas le goal mais devraient être réparés avant déploiement réseau.

**Recommandation orchestrateur :** Phase 4 a livré les 4 success criteria observables côté utilisateur, mais 3 invariants déclarés (D-113 cascade, défense DDD, intégrité fiche ticket) sont compromis dans le code. Avant de passer à Phase 5, lancer une gap-closure `/gsd-plan-phase --gaps` pour résorber les 3 blockers prioritaires (CR-01, CR-03, CR-06). Les warnings (CR-04, CR-05, CR-08, WR-02, WR-06) peuvent être tracés comme dette explicite dans `RISKS.md` si on accepte de reporter.

---

_Verified: 2026-05-18T15:08:00Z_
_Verifier: Claude (gsd-verifier)_
