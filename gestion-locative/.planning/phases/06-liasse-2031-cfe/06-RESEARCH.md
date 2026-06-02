# Phase 6 — Liasse 2031 & CFE — Research

**Researched:** 2026-06-02
**Domain:** Brouillon liasse fiscale LMNP (cerfa 2031-SD + annexes 2033-A/B/C/D + 2042 C PRO) et suivi déclaratif CFE (cerfa 1447-C-SD) avec alerte échéance.
**Mode:** MVP vertical slices + TDD (`workflow.tdd_mode=true`, `workflow.nyquist_validation=true`)
**Confiance globale:** HIGH sur architecture / patterns Phase 5 réutilisables, MEDIUM sur numéros de cases cerfa (sources externes divergentes → à figer en planning avec validation utilisateur sur cerfa officiel).

---

## Phase Overview

Phase 6 livre **deux capacités déclaratives** au-dessus des snapshots immuables de Phase 5 :

1. **FIS-05 — Brouillon de la liasse fiscale**. Mapping case-par-case (numéro de case cerfa + libellé officiel + valeur calculée + sources) couvrant le régime réel (2031-SD + annexes 2033-A/B/C/D) ET le micro-BIC (2042 C PRO minimaliste). Vue HTML primaire (consultée *pendant* la saisie sur impots.gouv.fr), export PDF (archivage), export CSV (expert-comptable, colonne `sources` incluse). Liasse rectificative dérivée de `DeclarationCorrigee` (même format + bandeau motif). Le port `MappingLiasseProvider` (versionné par millésime, miroir exact de `RegleFiscaleProvider`) garantit le fail-fast sur année non couverte.

2. **FIS-06 — Suivi déclaratif CFE**. Nouvel agrégat racine `DeclarationCfe` dans BC Fiscalité (référence `BienId` par identifiant, pattern `TicketTravaux → BienId`) avec statuts (`non_deposee | deposee | exoneree_premiere_annee | exoneree_commune | payee`), date de dépôt 1447-C-SD, montant d'avis et date d'échéance paiement. Banner J-30 décembre (pattern Phase 3 D-90, calcul à la demande via `Clock`, déterministe BDD). **L'app ne reproduit jamais le formulaire 1447-C-SD** et **ne calcule jamais la base imposable** (relève de la commune — R4.3 RISKS.md pédagogie sans fausse précision).

Mode TDD activé : tout calcul et tout mapping liasse passe par un scénario `.feature` Cucumber rouge → tests unitaires rouge/vert → scénario vert. Couverture **100 %** sur la logique fiscale (BDD_PRACTICES.md §7).

**Primary recommendation:** Cloner intégralement le pattern Phase 5 (`RegleFiscaleProvider` + `RegleFiscaleProviderEnMemoire` + `regles-2026.ts` + `RecapFiscalBuilder` port + adapter pdfmake) pour produire `MappingLiasseProvider` + `MappingLiasseProviderEnMemoire` + `mapping-liasse-2026.ts` + `BrouillonLiasseBuilder` port + `BrouillonLiasseBuilderPdfmake` adapter. Zéro nouvelle dépendance externe.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (19 décisions G1-G4 + rappels Phases 1-5)

**G1 — Format du brouillon liasse (FIS-05)**
- **D-L6.1** Mapping case-par-case (numéro + libellé officiel + valeur). Document distinct du récap PDF Phase 5.
- **D-L6.2** Couvre régime réel (2031-SD + 2033-A/B/C/D) ET micro-BIC (2042 C PRO minimaliste).
- **D-L6.3** Mapping versionné par année (`mapping-liasse-2026.ts`). Port `MappingLiasseProvider` + impl en mémoire `MappingLiasseProviderEnMemoire`. Fail-fast année non couverte. Pattern miroir exact `RegleFiscaleProvider`.
- **D-L6.4** Trois formats : vue HTML (`/fiscalite/declarations/:id/liasse`) + PDF + CSV. CSV inclut le mapping case-par-case (différent du récap CSV Phase 5).
- **D-L6.5** Liasse rectificative = même format + bandeau motif (pas de différentiel avant/après V1).

**G2 — Périmètre annexes 2033 (FIS-05)**
- **D-A6.1** Annexes 2033-A/B/C/D uniquement. 2033-E reportée V1.1, 2033-F/G exclues (sans objet personne physique).
- **D-A6.2** 2033-A = postes calculés uniquement (immobilisations, amortissements cumulés, VNC). Postes non modélisés (trésorerie, créances, dettes, emprunts) → marqués "à compléter manuellement".
- **D-A6.3** 2033-B = cœur du brouillon. Recettes / charges par catégorie / dotation / résultat fiscal.
- **D-A6.4** 2033-C ← `Composant` + lignes COMPOSANT de `AmortissementExercice`. 2033-D ← solde ARD exercice + tableau historique compact (lignes SYNTHESE_BIEN).

**G3 — Modèle CFE & alerte (FIS-06)**
- **D-CFE6.1** Suivi déclaratif, PAS de reproduction du 1447-C-SD.
- **D-CFE6.2** Nouvel agrégat racine `DeclarationCfe` dans BC Fiscalité (référence `BienId` par identifiant — pattern `TicketTravaux → BienId`). Brand type `DeclarationCfeId` + `nouveauDeclarationCfeId()`.
- **D-CFE6.3** Données capturées : `statut`, `dateDepotDeclaration` (1447-C-SD), `montantAvisCentimes: Money | null`, `dateEcheancePaiement` (décembre), `exercice`/`millesime`. Statuts : `non_deposee | deposee | exoneree_premiere_annee | exoneree_commune | payee`.
- **D-CFE6.4** Exonérations = statut + aide pédagogique. AUCUN calcul de base imposable.
- **D-CFE6.5** Alerte = banner J-30 sur fiche Bien + page `/fiscalite`. Pattern Phase 3 D-90 : calcul à la demande via `Clock`, pas de cron.

**G4 — Traçabilité liasse → sources**
- **D-T6.1** Liens cliquables HTML + annotations PDF + colonne CSV.
- **D-T6.2** Granularité par case cerfa.
- **D-T6.3** Read-model construit à la génération (use case cross-BC qui agrège sources vivantes via `RecettesRepository`, `ChargesRepository`, `TableauAmortissementRepository`).
- **D-T6.4 (CRITIQUE audit)** Snapshot fait foi + réconciliation visible. La valeur d'une case vient **toujours** du snapshot immuable ; les sources vivantes servent **uniquement** au drill-down. Si `Σ sources vivantes ≠ valeur snapshot` → bandeau de réconciliation. Respecte anti-patterns Phase 5 #3 (pas de recalcul UI) et #4 (snapshot immuable).

**Rappels Phases 1-5 verrouillés (non rediscutés)** : DV-01 → DV-07 (LMNP meublé longue durée, local-first SQLite, DDD hexagonal strict, ubiquitous language fr, BDD 100 % fiscale, MVP vertical slices, 6 BC). D-01 → D-27 (stack TS strict / Node 22 / Fastify / EJS / better-sqlite3 + Kysely / Vitest / Cucumber / fast-check / **Money bigint centimes** / **Temporal API** / Zod / **pdfmake** / Pico.css / dependency-cruiser / pnpm). D-FIS-G* Phase 5 (snapshot immuable, 6 composants BOFIP, ARD read-model, exports CSV/PDF, anti-patterns).

### Claude's Discretion (à trancher researcher → planner → executor)

- **Numéros de cases exacts** des cerfa millésime 2026 — vérifiés ci-dessous (sources externes) avec niveaux de confiance. Validation finale sur cerfa officiel impots.gouv.fr à la rédaction de `mapping-liasse-2026.ts`.
- Découpage migrations SQLite (recommandation : `0023_phase6_declaration_cfe.sql` — Phase 5 s'arrête à `0022_phase5_ticket_qualifie_le.sql`).
- Routes Fastify exactes (recommandation : `GET /fiscalite/declarations/:id/liasse`, `.../liasse.pdf`, `.../liasse.csv`, `GET/POST /biens/:id/cfe`).
- Helpers EJS (`formaterCaseLiasse`, `formaterStatutCfe`, `formaterMillesimeCfe`, `joursAvantEcheance`).
- Mise en page pdfmake (réutilise `pdf-renderer-pdfmake.ts`).
- Forme exacte DTO traçabilité par case.
- Algorithme exact de réconciliation snapshot vs vivant (tolérance, périmètre).

### Deferred Ideas (OUT OF SCOPE)

- **V1.1** : Annexe 2033-E (CVAE > 152 500 €), déclaration modificative CFE 1447-M-SD, SIM-01/02 (simulateur micro vs réel + plus-value LF 2025), liasse différentielle avant/après, calcul IR + prélèvements sociaux.
- **V2** : EDI-01 (export EDI-TDFC), assistant de remplissage 1447-C-SD case-par-case (calcul base imposable), override utilisateur du mapping.
- **Phase 7** : dashboard consolidé d'échéances (DAS-02) + notifications J-30/J-7. Phase 6 ne pose que le banner CFE contextuel.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **FIS-05** | Le système prépare le brouillon de la liasse 2031-SD et des annexes 2033-A à G (régime réel) — micro-BIC inclus (D-L6.2). | Mapping case-par-case `MappingLiasseProvider` (port versionné, miroir `RegleFiscaleProvider`) + read-model traçabilité construit à la génération (D-T6.3) + snapshot fait foi avec réconciliation (D-T6.4). Cases vérifiées section **Cerfa Case Mapping**. Export PDF/CSV via `BrouillonLiasseBuilder` port (pattern `RecapFiscalBuilder` Phase 5 plan 11). |
| **FIS-06** | Le système trace la déclaration CFE (1447-C-SD) et alerte sur l'échéance décembre. | Nouvel agrégat racine `DeclarationCfe` (BC Fiscalité, référence `BienId` par identifiant) + migration `0023_phase6_declaration_cfe.sql` + banner J-30 calcul à la demande via `Clock` (pattern `partial-indexation-banner.ejs` Phase 3 + `joursAvantEcheance` helper déterministe BDD). |

---

## Project Constraints (from CLAUDE.md)

| Constraint | Implication Phase 6 |
|-----------|---------------------|
| **V1 LMNP meublé longue durée** | Brouillon liasse pour ce périmètre uniquement (pas tourisme, pas SCI à l'IS, pas multi-bailleur). |
| **Local-first SQLite** | Migration `0023_phase6_declaration_cfe.sql` (better-sqlite3 + Kysely). Aucun appel cloud, aucune télédéclaration EDI-TDFC (V2). |
| **Single-user** | `DeclarationCfe` rattaché à un `BienId`, pas de notion d'utilisateur multiple. |
| **Pas de code métier sans test** (BDD_PRACTICES.md §5) | Cycle outside-in obligatoire : `.feature` rouge → unit/integration TDD rouge/vert → `.feature` vert. |
| **100 % couverture logique fiscale** (BDD_PRACTICES.md §7) | Mapping liasse = logique fiscale → chaque règle a son scénario. Chaque exception du droit (1ʳᵉ année exonérée, micro vs réel, rectificative) a son scénario dédié. |
| **Ubiquitous language français** | Tous identifiants code : `DeclarationCfe`, `BrouillonLiasse`, `MappingLiasse`, `CaseLiasse`, `StatutCfe`, `Millesime`, `Reconciliation`, `EcheanceCfe`. Pas d'anglais. |
| **Domaine pur** (DDD.md hexagonal strict) | `src/domain/fiscalite/declaration-cfe.ts`, `src/domain/fiscalite/liasse/*.ts` : zéro import technique (ORM, HTTP, pdfmake, fichier). Le port `BrouillonLiasseBuilder` retourne `unknown` (miroir `RecapFiscalBuilder` + `PdfRenderer`). Validation par `dependency-cruiser`. |
| **Docs commitées avec le code** | Tout changement de comportement Phase 6 met à jour `README.md` + sous-READMEs + LMNP.md (§7 CFE), même PR. `commit_docs: true` dans config. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Mapping case-par-case versionné par millésime | Domain (BC Fiscalité — port `MappingLiasseProvider` + données dans `domain/fiscalite/liasse/mapping-liasse-2026.ts`) | — | Pattern exact `RegleFiscaleProvider` / `regles-2026.ts` (Plan 05-01). Le mapping est une règle versionnée par révision triennale du cerfa, doit rester dans le domaine pur (zéro import technique). |
| Construction read-model brouillon liasse (DTO par case avec valeur snapshot + sources vivantes) | Application (use case `genererBrouillonLiasse`) | Domain (port `MappingLiasseProvider` + types `CaseLiasseDto`) | Orchestrateur cross-BC : lit snapshot `DeclarationAnnuelle` (Fiscalité), résout mapping (Fiscalité), agrège sources vivantes (Recettes/Charges/TableauAmortissement repos via ports), produit DTO. La logique de réconciliation est pure et vit dans une fonction domaine helper, l'orchestration HTTP/DB vit dans l'application. |
| Calcul de réconciliation Σ sources vivantes vs valeur snapshot | Domain (fonction pure `reconcilier(snapshot, sourcesVivantes): EcartReconciliation`) | Application (call) | Comparaison déterministe sur `Money` BigInt centimes. Doit être domaine pur (BDD outside-in 100 %). |
| Construction TDocumentDefinitions pdfmake brouillon liasse | Infrastructure (`BrouillonLiasseBuilderPdfmake` adapter) | Domain (port `BrouillonLiasseBuilder` retournant `unknown`) | Pattern miroir Plan 05-11 (`RecapFiscalBuilder` + `RecapFiscalBuilderPdfmake`). pdfmake est un package CJS lourd, jamais dans le domaine. |
| Génération CSV brouillon liasse (mapping case-par-case + colonne sources) | Application (use case `exporterCsvBrouillonLiasse`) | Domain (RecettesRepository, ChargesRepository, TableauAmortissementRepository pour sources) | Pattern existant `exporter-csv-fiscal.ts` étendu. UTF-8 BOM + séparateur `;` + Money.enEuros() pour mitiger CSV injection (T-05-07-04). |
| Persistance `DeclarationCfe` | Infrastructure (`DeclarationCfeRepositorySqlite` adapter) | Domain (port `DeclarationCfeRepository`) | Pattern existant `DeclarationAnnuelleRepositorySqlite` (Plan 05-06). `versDomaine`/`versRow` bidirectionnel. |
| Calcul "jours avant échéance CFE" | Domain (fonction pure `joursAvantEcheance(dateEcheance, clock): number`) | — | Déterministe via `Clock` port (pattern Phase 3 D-90 IRL banner). Aucune dépendance HTTP/DB. |
| Rendu banner J-30 contextuel | Web (vue EJS + helper `joursAvantEcheance`) | Application (use case `chargerDeclarationsCfeAvecAlerte`) | Calcul à la demande dans la route serveur (`partial-bandeau-cfe-echeance.ejs`), pas de cron. Mêmes prérequis pattern `partial-indexation-banner.ejs` Phase 3. |
| Validation HTTP formulaire CFE | Web (Zod schemas + route Fastify) | Domain (`DeclarationCfe.creer` invariants) | Zod aux frontières HTTP uniquement (jamais dans le domaine). Invariants métier dans factory `DeclarationCfe.creer`. |

---

## Standard Stack

### Core (déjà en place — réutiliser à 100 %)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@js-temporal/polyfill` | ^0.5.0 | `Temporal.PlainDate` + `Temporal.PlainDateTime` pour `dateEcheancePaiement` / `dateDepotDeclaration` / `clotureLe` / `creeLe` | D-12 verrouillé Phase 1, déjà en usage massif (Phase 5). Round-trip SQLite via TEXT ISO 8601 (pattern `bailleur-repository-fiscalite.test.ts`). [VERIFIED: package.json] |
| `kysely` | ^0.28.2 | Query builder + transactions atomiques pour `DeclarationCfeRepository` | Pattern établi Phases 1-5. Tous repositories utilisent `Kysely<DB>`. [VERIFIED: package.json + plan 05-06] |
| `better-sqlite3` | ^11.9.1 | Persistance locale `declarations_cfe` | Verrou Phase 1 D-14, local-first. [VERIFIED: package.json] |
| `pdfmake` | ^0.3.8 | Génération PDF brouillon liasse via `BrouillonLiasseBuilderPdfmake` adapter | Verrou Phase 1 D-21, déjà utilisé (Quittance, Avenant IRL, Mise en demeure, Récap fiscal). [VERIFIED: package.json + plan 05-11] |
| `fastify` | ^5.3.3 | Routes `/fiscalite/declarations/:id/liasse` + `/biens/:id/cfe` | Pattern routes Phase 5. [VERIFIED: package.json] |
| `ejs` | ^3.1.10 | Vue HTML brouillon liasse + formulaire CFE + banner J-30 | Verrou Phase 1, layout-debut/fin pattern. [VERIFIED: package.json] |
| `zod` | ^3.24.4 | Validation HTTP formulaire CFE (POST `/biens/:id/cfe`) | Zod aux frontières HTTP uniquement (D-15). [VERIFIED: package.json] |
| `vitest` | ^3.1.4 | Tests unitaires + intégration | Cycle TDD interne. `pnpm test:unit` + `pnpm test:integration`. [VERIFIED: package.json] |
| `@cucumber/cucumber` | ^11.3.0 | Tests BDD outside-in (scénarios `.feature`) | 100 % couverture fiscale (BDD_PRACTICES.md §7). `pnpm test:bdd`. [VERIFIED: package.json] |
| `fast-check` + `@fast-check/vitest` | ^4.1.1 + ^0.4.1 | Propriétés (réconciliation, mapping consistance) | Pattern Phase 5 (tests propriétés `Money.multiplyByFraction`). [VERIFIED: package.json] |
| `dependency-cruiser` | ^16.10.2 | Garantie hexagonale stricte (zéro import infra dans domaine) | `pnpm lint:deps` exit 0. [VERIFIED: package.json + Phase 5.1 hardening] |
| `@picocss/pico` | ^2.1.1 | Tokens CSS déjà en place (warning/destructive/success/accent — Phase 4 UI-1.3) | Aucun nouveau token Phase 6 (UI-SPEC §Design System verrouillé). [VERIFIED: package.json + public/styles/app.css] |

### Supporting (déjà en place)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@fastify/cookie` + `@fastify/csrf-protection` + `@fastify/session` | (Phase 1) | Sécurité formulaire CFE (POST) | Pattern existant tous POST de l'app. [VERIFIED: package.json] |
| `@fastify/static` | ^8.1.1 | Assets CSS | Déjà câblé. [VERIFIED: package.json] |
| `pino` | ^9.7.0 | Logs structurés | Pattern existant. [VERIFIED: package.json] |

### Alternatives Considérées

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pdfmake` (port `BrouillonLiasseBuilder` + adapter) | `puppeteer` / `weasyprint` / `wkhtmltopdf` | **NON** — Phase 1 a verrouillé `pdfmake` (D-21). Le pattern hexagonal Plan 05-11 produit déjà des PDF fiscaux satisfaisants (récap fiscal). Changer = scope creep + nouvelle dépendance. |
| Numéros de cases hardcodés dans use cases | Mapping centralisé `mapping-liasse-2026.ts` versionné | **MAPPING CENTRALISÉ obligatoire** (D-L6.3). Hardcoder = anti-pattern Phase 5 #2 (seuils hardcodés). |
| Recalcul à la volée pour le brouillon liasse | Snapshot fait foi + réconciliation (D-T6.4) | **SNAPSHOT obligatoire** (D-T6.4). Recalculer = anti-pattern Phase 5 #3 + #4. |
| Cron pour banner CFE J-30 | Calcul à la demande via `Clock` (pattern Phase 3 D-90) | **`Clock` obligatoire** (D-CFE6.5). Cron = non-déterministe BDD, complexité ajoutée, pas single-user/local-first. |

**Installation:** *(aucune nouvelle dépendance Phase 6 — confirmé via UI-SPEC §Registry Safety + Phase 5.1 hardening complete)*

**Version verification (executed in this research session):**

```bash
# Toutes versions actuelles vérifiées via package.json — aucun upgrade requis Phase 6.
$ cat package.json | jq '.dependencies | keys[]' | wc -l    # 17 deps de prod (D-01..D-27 verrouillées)
```

---

## Architecture Patterns

### System Architecture Diagram

```
                  HTTP requests
                       │
              ┌────────▼────────┐
              │  Fastify Routes │
              │  (web/routes/)   │
              └─┬──────────────┬┘
                │              │
   ┌────────────▼──┐    ┌──────▼──────────┐
   │ /fiscalite/   │    │ /biens/:id/cfe  │
   │ declarations/ │    │  (CRUD CFE)     │
   │ :id/liasse    │    │                 │
   │ (HTML/PDF/CSV)│    │                 │
   └────────┬──────┘    └────────┬────────┘
            │ Zod                │ Zod
            │ params/body        │ body
   ┌────────▼─────────────────────▼──────┐
   │     Application Use Cases           │
   │  (application/fiscalite/)           │
   │                                     │
   │  • genererBrouillonLiasse           │
   │  • exporterPdfBrouillonLiasse       │
   │  • exporterCsvBrouillonLiasse       │
   │  • enregistrerDeclarationCfe        │
   │  • modifierDeclarationCfe           │
   │  • listerDeclarationsCfeAvecAlerte  │
   └─┬─────────────────────────────────┬─┘
     │ Domain ports (zéro infra)       │
     ▼                                 ▼
   ┌─────────────────────────────────────┐
   │  Domain BC Fiscalité (étendu)       │
   │  (domain/fiscalite/)                │
   │                                     │
   │  • DeclarationCfe (agrégat racine)  │
   │  • MappingLiasseProvider (port)     │
   │  • MappingLiasse2026 (data)         │
   │  • BrouillonLiasseBuilder (port)    │
   │  • DeclarationCfeRepository (port)  │
   │  • reconcilier() (fonction pure)    │
   │                                     │
   │  Snapshots Phase 5 (lecture seule): │
   │  • DeclarationAnnuelle              │
   │  • DeclarationCorrigee              │
   │  • AmortissementExercice            │
   │  • Composant                        │
   │  • QualificationFiscale             │
   └─────────┬────────────────────┬──────┘
             │                    │
             ▼                    ▼
   ┌─────────────────┐  ┌──────────────────────┐
   │  Infrastructure │  │  Infrastructure (PDF)│
   │  (repos SQLite) │  │                      │
   │                 │  │ • BrouillonLiasse-   │
   │ • DeclarationCfe│  │   BuilderPdfmake     │
   │   RepositorySqlite│ │   (adapter)         │
   │ • + 5 repos     │  │ • PdfRendererPdfmake │
   │   Phase 5       │  │   (déjà en place)    │
   │   (RO Phase 6)  │  │                      │
   └────────┬────────┘  └──────────────────────┘
            │
            ▼
   ┌─────────────────────────┐
   │  SQLite                 │
   │  + table declarations_  │
   │    cfe                  │
   │  + 7 tables Phase 5     │
   └─────────────────────────┘
```

**Flux principal — génération brouillon liasse (vue HTML)** :

1. `GET /fiscalite/declarations/:id/liasse` → Fastify
2. Route appelle `genererBrouillonLiasse({ declarationId, mode: 'html' }, deps)`
3. Use case charge `DeclarationAnnuelle` (ou `DeclarationCorrigee`) via `declRepo`
4. Use case résout mapping via `mappingProvider.pour(exercice)` → throw `MappingLiasseAbsent` si année non couverte (fail-fast)
5. Use case agrège sources vivantes : `recettesRepo.sommeRecettesAnnuelles(...)`, `chargesRepo.sommeChargesParCategorie(...)`, `tableauAmortRepo.listerParBienExercice(...)`
6. Use case appelle fonction pure `reconcilier(snapshot, sourcesVivantes)` → écart par case (Money centimes diff)
7. Use case construit `BrouillonLiasseDto` (annexes 2031-SD + 2033-A/B/C/D ou 2042 C PRO selon `regimeApplique`)
8. Route render EJS avec `partial-tableau-liasse-section.ejs` + `partial-bandeau-reconciliation.ejs` conditionnel
9. **Anti-pattern critique D-T6.4 : la valeur affichée dans chaque case = TOUJOURS celle du snapshot, jamais une valeur recalculée. Le drill-down sert uniquement à comprendre les écarts.**

### Recommended Project Structure

```
src/
├── domain/
│   ├── _shared/
│   │   └── identifiants.ts            # ÉTENDRE : + DeclarationCfeId brand
│   └── fiscalite/
│       ├── declaration-cfe.ts                  # NOUVEAU : agrégat racine
│       ├── declaration-cfe-repository.ts       # NOUVEAU : port
│       ├── statut-cfe.ts                       # NOUVEAU : type union 5 valeurs
│       ├── reconciliation.ts                   # NOUVEAU : fonction pure reconcilier()
│       └── liasse/
│           ├── mapping-liasse-2026.ts          # NOUVEAU : data versionnée
│           ├── mapping-liasse-provider.ts      # NOUVEAU : port + impl en mémoire
│           ├── brouillon-liasse-builder.ts     # NOUVEAU : port (unknown)
│           ├── case-liasse.ts                  # NOUVEAU : types CaseLiasseDto + Section + Annexe
│           └── erreurs.ts                      # NOUVEAU : MappingLiasseAbsent, DeclarationCfeIntrouvable
├── application/
│   └── fiscalite/
│       ├── generer-brouillon-liasse.ts         # NOUVEAU : use case orchestrateur
│       ├── exporter-pdf-brouillon-liasse.ts    # NOUVEAU : use case PDF
│       ├── exporter-csv-brouillon-liasse.ts    # NOUVEAU : use case CSV (avec colonne sources)
│       ├── enregistrer-declaration-cfe.ts      # NOUVEAU : use case POST
│       ├── modifier-declaration-cfe.ts         # NOUVEAU : use case PUT
│       └── lister-declarations-cfe-avec-alerte.ts  # NOUVEAU : use case banner J-30
├── infrastructure/
│   ├── pdf/
│   │   ├── brouillon-liasse-doc-def.ts         # NOUVEAU : fonction pure pdfmake TDocumentDefinitions
│   │   └── brouillon-liasse-builder-pdfmake.ts # NOUVEAU : adapter pattern plan 05-11
│   └── repositories/
│       └── declaration-cfe-repository-sqlite.ts  # NOUVEAU : adapter SQLite
├── web/
│   ├── routes/
│   │   ├── fiscalite/
│   │   │   └── liasse.ts                       # NOUVEAU : GET liasse (HTML/PDF/CSV)
│   │   └── biens/
│   │       └── cfe.ts                          # NOUVEAU : GET/POST CFE
│   ├── views/
│   │   ├── pages/
│   │   │   ├── fiscalite/
│   │   │   │   └── brouillon-liasse.ejs        # NOUVEAU : vue principale
│   │   │   └── biens/
│   │   │       └── cfe/
│   │   │           ├── nouvelle.ejs            # NOUVEAU : formulaire création
│   │   │           └── editer.ejs              # NOUVEAU : formulaire édition
│   │   └── partials/
│   │       ├── partial-bandeau-brouillon-liasse.ejs   # NOUVEAU (S1 UI-SPEC)
│   │       ├── partial-bandeau-rectificative.ejs       # NOUVEAU (S6)
│   │       ├── partial-bandeau-reconciliation.ejs      # NOUVEAU (S5)
│   │       ├── partial-tableau-liasse-section.ejs      # NOUVEAU (S2)
│   │       ├── partial-drill-down-sources.ejs          # NOUVEAU (S4)
│   │       ├── partial-bandeau-cfe-echeance.ejs        # NOUVEAU (S10 — clone IRL)
│   │       ├── partial-carte-cfe.ejs                   # NOUVEAU (S8)
│   │       ├── partial-badge-statut-cfe.ejs            # NOUVEAU (S8/S9)
│   │       └── partial-aide-cfe.ejs                    # NOUVEAU (S9)
│   ├── helpers/
│   │   ├── formater-case-liasse.ts             # NOUVEAU
│   │   ├── formater-statut-cfe.ts              # NOUVEAU
│   │   ├── formater-millesime-cfe.ts           # NOUVEAU
│   │   └── jours-avant-echeance.ts             # NOUVEAU
│   └── schemas/
│       └── cfe-schemas.ts                      # NOUVEAU : Zod create/update DeclarationCfe
├── infrastructure/db/
│   └── kysely-types.ts                          # ÉTENDRE : + interface DeclarationsCfeTable
└── main.ts                                      # ÉTENDRE : DI MappingLiasseProviderEnMemoire + BrouillonLiasseBuilderPdfmake + DeclarationCfeRepositorySqlite

migrations/
└── 0023_phase6_declaration_cfe.sql             # NOUVEAU

tests/
├── _builders/
│   └── fiscalite.ts                            # ÉTENDRE : + declarationCfeBuilder, + mappingLiasseBuilder
├── unit/fiscalite/
│   ├── declaration-cfe.test.ts                 # NOUVEAU
│   ├── reconciliation.test.ts                  # NOUVEAU (+ fast-check propriétés)
│   ├── mapping-liasse-provider.test.ts         # NOUVEAU
│   ├── generer-brouillon-liasse.test.ts        # NOUVEAU
│   ├── enregistrer-declaration-cfe.test.ts     # NOUVEAU
│   └── jours-avant-echeance.test.ts            # NOUVEAU
├── integration/
│   ├── fiscalite/
│   │   ├── brouillon-liasse-snapshot.test.ts   # NOUVEAU
│   │   └── brouillon-liasse-rectificative.test.ts
│   └── repositories/
│       └── declaration-cfe-repository-sqlite.test.ts  # NOUVEAU (round-trip)
└── bdd/
    ├── features/
    │   ├── brouillon-liasse-reel.feature                # NOUVEAU
    │   ├── brouillon-liasse-micro.feature               # NOUVEAU
    │   ├── liasse-rectificative.feature                 # NOUVEAU
    │   ├── liasse-tracabilite.feature                   # NOUVEAU
    │   ├── mapping-liasse-versionne.feature             # NOUVEAU
    │   ├── cfe-suivi-declaratif.feature                 # NOUVEAU
    │   └── cfe-alerte-echeance.feature                  # NOUVEAU
    └── step_definitions/
        ├── brouillon-liasse.steps.ts                    # NOUVEAU
        └── cfe.steps.ts                                 # NOUVEAU
```

### Pattern 1 : Port versionné `MappingLiasseProvider` (miroir exact de `RegleFiscaleProvider`)

**What:** Port domaine qui résout le mapping case-par-case du cerfa pour un millésime donné, avec fail-fast si année non couverte.
**When to use:** À TOUTE invocation qui produit un brouillon de liasse (vue HTML, export PDF, export CSV, route GET, etc.). Jamais hardcoder les numéros de cases dans les use cases.
**Example:**

```typescript
// src/domain/fiscalite/liasse/mapping-liasse-provider.ts
// Source: pattern miroir src/domain/fiscalite/regles/regle-fiscale-provider.ts (Plan 05-01, vérifié) [VERIFIED: codebase]
import { MAPPING_LIASSE_2026, type MappingLiasse2026 } from './mapping-liasse-2026.js';
import { MappingLiasseAbsent } from './erreurs.js';

export interface MappingLiasseProvider {
  /**
   * Retourne le mapping case-par-case pour un millésime donné.
   * @throws {MappingLiasseAbsent} si le millésime n'est pas couvert (revue chaque janvier — R1.1 RISKS.md).
   */
  pour(millesime: number): MappingLiasse2026;
}

export class MappingLiasseProviderEnMemoire implements MappingLiasseProvider {
  private readonly _mappings: Map<number, MappingLiasse2026>;

  constructor() {
    this._mappings = new Map<number, MappingLiasse2026>([
      [2026, MAPPING_LIASSE_2026],
      // V1 : pas de garantie pour 2027/2028 sans revue manuelle du cerfa millésime (R1.1).
      // Le cerfa peut changer chaque année (LF — D-L6.3).
    ]);
  }

  pour(millesime: number): MappingLiasse2026 {
    const mapping = this._mappings.get(millesime);
    if (!mapping) throw new MappingLiasseAbsent(millesime);
    return mapping;
  }
}
```

**Note** : différence subtile avec `RegleFiscaleProvider` qui couvre la révision triennale 2026-2028 — le mapping cerfa doit être **revu chaque année** car le format peut changer (LF). On commence prudemment avec un seul millésime couvert (2026), puis on ajoute `mapping-liasse-2027.ts` à la rédaction.

### Pattern 2 : Port `BrouillonLiasseBuilder` (miroir exact de `RecapFiscalBuilder` — Plan 05-11)

**What:** Port domaine qui construit la définition de document pdfmake (`unknown`) pour le brouillon liasse.
**When to use:** À l'export PDF du brouillon liasse uniquement.
**Example:**

```typescript
// src/domain/fiscalite/liasse/brouillon-liasse-builder.ts
// Source: pattern miroir src/domain/fiscalite/recap-fiscal-builder.ts (Plan 05-11, vérifié) [VERIFIED: codebase]
import type { BrouillonLiasseDto } from './case-liasse.js';

export interface BrouillonLiasseBuilder {
  /**
   * Construit la TDocumentDefinitions pdfmake du brouillon liasse.
   * Le type concret est masqué en `unknown` pour préserver la pureté du domaine
   * (CLAUDE.md règle hexagonale, miroir RecapFiscalBuilder + PdfRenderer).
   */
  construire(dto: BrouillonLiasseDto): unknown;
}

// src/infrastructure/pdf/brouillon-liasse-builder-pdfmake.ts
import type { BrouillonLiasseBuilder } from '../../domain/fiscalite/liasse/brouillon-liasse-builder.js';
import type { BrouillonLiasseDto } from '../../domain/fiscalite/liasse/case-liasse.js';
import { construireBrouillonLiasse } from './brouillon-liasse-doc-def.js';

export class BrouillonLiasseBuilderPdfmake implements BrouillonLiasseBuilder {
  construire(dto: BrouillonLiasseDto): unknown {
    return construireBrouillonLiasse(dto);
  }
}
```

### Pattern 3 : Agrégat racine append-only `DeclarationCfe` (pattern Phase 1/5 — factory `creer()` + `InvariantViolated` + brand type)

**What:** Agrégat racine du BC Fiscalité, référence `BienId` par identifiant (pas sous-agrégat de Bien, cycle de vie indépendant + queryable séparément pour banner J-30).
**When to use:** Tout suivi déclaratif CFE par Bien × millésime.
**Example:**

```typescript
// src/domain/fiscalite/declaration-cfe.ts
import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { Money } from '../_shared/money.js';
import {
  nouveauDeclarationCfeId,
  type BienId,
  type DeclarationCfeId,
} from '../_shared/identifiants.js';

export type StatutCfe =
  | 'non_deposee'
  | 'deposee'
  | 'exoneree_premiere_annee'
  | 'exoneree_commune'
  | 'payee';

export interface DeclarationCfeProps {
  id?: DeclarationCfeId;
  bienId: BienId;
  millesime: number;
  statut: StatutCfe;
  dateDepotDeclaration: Temporal.PlainDate | null;
  montantAvisCentimes: Money | null;
  dateEcheancePaiement: Temporal.PlainDate;
}

export class DeclarationCfe {
  readonly id: DeclarationCfeId;
  readonly bienId: BienId;
  readonly millesime: number;
  readonly statut: StatutCfe;
  readonly dateDepotDeclaration: Temporal.PlainDate | null;
  readonly montantAvisCentimes: Money | null;
  readonly dateEcheancePaiement: Temporal.PlainDate;

  private constructor(id: DeclarationCfeId, props: Omit<DeclarationCfeProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.millesime = props.millesime;
    this.statut = props.statut;
    this.dateDepotDeclaration = props.dateDepotDeclaration;
    this.montantAvisCentimes = props.montantAvisCentimes;
    this.dateEcheancePaiement = props.dateEcheancePaiement;
  }

  static creer(props: DeclarationCfeProps): DeclarationCfe {
    if (props.millesime < 2020 || props.millesime > 2030) {
      throw new InvariantViolated(`millesime hors plage raisonnable (2020-2030) : ${props.millesime}`);
    }
    // Invariant : si statut = deposee → dateDepotDeclaration REQUIRED
    if (props.statut === 'deposee' && props.dateDepotDeclaration === null) {
      throw new InvariantViolated(
        "DeclarationCfe statut='deposee' exige dateDepotDeclaration (D-CFE6.3)",
      );
    }
    // Invariant : payee → dateDepotDeclaration ET montantAvisCentimes requis
    if (props.statut === 'payee' && (props.dateDepotDeclaration === null || props.montantAvisCentimes === null)) {
      throw new InvariantViolated(
        "DeclarationCfe statut='payee' exige dateDepotDeclaration + montantAvisCentimes (D-CFE6.3)",
      );
    }
    return new DeclarationCfe(props.id ?? nouveauDeclarationCfeId(), { ...props });
  }

  /** Copy-on-write pour les transitions de statut et la mise à jour de l'avis. */
  modifier(patch: Partial<Omit<DeclarationCfeProps, 'id' | 'bienId' | 'millesime'>>): DeclarationCfe {
    return DeclarationCfe.creer({
      id: this.id,
      bienId: this.bienId,
      millesime: this.millesime,
      statut: 'statut' in patch ? (patch.statut as StatutCfe) : this.statut,
      dateDepotDeclaration: 'dateDepotDeclaration' in patch
        ? (patch.dateDepotDeclaration as Temporal.PlainDate | null)
        : this.dateDepotDeclaration,
      montantAvisCentimes: 'montantAvisCentimes' in patch
        ? (patch.montantAvisCentimes as Money | null)
        : this.montantAvisCentimes,
      dateEcheancePaiement: patch.dateEcheancePaiement ?? this.dateEcheancePaiement,
    });
  }
}
```

**Note importante** : `modifier()` utilise le pattern `'field' in patch` (pas `??`) pour les champs nullables — appris Phase 5 Plan 01 (cf. `bailleur.ts`), évite l'écrasement silencieux quand le patch passe explicitement `null` pour effacer une valeur.

### Pattern 4 : Banner J-30 calcul à la demande via `Clock` (pattern Phase 3 D-90)

**What:** Calcul déterministe BDD-friendly du nombre de jours avant l'échéance CFE, sans cron.
**When to use:** Au rendu de chaque page susceptible d'afficher le banner (fiche `Bien`, page `/fiscalite`).
**Example:**

```typescript
// src/web/helpers/jours-avant-echeance.ts
import { Temporal } from '@js-temporal/polyfill';
import type { Clock } from '../../domain/_shared/clock.js';

/**
 * Différence en jours entre la date d'échéance et aujourd'hui.
 * Positif si futur, négatif si passé. Déterministe (Clock injecté).
 *
 * Pattern : src/web/views/partials/partial-indexation-banner.ejs (Phase 3 D-90)
 *           + src/application/locatif/lister-bails-indexables.ts (calcul à la demande)
 */
export function joursAvantEcheance(
  dateEcheance: Temporal.PlainDate,
  clock: Clock,
): number {
  return Temporal.PlainDate.compare(dateEcheance, clock.aujourdhui()) === 0
    ? 0
    : clock.aujourdhui().until(dateEcheance, { largestUnit: 'day' }).days;
}
```

```typescript
// Use case côté application
// src/application/fiscalite/lister-declarations-cfe-avec-alerte.ts
export async function listerDeclarationsCfeAvecAlerte(
  { bienId }: { bienId: BienId },
  { cfeRepo, clock }: { cfeRepo: DeclarationCfeRepository; clock: Clock },
): Promise<DeclarationCfeAvecAlerte[]> {
  const declarations = await cfeRepo.listerParBien(bienId);
  return declarations.map(d => ({
    declaration: d,
    joursRestants: joursAvantEcheance(d.dateEcheancePaiement, clock),
    alerteActive: estAlerteActive(d, clock),
  }));
}

function estAlerteActive(d: DeclarationCfe, clock: Clock): boolean {
  if (d.statut === 'payee' || d.statut === 'exoneree_premiere_annee' || d.statut === 'exoneree_commune') {
    return false;
  }
  const jours = joursAvantEcheance(d.dateEcheancePaiement, clock);
  return jours <= 30; // J-30 inclut J+ (échéance dépassée — variante destructive UI-SPEC §S10)
}
```

### Pattern 5 : Réconciliation snapshot vs sources vivantes (D-T6.4 CRITIQUE audit)

**What:** Fonction pure qui détecte les écarts entre snapshot immuable et somme des sources vivantes par case, sans masquer.
**When to use:** À chaque génération du brouillon liasse (vue HTML, export PDF, export CSV).
**Example:**

```typescript
// src/domain/fiscalite/reconciliation.ts
import { Money } from '../_shared/money.js';

export interface EcartReconciliationParCase {
  readonly caseId: string;
  readonly valeurSnapshot: Money;
  readonly valeurVivante: Money;
  readonly ecart: Money;  // valeurVivante - valeurSnapshot (négatif si vivant < snapshot)
}

export interface ResultatReconciliation {
  readonly cohérent: boolean;
  readonly nbPiecesModifiees: number;
  readonly ecartsParCase: ReadonlyArray<EcartReconciliationParCase>;
}

/**
 * Compare Σ(sources vivantes) vs valeur snapshot par case.
 * **Tolérance recommandée : strict 0** (Money BigInt centimes, comparaison exacte).
 *
 * D-T6.4 : ne JAMAIS recalculer une valeur de case depuis les sources vivantes ;
 * afficher l'écart, jamais le masquer. Anti-pattern Phase 5 #3 + #4.
 */
export function reconcilier(
  snapshot: ReadonlyMap<string, Money>,
  sourcesVivantes: ReadonlyMap<string, Money>,
): ResultatReconciliation {
  const ecarts: EcartReconciliationParCase[] = [];
  for (const [caseId, valeurSnap] of snapshot) {
    const valeurViv = sourcesVivantes.get(caseId) ?? Money.zero();
    if (!valeurSnap.egale(valeurViv)) {
      ecarts.push({
        caseId,
        valeurSnapshot: valeurSnap,
        valeurVivante: valeurViv,
        ecart: valeurViv.soustraire(valeurSnap),
      });
    }
  }
  return {
    cohérent: ecarts.length === 0,
    nbPiecesModifiees: ecarts.length,
    ecartsParCase: ecarts,
  };
}
```

**Tolérance recommandée : strict 0 centime** (tout écart est significatif sur Money BigInt). Si V1.1 montre des faux positifs sur arrondi cross-aggregation, on relâchera à `|ecart| ≤ 1 centime`. À valider en planning.

**Périmètre recommandé V1** : recettes annuelles + Σ charges déductibles + dotation d'amortissement totale. Le détail "par bien" est dans le drill-down `<details>`, pas dans la réconciliation initiale.

### Anti-Patterns à éviter (rappels Phase 5 + nouveaux Phase 6)

- **Recalculer la valeur d'une case dans la vue UI** (anti-pattern Phase 5 #3) → afficher TOUJOURS le snapshot, le drill-down sert uniquement à comprendre. La fonction `reconcilier` produit un signal, pas une nouvelle valeur.
- **Muter un snapshot Phase 5** (anti-pattern Phase 5 #4) → `DeclarationAnnuelle` reste APPEND-ONLY STRICT. Toute correction → nouvelle `DeclarationCorrigee`.
- **Hardcoder les numéros de cases dans use cases / routes** (anti-pattern Phase 5 #2 généralisé) → toujours passer par `MappingLiasseProvider.pour(exercice)` injecté.
- **Hand-roller un calcul de plus-value LMNP** (LF 2025) → V1.1 SIM-02. Phase 6 ne touche pas.
- **Charges déductibles ≠ qualification fiscale** (subtilité Phase 5 D-FIS-G2.2) → `QUALIFICATIONS_DEDUCTIBLES = ['entretien_reparation', 'amelioration', 'charge_courante_periodique']`. `non_qualifie` ET `non_deductible` sont exclus. À respecter dans tout filtre Phase 6 qui agrège les charges vivantes pour réconciliation.
- **Cron pour le banner CFE J-30** → calcul à la demande via `Clock`. Pattern Phase 3 D-90 testé/validé.
- **Reproduire le formulaire 1447-C-SD case-par-case** → hors scope (D-CFE6.1). Le formulaire Phase 6 ne capture que statut/dates/montant.
- **Calculer la base imposable CFE** → hors scope absolu (D-CFE6.4). Pédagogie sans fausse précision (R4.3).
- **Override "Re-calculer" sur le bandeau de réconciliation** → INTERDIT (D-T6.4 + UI-SPEC §S5). Le snapshot est immuable par décision domain D-FIS-G4.2.
- **Annexes 2033-E/F/G ou 1447-M-SD** → V1.1, ne pas attraper en scope creep.
- **Auto-application du mapping liasse à un millésime non couvert** (silencieux) → fail-fast `MappingLiasseAbsent` obligatoire (D-L6.3 + R1.1).

---

## Reusable Assets (NE PAS RÉ-IMPLÉMENTER)

### Domaine Fiscalité Phase 5 (lecture seule Phase 6)

| Chemin | Rôle |
|--------|------|
| `src/domain/fiscalite/declaration-annuelle.ts` | Snapshot immuable source des valeurs de cases (`recettesTotales`, `chargesQualifieesParCategorie`, `dotationAmortissement`, `ardGenere`, `ardConsomme`, `regimeApplique`, `composantsSnapshot`, `statutLmnpLmp`, `clotureLe`). Append-only strict. |
| `src/domain/fiscalite/declaration-corrigee.ts` | Source de la liasse rectificative (motif + valeurs corrigées). Pointe vers `declarationOriginaleId`. Append-only. |
| `src/domain/fiscalite/amortissement-exercice.ts` | Read-model lignes COMPOSANT (alimente 2033-C) + SYNTHESE_BIEN (ARD cumulé → 2033-D). VO immuable. |
| `src/domain/fiscalite/qualification-fiscale.ts` | Enum 4 catégories aligné 2033-A/B + `QUALIFICATIONS_DEDUCTIBLES` + `LABELS_QUALIFICATION`. |
| `src/domain/fiscalite/regles/regle-fiscale-provider.ts` | **Pattern exact à cloner** pour `MappingLiasseProvider`. |
| `src/domain/fiscalite/regles/regles-2026.ts` | **Pattern exact à cloner** pour `mapping-liasse-2026.ts` (constantes versionnées + JSDoc avec sources juridiques). |
| `src/domain/fiscalite/recap-fiscal-builder.ts` | **Pattern exact à cloner** pour `BrouillonLiasseBuilder` (port retour `unknown`). |
| `src/domain/fiscalite/recettes-repository.ts` | `sommeRecettesAnnuelles(bailleurId, annee)` — source recettes pour réconciliation 2033-B. |
| `src/domain/fiscalite/charges-repository.ts` | `sommeChargesParCategorie(bailleurId, annee)` — source charges pour réconciliation 2033-B. |
| `src/domain/fiscalite/tableau-amortissement-repository.ts` | `listerParBienExercice(bienId, exercice)` + `dernierArdCumuleBailleur(bailleurId, exercice)` — source amortissement pour 2033-C/D. |
| `src/domain/fiscalite/declaration-annuelle-repository.ts` | `trouverParId(id)` + `trouverParBailleurExercice(bailleurId, exercice)` — lookup snapshot. |
| `src/domain/fiscalite/erreurs.ts` | Pattern erreurs typées (`RegleFiscaleAbsente`, `DeclarationFigeeException`) — modèle pour `MappingLiasseAbsent`, `DeclarationCfeIntrouvable`. |

### Domaine partagé `_shared/`

| Chemin | Rôle |
|--------|------|
| `src/domain/_shared/money.ts` | `Money` BigInt centimes. `additionner`, `soustraire`, `egale`, `lt`, `superieurA`. **Aucun float dans `domain/fiscalite/`.** |
| `src/domain/_shared/clock.ts` | Port `Clock` + impl `ClockSysteme` (prod) + `ClockFixe` (tests). `aujourdhui(): Temporal.PlainDate`. À injecter dans `lister-declarations-cfe-avec-alerte`. |
| `src/domain/_shared/erreurs.ts` | `InvariantViolated` pour factory `DeclarationCfe.creer`. |
| `src/domain/_shared/identifiants.ts` | **À ÉTENDRE** Phase 6 : ajouter `DeclarationCfeId` brand type + `nouveauDeclarationCfeId()` (pattern crypto.randomUUID + brand). |

### Infrastructure PDF

| Chemin | Rôle |
|--------|------|
| `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` | `PdfRenderer.genererBuffer(docDef: unknown): Promise<Buffer>` — déjà câblé, à réutiliser tel quel pour le PDF brouillon liasse. |
| `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` | **Pattern exact à cloner** pour `BrouillonLiasseBuilderPdfmake`. |
| `src/infrastructure/pdf/recap-fiscal-doc-def.ts` | **Pattern à étudier** pour `brouillon-liasse-doc-def.ts` (fonction pure `construire*` qui retourne `TDocumentDefinitions`). |

### Application (use cases référence + routes existantes)

| Chemin | Rôle |
|--------|------|
| `src/application/fiscalite/exporter-csv-fiscal.ts` | **Pattern exact à cloner** pour `exporter-csv-brouillon-liasse.ts` (UTF-8 BOM `\uFEFF`, séparateur `;`, mitigation CSV injection via `Money.enEuros()`). |
| `src/application/fiscalite/exporter-pdf-recap.ts` | **Pattern exact à cloner** pour `exporter-pdf-brouillon-liasse.ts` (DI port + use case + nomFichier). |
| `src/web/routes/fiscalite/exports.ts` | **Pattern exact à cloner** pour route GET liasse (Content-Disposition RFC 6266 via `contentDispositionFilename()`, gestion erreurs typées). |
| `src/application/locatif/appliquer-indexation-irl.ts` | Pattern Phase 3 D-90 banner IRL (calcul à la demande via `Clock`, pas de cron) — modèle pour `lister-declarations-cfe-avec-alerte`. |

### Web (partials EJS + helpers)

| Chemin | Rôle |
|--------|------|
| `src/web/views/partials/partial-indexation-banner.ejs` | **Pattern exact à cloner** pour `partial-bandeau-cfe-echeance.ejs` (banner J-30). |
| `src/web/views/partials/data-table.ejs` | À réutiliser pour le tableau case-par-case (4 colonnes : Case, Libellé officiel, Valeur, Sources). |
| `src/web/views/partials/empty-state.ejs` | À réutiliser pour fiche CFE vide (S8) + absence de brouillon (S11). |
| `src/web/views/partials/banniere-warning.ejs` + `banniere-success.ejs` | À réutiliser pour bandeau "Postes manuels" S3 + bandeau rectificative S6 + bandeau success post-création CFE. |
| `src/web/views/partials/form-field.ejs` | À réutiliser pour les 5 champs du formulaire CFE S9. |
| `src/web/views/partials/layout-debut.ejs` + `layout-fin.ejs` + `sidebar-nav.ejs` + `breadcrumbs.ejs` | Layout standard, sidebar `navActive='fiscalite'` pour pages liasse, `navActive='biens'` pour fiche CFE. |
| `public/styles/app.css` (lignes 4-15) | **Source unique tokens CSS** — `--couleur-accent` `#1d4ed8`, `--couleur-warning` `#d97706`, `--couleur-destructive` `#dc2626`, `--couleur-success` `#16a34a`. Pas de nouveau token Phase 6. |
| `src/web/helpers/format-*.ts` (Phase 5) | `formatMoney`, `formatDate`, `formatAnnéeFiscale` — réutiliser pour valeurs cases + dates échéances. |

### Tests builders

| Chemin | Rôle |
|--------|------|
| `tests/_builders/fiscalite.ts` | **À ÉTENDRE** Phase 6 : ajouter `declarationCfeBuilder()`, `mappingLiasse2026Builder()`, fixtures de mapping cerfa. Pattern existant. |
| `tests/_builders/patrimoine.ts` | Réutiliser `bienBuilder()` pour seed dans tests CFE. |

---

## Cerfa Case Mapping

> **NIVEAU DE CONFIANCE des codes ci-dessous : MEDIUM**.
> Les sources externes consultées (lmnp-facile.fr, lmnp.ai, compta-online.com, jedeclaremonmeuble.com) divergent sur certaines cases (notamment 2033-B où certaines citent les codes lettres `FA/FC/FK/FY`, d'autres les numéros de lignes `210/218/254/280`).
> **Le cerfa officiel utilise les DEUX** : codes lettres dans les colonnes/cases ET numéros de lignes dans la marge — c'est cohérent.
> **Action planning** : ouvrir le PDF officiel `https://www.impots.gouv.fr/sites/default/files/formulaires/2031-sd/2026/2031-sd_5396.pdf` (et équivalents 2033-A/B/C/D + 2042 C PRO) au moment de la rédaction de `mapping-liasse-2026.ts` et confirmer code par code avec l'utilisateur. [CITED: impots.gouv.fr]

> **Pas de coût bloquant** : `MappingLiasseProvider.pour(2026)` peut être figé après cette validation visuelle ; le port garantit qu'aucun use case ne hardcode les valeurs (D-L6.3).

### 2031-SD — Déclaration de résultats BIC (régime réel)

[CITED: lmnp-facile.fr/guides/formulaire-2031-lmnp + impots.gouv.fr/formulaire/2031-sd]

| Code suggéré | Libellé officiel | Valeur calculée | Source juridique |
|--------------|------------------|-----------------|------------------|
| `AB` (ligne 1) | Production vendue (services) — loyers encaissés | `decl.recettesTotales` | BOFIP-BIC-DECLA-30-40-20 (comptabilité d'encaissement) |
| `AR` | Bénéfice de l'exercice | si résultat > 0 : `recettes − chargesDeductibles − dotation` | CGI art. 39 |
| `AS` | Déficit de l'exercice | si résultat < 0 : `\|résultat\|` (Money) | CGI art. 39 |
| `CB` ou `1GF` (ligne 10) | Bénéfice fiscal (à reporter sur 2042 C PRO ligne 5NA/5OA) | Bénéfice après réintégrations/déductions | CGI art. 50-0 (LMNP non pro) |
| `CC` ou `1GG` (ligne 10) | Déficit fiscal | Déficit reportable (10 ans en LMNP non pro) | CGI art. 156 I 1° bis |
| `D` | Régime d'imposition (case à cocher "Réel simplifié") | `'reel'` (D-FIS-G4.3) | BOFIP-BIC-DECLA-10-30 |

**Codes divergents observés entre sources**: `CB`/`CC` cités par lmnp-facile.fr, `CA`/`CB` cités par lmnp.ai. **À valider sur PDF officiel.** Mes sources fiables suggèrent `CB` pour bénéfice ; à recroiser.

### 2033-A — Bilan simplifié (postes calculés uniquement, D-A6.2)

[CITED: lmnp.ai + compta-online.com (codes AA-AT actif)]

| Code suggéré | Section | Libellé officiel | Valeur calculée | Source |
|--------------|---------|------------------|-----------------|--------|
| `AC` | Actif — Immobilisations corporelles brutes | Constructions (brut) | Σ `composant.montantHt` pour `type ∈ {gros_oeuvre, toiture_facade, installations_techniques, agencements_interieurs}` | BOFIP-BIC-AMT-20-40 |
| `BC` | Amortissements cumulés constructions | Σ `amortissementCumule` jusqu'à exercice N | CGI art. 39 |
| `CC` | VNC constructions | `AC − BC` (calculé) | — |
| `AC` (autres ligne) | Mobilier et matériel (brut) | Σ `composant.montantHt` pour `type = mobilier` | BOFIP |
| `BC` (autres ligne) | Amortissements cumulés mobilier | Σ `amortissementCumule mobilier` | — |
| Terrains brut | Hors lignes amortissables | `composant.montantHt` pour `type = terrain` | CGI art. 39 (non amortissable) |
| `AE` | Total actif immobilisé | Σ ci-dessus | — |
| Autres postes (trésorerie, créances, dettes, emprunts) | **NON CALCULÉS** | `"à compléter manuellement"` | D-A6.2 — bandeau S3 UI-SPEC |

**Remarque** : le cerfa 2033-A est intrinsèquement comptable. Le LMNP en réel simplifié ne maintient pas une comptabilité PCG complète → les postes "actif circulant" (trésorerie, créances) + "passif" (capital, emprunts) restent non modélisés Phase 6 et marqués "à compléter manuellement" (D-A6.2). Hypothèse honnête + audit-friendly.

### 2033-B — Compte de résultat simplifié (cœur du brouillon, D-A6.3)

[CITED: lmnp.ai + lmnp-declaration.fr + compta-online.com (codes FA, FC, FK, FY + lignes 210, 218, 254, 280)]

| Code suggéré | Libellé officiel | Valeur calculée | Source |
|--------------|------------------|-----------------|--------|
| **Produits** | | | |
| Ligne 210 / `FA` | Ventes de marchandises | `Money.zero()` (sans objet LMNP) | — |
| Ligne 218 / `FC` ou `FE` | Production vendue (services) — loyers encaissés | `decl.recettesTotales` | BOFIP-BIC-DECLA-30-40-20 |
| Ligne 232 | Total produits d'exploitation | Σ produits | — |
| **Charges** | | | |
| Ligne 234 | Achats de marchandises | `Money.zero()` | — |
| Ligne 242 / `FK` ou `FW` | Autres charges externes (assurance, syndic, entretien, honoraires EC, frais bancaires) | `decl.chargesQualifieesParCategorie.entretien_reparation + decl.chargesQualifieesParCategorie.charge_courante_periodique` (partiel — selon ventilation fine, voir Open Questions) | CGI art. 39 + BOFIP-BIC-CHG-30-40 |
| Ligne 252 / `FX` | Impôts, taxes et versements assimilés (TF nette, CFE) | sous-section de `charge_courante_periodique` | Décret 87-713 (TEOM exclue car récupérable) |
| Ligne 254 / `FY` ou ligne 280 / `GA` | Dotations aux amortissements | `decl.dotationAmortissement` | CGI art. 39 |
| Ligne 264 | Total charges d'exploitation | Σ charges | — |
| **Résultat** | | | |
| Ligne 270 / `GW` ou ligne 310 / `HN` | Résultat de l'exercice (comptable) | produits − charges | — |
| Ligne 318 / `WE` | ARD généré exercice (amortissements réputés différés) | `decl.ardGenere` | CGI art. 39 B |
| Ligne 350 / `WG` | ARD antérieur consommé | `decl.ardConsomme` | CGI art. 39 B |
| Ligne 370 / `XD` | Bénéfice fiscal (à reporter 2031 case `CB`) | si > 0 | — |
| Ligne 372 / `XF` | Déficit fiscal (à reporter 2031 case `CC`) | si < 0 | CGI art. 156 |

**Cohérence flux** : `Ligne 254 (dotation) = Σ AmortissementExercice[type='COMPOSANT'].dotationAppliquee` sur l'exercice → **invariant testable BDD** entre 2033-B et 2033-C.

### 2033-C — Immobilisations et amortissements (D-A6.4)

| Code suggéré | Section | Libellé officiel | Valeur calculée | Source |
|--------------|---------|------------------|-----------------|--------|
| Ligne 430 | Constructions — valeur début exercice | Σ `composant.montantHt` pour `type ∈ {gros_oeuvre, toiture_facade, installations_techniques, agencements_interieurs}` actifs au 1ᵉʳ janvier | BOFIP-BIC-AMT-20-40 |
| Ligne 432 | Augmentations exercice (amélioration, ajouts) | Σ `composant.montantHt` créés cet exercice (origine `amelioration`) | D-FIS-G1.5 + LF 2025 |
| Ligne 434 | Diminutions exercice (sortie composant) | Σ `composant.montantHt` avec `dateSortie` cet exercice | D-FIS-G5.2 + LF 2025 art. 84 |
| Ligne 436 | Constructions — valeur fin exercice | 430 + 432 − 434 | — |
| Ligne 470 | Mobilier — valeur début | Σ `composant[type=mobilier].montantHt` au 1ᵉʳ janvier | — |
| Ligne 520 | Amortissements cumulés constructions — début exercice | Σ `amortissementCumule` au 1ᵉʳ janvier | CGI art. 39 |
| Ligne 522 | Dotations amortissement exercice | `decl.dotationAmortissement` (cohérence avec 2033-B ligne 254) | CGI art. 39 |
| Ligne 526 | Amortissements cumulés constructions — fin exercice | 520 + 522 − reprises | — |

**Cohérence flux** : `2033-C ligne 522 = 2033-B ligne 254 = decl.dotationAmortissement` — invariant BDD critique. Tout écart = bug.

### 2033-D — Provisions, déficits, ARD (D-A6.4)

| Code suggéré | Libellé officiel | Valeur calculée | Source |
|--------------|------------------|-----------------|--------|
| Cadre III déficits (ligne historique) | Déficit reportable exercice N-1 | Σ `DeclarationAnnuelle.statutLmnpLmp = lmnp` exercices N-1 à N-10 avec déficit | CGI art. 156 I 1° bis (déficit LMNP non pro reportable 10 ans sur revenus locatifs meublés futurs) |
| Cadre ARD case unique | ARD cumulé disponible fin exercice | `tableauAmortRepo.dernierArdCumuleBailleur(bailleurId, exercice)` | CGI art. 39 B |
| **Tableau historique compact custom** (D-A6.4) | Année · Généré · Consommé · Cumul | Lignes `AmortissementExercice[type='SYNTHESE_BIEN']` pour toutes les années avec données | CGI art. 39 B + read-model D-FIS-G1.7 |

**Note** : le tableau historique compact est un ajout pédagogique D-A6.4 (lisibilité bailleur) — il ne correspond à AUCUNE case officielle du cerfa 2033-D mais est utile au bailleur (alimentation par lignes SYNTHESE_BIEN matérialisées en Phase 5).

### 2042 C PRO — Report micro-BIC (et report réel)

[CITED: rendimmo.fr/case-5nd-supprimee-2026 + lmnp-facile.fr]

| Code suggéré | Section | Libellé officiel | Valeur calculée | Source |
|--------------|---------|------------------|-----------------|--------|
| **MICRO-BIC** | | | |
| `5NI` (déclarant 1) | Location meublée longue durée | Recettes brutes (loyers + charges récupérées) | `decl.recettesTotales` | CGI art. 50-0 + Loi Le Meur (séparation tourisme/longue durée 2024) |
| `5OI` (déclarant 2) | idem pour conjoint | si bien en indivision (hors V1 — single-user) | — |
| `5PI` (personne à charge) | idem | si bien d'une personne à charge | — |
| **RÉGIME RÉEL** | | | |
| `5NA` (déclarant 1) | Bénéfice BIC réel LMNP non pro | `decl.bénéfice` (si > 0) — provenant de 2031-SD `CB` | CGI art. 50-0 + 156 I 1° bis |
| `5NY` (déclarant 1) | Déficit BIC réel LMNP non pro | `\|decl.déficit\|` — provenant de 2031-SD `CC` | CGI art. 156 |

**Changement LF 2024 majeur** : les cases `5ND/5OD/5PD` sont **SUPPRIMÉES en 2026** (déclaration sur revenus 2025) et remplacées par `5NI/5OI/5PI` pour la location meublée longue durée. Source vérifiée : rendimmo.fr [CITED]. **Action research** : confirmer que c'est bien la case `5NI` pour le bail longue durée (location meublée classique / étudiant / mobilité) et pas une autre. **L'app V1 cible la location meublée longue durée uniquement (CLAUDE.md), donc `5NI` est la seule case micro-BIC pertinente.**

### 1447-C-SD — Déclaration initiale CFE

[CITED: impots.gouv.fr/formulaire/1447-c-sd + BOFIP-IF-CFE-20-50-10]

**Hors scope reproduction case-par-case** (D-CFE6.1). L'app trace uniquement :

| Champ `DeclarationCfe` | Référence externe | Source |
|------------------------|-------------------|--------|
| `dateDepotDeclaration` | Date dépôt 1447-C-SD au SIE compétent | Date limite : **31 décembre** de l'année de création (CGI art. 1477 III) |
| `statut='exoneree_premiere_annee'` | Exonération automatique 1ʳᵉ année | **CGI art. 1478 II** (et non art. 1478 bis qui est conditionné à délibération communale) |
| `statut='exoneree_commune'` | Exonération additionnelle 3 ans suivant création | **CGI art. 1478 bis** (sur délibération de la commune/EPCI à fiscalité propre) |
| `dateEcheancePaiement` | Échéance paiement annuel (avis communal) | Typiquement **15 décembre** N pour exercice N |
| `montantAvisCentimes` | Montant CFE de l'avis (reçu en octobre/novembre N) | Calculé par le SIE — **PAS par l'app** (D-CFE6.4) |

**Correction importante UI-SPEC** : la spec UI cite `CGI art. 1478` pour la première année — c'est correct (II de l'art. 1478). La spec mentionne aussi `art. 1478` dans l'aide pédagogique mais sans préciser `II`. À conserver simple côté UI ; côté tests BDD et JSDoc, citer précisément `CGI art. 1478 II`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Numéros de cases hardcodés | Constantes éparses `const CASE_BENEFICE = 'CB'` dans use cases | `MappingLiasseProvider.pour(exercice)` injecté | D-L6.3 + révision annuelle (R1.1) → fail-fast année non couverte, versioning propre. |
| Génération PDF custom | Adapter pdfmake direct dans use case application | Port `BrouillonLiasseBuilder` + adapter `BrouillonLiasseBuilderPdfmake` (pattern Plan 05-11) | Règle hexagonale CLAUDE.md (domaine pur, application ne dépend pas d'infra). |
| Conversion Money centimes ↔ euros UI | Calculs ad-hoc `montant / 100` | `Money.enEuros()` existant (Intl.NumberFormat fr-FR) | Phase 1 D-09 + mitigation CSV injection T-05-07-04. Aucun float dans `domain/fiscalite/`. |
| Calcul "jours avant échéance" | `(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24)` | `Temporal.PlainDate.until(other, {largestUnit: 'day'}).days` | API standard Temporal, pas de fuseau horaire ni de DST. Phase 1 D-12 + pattern Phase 3 D-90. |
| Génération `DeclarationCfeId` | `Math.random()` ou `Date.now().toString()` | `crypto.randomUUID() as DeclarationCfeId` (brand type) | Pattern existant `identifiants.ts` Phase 5. Validation `UUID_V4_REGEX`. |
| Round-trip Temporal ↔ SQLite | Sérialisation manuelle | `dateEcheance.toString()` + `Temporal.PlainDate.from(rowText)` | Pattern Phase 5 `bailleur-repository-sqlite.ts` (TEXT ISO 8601). |
| Réconciliation snapshot vs vivant | Boucle `forEach` mutable | Fonction pure `reconcilier()` retournant `ResultatReconciliation` immuable | Anti-pattern Phase 5 #3 + couverture BDD 100 % fiscale. |
| Validation HTTP côté domain | Zod dans `DeclarationCfe.creer` | Zod dans `web/schemas/cfe-schemas.ts` + invariants `InvariantViolated` côté domaine | D-15 verrouillé Phase 1 (Zod aux frontières HTTP uniquement). |
| Content-Disposition manuel | `'attachment; filename=...'` | Helper `contentDispositionFilename(nomFichier)` existant (RFC 6266 UTF-8) | Pattern `src/web/routes/fiscalite/exports.ts` Phase 5 + T-04-CR-04 Phase 4. |
| CSV séparateur virgule + parsing locale | Format anglo-saxon | UTF-8 BOM `\uFEFF` + séparateur `;` + `Money.enEuros()` (mitigation CSV injection T-05-07-04) | Pattern `exporter-csv-fiscal.ts` Phase 5. |
| Calcul échéance CFE automatique | Algorithme date 15 décembre | Champ utilisateur `dateEcheancePaiement: Temporal.PlainDate` (D-CFE6.3) | L'échéance est sur l'avis reçu de la commune, peut varier (R4.3 pédagogie + autonomie). |
| Calcul base imposable CFE | Algorithme valeur locative | **JAMAIS** (D-CFE6.4 + R4.3) | La base est calculée par la commune via le SIE. Aucune fausse précision. |
| Cron J-30 background | `setInterval` ou daemon | Calcul à la demande au rendu de chaque page concernée (`Clock` injecté) | Pattern Phase 3 D-90 banner IRL — déterministe BDD, single-user/local-first, pas de processus permanent. |

**Key insight** : Phase 5 + Phase 5.1 ont livré tout le pattern hexagonal + pdfmake + CSV + RFC 6266 + figée check + ARD cross-exercice. Phase 6 est essentiellement du **mapping** + **agrégat léger CFE** + **banner** par-dessus. Aucune nouvelle infrastructure technique requise.

---

## Common Pitfalls

### Pitfall 1 : Hardcoder les numéros de cases dans les use cases ou les vues EJS

**What goes wrong:** Les codes lettrés du cerfa apparaissent en dur dans `generer-brouillon-liasse.ts` ou dans `brouillon-liasse.ejs`. Quand la LF 2027 ou le millésime suivant change un code, il faut chercher partout.
**Why it happens:** Tentation de "voir le code de la case directement dans la logique métier" (lisibilité illusoire).
**How to avoid:** Pattern miroir exact `RegleFiscaleProvider` (D-L6.3). Tous les codes vivent dans `mapping-liasse-2026.ts`. Les use cases reçoivent `MappingLiasseProvider.pour(exercice)`. Le compilateur garantit qu'aucun string littéral cerfa ne traîne ailleurs (à l'aide d'un brand type `CaseLiasseId = string & { __brand: 'CaseLiasseId' }`).
**Warning signs:** `grep -E "'[A-Z]{2}'|\"[A-Z]{2}\"" src/application/fiscalite/` → 0 résultat attendu (sauf `MappingLiasseProvider.pour`). Test BDD `mapping-liasse-versionne.feature` qui simule année non couverte → fail-fast obligatoire.

### Pitfall 2 : Recalculer une valeur de case depuis les sources vivantes en cas d'écart

**What goes wrong:** Le développeur regarde le bandeau de réconciliation et "corrige" la valeur affichée dans le tableau pour la recalculer depuis les sources vivantes.
**Why it happens:** Réflexe "il faut afficher la valeur la plus à jour".
**How to avoid:** **Anti-pattern Phase 5 #3 + #4 strictement appliqué** (D-T6.4). La valeur de case = TOUJOURS le snapshot. Le bandeau de réconciliation est un SIGNAL, pas une correction. Si l'utilisateur veut corriger : il crée une `DeclarationCorrigee` (Phase 5).
**Warning signs:** Code review ou plan-checker doit flagger toute fonction `genererBrouillonLiasse` qui appelle `recettesRepo.sommeRecettesAnnuelles()` pour construire la **valeur** du brouillon. Cette source ne doit servir QUE au drill-down `<details>` + à la fonction `reconcilier()`.

### Pitfall 3 : Charges agrégées 2033-B sans respect de la taxonomie 4 catégories

**What goes wrong:** Le mapping additionne toutes les charges qualifiées dans une seule case "autres charges externes" ligne 242 du 2033-B, masquant la distinction `entretien_reparation` (charge immédiate) vs `amelioration` (immobilisable, va sur 2033-C).
**Why it happens:** La taxonomie Phase 5 D-FIS-G2.2 (4 catégories) est alignée 2033-A mais le mapping ligne-à-ligne 2033-B est subtile.
**How to avoid:**
- `entretien_reparation` → 2033-B ligne 242 (autres charges externes — déductible immédiat)
- `charge_courante_periodique` → 2033-B ligne 242 (autres charges externes) ET ligne 252 (impôts/taxes) selon sous-catégorie (TF, assurance, syndic, intérêts d'emprunt). À planifier finement avec mapping fin.
- `amelioration` → **JAMAIS sur 2033-B** (immobilisable, va sur 2033-C comme nouveau composant). Vérifier que le mapping liasse n'inclut pas `amelioration` dans la somme des charges.
- `non_deductible` → Hors liasse (perso, hors fiscal).
**Warning signs:** Test BDD `brouillon-liasse-reel.feature` qui valide qu'une `amelioration` n'apparaît PAS sur 2033-B ligne 242 mais alimente une ligne 432 sur 2033-C (augmentation immobilisations brutes).

### Pitfall 4 : Snapshot immuable muté par mégarde via `DeclarationCorrigee`

**What goes wrong:** L'implémentation initiale de `DeclarationCorrigee` "remplace" la `DeclarationAnnuelle` originale par UPDATE.
**Why it happens:** Réflexe relationnel CRUD.
**How to avoid:** **Anti-pattern Phase 5 #4 strict** (D-FIS-G4.2 + D-FIS-G4.4 + D-L6.5). Les deux agrégats sont APPEND-ONLY STRICT — pas de méthode mutator, pas de UPDATE, pas de `onConflict`. La liasse rectificative Phase 6 lit `DeclarationCorrigee` (par valeur, append-only). La déclaration originale RESTE INTACTE et reste consultable (UI-SPEC §S6 lien "Voir la déclaration originale").
**Warning signs:** Plan-checker flagge tout UPDATE/DELETE sur `declarations_annuelles` ou `declarations_corrigees`. Test BDD `liasse-rectificative.feature` vérifie l'intégrité de l'originale post-création de la corrigée.

### Pitfall 5 : Banner J-30 affiché alors que statut = `payee` ou `exoneree_*`

**What goes wrong:** Le banner alerte sur une CFE déjà payée ou exonérée, créant du bruit.
**Why it happens:** Le calcul `joursAvantEcheance()` ignore le statut.
**How to avoid:** Le use case `listerDeclarationsCfeAvecAlerte` (ou la route serveur) filtre **avant** le rendu :

```typescript
function estAlerteActive(d: DeclarationCfe, clock: Clock): boolean {
  if (['payee', 'exoneree_premiere_annee', 'exoneree_commune'].includes(d.statut)) return false;
  const jours = joursAvantEcheance(d.dateEcheancePaiement, clock);
  return jours <= 30; // J-30 + J+ (échéance dépassée — variante destructive UI-SPEC §S10)
}
```

**Warning signs:** Test BDD `cfe-alerte-echeance.feature` couvre 5 scénarios : statut=`non_deposee` + J-15 → warning ; statut=`payee` + J-5 → aucun banner ; statut=`exoneree_premiere_annee` + J-5 → aucun banner ; statut=`deposee` + J-5 → warning forte ; statut=`non_deposee` + J+10 → destructive.

### Pitfall 6 : Mapping liasse hardcodé pour 2026 même quand l'exercice est 2027/2028

**What goes wrong:** L'utilisateur essaie de générer un brouillon pour `exercice=2027`. Le mapping retourne du 2026 silencieusement → divergence avec le cerfa officiel 2027.
**Why it happens:** Tentation de copier le pattern `RegleFiscaleProviderEnMemoire` qui mappe 2026/2027/2028 → REGLES_2026 (révision triennale fiscale, qui est stable).
**How to avoid:** **Le cerfa peut changer chaque année** (LF). Le `MappingLiasseProviderEnMemoire` couvre UNIQUEMENT les millésimes où le mapping a été manuellement vérifié contre le PDF officiel impots.gouv.fr. Premier millésime couvert : **2026** uniquement. 2027 → fail-fast `MappingLiasseAbsent` jusqu'à publication LF 2027 et mise à jour `mapping-liasse-2027.ts`. Différence sémantique majeure avec les seuils fiscaux (révision triennale).
**Warning signs:** JSDoc `mapping-liasse-2026.ts` mentionne explicitement la révision annuelle (vs triennale pour `regles-2026.ts`). Test BDD `mapping-liasse-versionne.feature` : `Given exercice 2027 When generer-brouillon-liasse Then MappingLiasseAbsent levée + UI page d'erreur dédiée (D-L6.3 + R1.1)`.

### Pitfall 7 : Sources vivantes incluant les charges `non_qualifie` ou `non_deductible`

**What goes wrong:** Le drill-down "Voir 5 sources" inclut des justificatifs non qualifiés ou non déductibles, qui ne devraient pas alimenter la valeur du snapshot.
**Why it happens:** `chargesRepo.sommeChargesParCategorie` retourne un objet `Record<QualificationFiscale, Money>` avec **toutes** les catégories (y compris `non_qualifie` et `non_deductible`).
**How to avoid:** Filtrer en utilisant `QUALIFICATIONS_DEDUCTIBLES` (export Phase 5 `qualification-fiscale.ts`) avant d'inclure dans le DTO sources. Le drill-down liste **uniquement les justificatifs déductibles** (sinon l'utilisateur s'interroge sur la présence de justificatifs non comptés).
**Warning signs:** Test BDD `liasse-tracabilite.feature` scénario : `Given 5 justificatifs dont 1 non_qualifie + 1 non_deductible Then drill-down montre 3 sources, pas 5`.

---

## Runtime State Inventory

**Phase 6 est une phase d'ajout (greenfield), pas un rename/refactor/migration.** Cette section est néanmoins remplie au cas où un point ait été manqué.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Nouvelle table SQLite `declarations_cfe`** (migration `0023_phase6_declaration_cfe.sql`). Aucune migration de données existantes (table créée vide). | Aucune migration de données. La table est nouvelle. |
| Live service config | **None** — vérifié par grep : aucun service externe (n8n, Datadog, Tailscale) référencé dans `gestion-locative/`. Application autonome local-first. | None. |
| OS-registered state | **None** — vérifié : pas de Windows Task Scheduler / launchd / systemd dans `gestion-locative/`. L'app est lancée à la demande (`pnpm start`). | None. |
| Secrets/env vars | **None** — vérifié : pas de fichier `.env` consulté par Phase 5/6. Le port `Clock` est injecté côté code, pas par env. | None. |
| Build artifacts | **None** — projet TypeScript avec `pnpm` ; pas de build artefact persistant (Vitest + tsx en mode interprété). | None. Pas de `pnpm rebuild` requis. |

**Verified explicitly**: phase 6 ne renomme rien, ne déplace rien, n'invalide aucun cache. Les snapshots Phase 5 restent intouchés (D-FIS-G4.2 append-only strict + cohérence Phase 5.1 hardening complete).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | runtime | ✓ | ≥ 22.0.0 (engines.node = >=22) [VERIFIED: package.json] | — |
| pnpm | gestion deps | ✓ | 9.15.9 (packageManager) [VERIFIED: package.json] | — |
| SQLite (better-sqlite3) | persistance | ✓ | 11.9.1 (auto via npm, native compile) [VERIFIED: package.json] | — |
| pdfmake | PDF brouillon liasse | ✓ | 0.3.8 (CJS via createRequire) [VERIFIED: package.json + plan 05-11] | — |
| Temporal polyfill | dates | ✓ | 0.5.0 [VERIFIED: package.json] | — |
| Vitest / Cucumber / fast-check | tests | ✓ | 3.1.4 / 11.3.0 / 4.1.1 [VERIFIED: package.json] | — |
| dependency-cruiser | hexagonal lint | ✓ | 16.10.2 [VERIFIED: package.json + Phase 5.1 hardening complete] | — |

**Missing dependencies with no fallback:** Aucune.
**Missing dependencies with fallback:** Aucune.

L'environnement Phase 6 est strictement équivalent à Phase 5 (aucune nouvelle dépendance — confirmé UI-SPEC §Registry Safety).

---

## Validation Architecture (Nyquist `workflow.nyquist_validation = true`)

### Test Framework

| Property | Value |
|----------|-------|
| Framework (unit + intégration) | **Vitest 3.1.4** |
| Framework BDD | **Cucumber 11.3.0** |
| Property-based | **fast-check 4.1.1 + @fast-check/vitest 0.4.1** |
| Config file | `vitest.config.ts` + `cucumber.cjs` (existants Phase 1) |
| Quick run command unit | `pnpm test:unit -- tests/unit/fiscalite/` (filtre Phase 6) |
| Quick run command BDD Phase 6 | `pnpm test:bdd -- --tags "@phase6"` |
| Full suite command | `pnpm test && pnpm test:bdd && pnpm typecheck && pnpm lint:deps` |
| Hexagonal check | `pnpm lint:deps` (dependency-cruiser) — déjà à 0 violation après Phase 5.1 |
| Couverture cible | **100 %** sur `src/domain/fiscalite/liasse/` + `src/domain/fiscalite/declaration-cfe.ts` + `src/domain/fiscalite/reconciliation.ts` (BDD_PRACTICES.md §7) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIS-05 | Mapping case-par-case correct sur snapshot réel (2031-SD + 2033-A/B/C/D) | BDD | `pnpm test:bdd -- --tags "@phase6-liasse-reel"` | ❌ Wave 0 |
| FIS-05 | Mapping case-par-case correct sur snapshot micro-BIC (2042 C PRO) | BDD | `pnpm test:bdd -- --tags "@phase6-liasse-micro"` | ❌ Wave 0 |
| FIS-05 | Liasse rectificative dérivée de `DeclarationCorrigee` avec bandeau motif | BDD | `pnpm test:bdd -- --tags "@phase6-liasse-rectificative"` | ❌ Wave 0 |
| FIS-05 | Traçabilité case → sources + bandeau réconciliation snapshot ≠ vivant | BDD | `pnpm test:bdd -- --tags "@phase6-liasse-tracabilite"` | ❌ Wave 0 |
| FIS-05 | Fail-fast millésime non couvert | BDD | `pnpm test:bdd -- --tags "@phase6-mapping-versionne"` | ❌ Wave 0 |
| FIS-05 | Fonction pure `reconcilier(snapshot, vivantes)` — propriétés fast-check | Unit + property | `pnpm test:unit -- reconciliation.test.ts` | ❌ Wave 0 |
| FIS-05 | Export PDF brouillon liasse (magic bytes %PDF + nomFichier) | Intégration | `pnpm test:integration -- exporter-pdf-brouillon-liasse.test.ts` | ❌ Wave 0 |
| FIS-05 | Export CSV brouillon liasse (BOM UTF-8 + colonne sources + mitigation injection) | Intégration | `pnpm test:integration -- exporter-csv-brouillon-liasse.test.ts` | ❌ Wave 0 |
| FIS-06 | CRUD `DeclarationCfe` + statuts + invariants (`statut=deposee ⇒ dateDepotDeclaration REQUIRED`) | Unit | `pnpm test:unit -- declaration-cfe.test.ts` | ❌ Wave 0 |
| FIS-06 | Round-trip SQLite `DeclarationCfeRepository` (Temporal + Money + 5 statuts) | Intégration | `pnpm test:integration -- declaration-cfe-repository-sqlite.test.ts` | ❌ Wave 0 |
| FIS-06 | Suivi déclaratif + exonération première année (CGI art. 1478 II) | BDD | `pnpm test:bdd -- --tags "@phase6-cfe-suivi"` | ❌ Wave 0 |
| FIS-06 | Banner J-30 décembre (`joursAvantEcheance` déterministe via ClockFixe) | BDD | `pnpm test:bdd -- --tags "@phase6-cfe-alerte"` | ❌ Wave 0 |
| FIS-06 | Variantes warning J-30→J-8, warning forte J-7→J-0, destructive J+1+ | Unit + BDD | `pnpm test:unit -- jours-avant-echeance.test.ts` + `--tags "@phase6-cfe-alerte"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm typecheck && pnpm test:unit -- tests/unit/fiscalite/` (cible : < 10 s).
- **Per wave merge:** `pnpm test && pnpm test:bdd -- --tags "@phase6"` (cible : < 30 s).
- **Phase gate:** `pnpm test && pnpm test:bdd && pnpm typecheck && pnpm lint:deps` exit 0 + couverture ≥ seuils BDD_PRACTICES.md §7 + grep `from.*infrastructure` dans `src/domain/fiscalite/liasse/` → 0 résultat + grep `from.*pdfmake` dans `src/domain/` → 0 résultat.

### Propriétés fast-check obligatoires Phase 6

1. **Réconciliation symétrique** — `forall snapshot, vivantes: reconcilier(snapshot, vivantes).ecartsParCase.every(e => e.ecart === e.valeurVivante.soustraire(e.valeurSnapshot))`.
2. **Réconciliation cohérente sur snapshots identiques** — `forall data: reconcilier(data, data).cohérent === true`.
3. **`joursAvantEcheance` monotone** — `forall date1 < date2, clockFixe: joursAvantEcheance(date1, clockFixe) < joursAvantEcheance(date2, clockFixe)`.
4. **Mapping injectif sur le millésime 2026** — `forall casesId differents: MAPPING_LIASSE_2026[caseA].section !== MAPPING_LIASSE_2026[caseB].section` ou `caseA === caseB` (un caseId est unique).
5. **Money non-négatif sur recettes/charges Phase 6** — `forall input: brouillonLiasseDto.cases.filter(c => c.valeur < 0).every(c => c.libelle.includes('Déficit'))` (seules les cases de déficit peuvent être négatives, le reste ≥ 0).

### Scénarios BDD outside-in (`.feature`) obligatoires Phase 6

Ordre exécution outside-in :

1. **`mapping-liasse-versionne.feature`** (@phase6 @phase6-mapping-versionne) — 3 scénarios
   - Mapping 2026 trouvé → OK
   - Mapping 2027 absent → `MappingLiasseAbsent` + page d'erreur dédiée
   - Mapping 2025 (pré-V1) absent → `MappingLiasseAbsent`
2. **`brouillon-liasse-reel.feature`** (@phase6 @phase6-liasse-reel) — 6 scénarios
   - Snapshot réel + 1 bien + 6 composants → 2031-SD `CB` + 2033-B ligne 218 (recettes) + ligne 254 (dotation) + 2033-C ligne 522 + 2033-D ARD
   - Cohérence flux 2033-B ligne 254 == 2033-C ligne 522 == `decl.dotationAmortissement` (invariant)
   - Bénéfice exercice → 2031-SD `CB` non vide, `CC` vide
   - Déficit exercice → 2031-SD `CC` non vide, `CB` vide
   - ARD généré dans l'exercice → 2033-B ligne 318 + tableau historique 2033-D
   - Liasse 2031-SD case `AB` = `decl.recettesTotales.enEuros()`
3. **`brouillon-liasse-micro.feature`** (@phase6 @phase6-liasse-micro) — 3 scénarios
   - Snapshot micro + 50 % abattement → 2042 C PRO case `5NI` = `decl.recettesTotales.enEuros()` (recettes brutes, pas net)
   - Aucune 2033-A/B/C/D rendue (régime micro)
   - Bandeau "Brouillon — à reporter" affiché
4. **`liasse-rectificative.feature`** (@phase6 @phase6-liasse-rectificative) — 4 scénarios
   - `DeclarationCorrigee` → bandeau motif S6 affiché
   - Lien "Voir la déclaration originale" présent → ancien brouillon consultable (intégrité)
   - Plusieurs `DeclarationCorrigee` successives → seule la plus récente est le brouillon "actuel"
   - Originale immuable après création de la corrigée (test régression)
5. **`liasse-tracabilite.feature`** (@phase6 @phase6-liasse-tracabilite) — 7 scénarios
   - Cas snapshot == vivant : aucun bandeau réconciliation S5
   - Cas snapshot ≠ vivant : bandeau S5 affiché + N pièces modifiées correct
   - Drill-down recettes : N sources `Encaissement` listées + URLs ancrées vers `/encaissements/:id`
   - Drill-down charges : N sources `Justificatif` listées (filtre `QUALIFICATIONS_DEDUCTIBLES`)
   - Drill-down amortissement : N lignes `AmortissementExercice` listées
   - `non_qualifie` exclu du drill-down charges
   - `non_deductible` exclu du drill-down charges
6. **`cfe-suivi-declaratif.feature`** (@phase6 @phase6-cfe-suivi) — 6 scénarios
   - Création `DeclarationCfe` statut `non_deposee` → OK
   - Transition vers `deposee` exige `dateDepotDeclaration` non null (invariant)
   - Transition vers `payee` exige `dateDepotDeclaration` + `montantAvisCentimes` non null
   - Statut `exoneree_premiere_annee` → aide pédagogique citant **CGI art. 1478 II**
   - Statut `exoneree_commune` → aide pédagogique citant **CGI art. 1478 bis**
   - Édition d'une déclaration existante : `modifier()` copy-on-write conserve les champs non patchés
7. **`cfe-alerte-echeance.feature`** (@phase6 @phase6-cfe-alerte) — 8 scénarios (ClockFixe pour déterminisme)
   - Échéance 2026-12-15, today=2026-11-15, statut=`non_deposee` → banner warning "30 jours restants"
   - Échéance 2026-12-15, today=2026-12-08, statut=`deposee` → banner warning forte "7 jours restants"
   - Échéance 2026-12-15, today=2026-12-15, statut=`deposee` → banner warning forte "0 jours restants"
   - Échéance 2026-12-15, today=2026-12-16, statut=`deposee` → banner destructive "dépassée depuis 1 jour"
   - Échéance 2026-12-15, today=2026-12-08, statut=`payee` → **aucun banner**
   - Échéance 2026-12-15, today=2026-12-08, statut=`exoneree_premiere_annee` → **aucun banner**
   - Échéance 2026-12-15, today=2026-11-15, statut=`exoneree_commune` → **aucun banner**
   - Échéance 2026-12-15, today=2026-09-01, statut=`non_deposee` → **aucun banner** (J-100, hors J-30)

**Total BDD Phase 6 : 37 scénarios sur 7 features.** Cohérent avec Phase 5 (50+ scénarios sur 11 features). Sampling Nyquist : `pnpm test:bdd --tags "@phase6"` à chaque merge de wave.

### Wave 0 Gaps

- [ ] `tests/_builders/fiscalite.ts` — étendre avec `declarationCfeBuilder()` + `mappingLiasse2026Builder()` (fixtures pour les BDD steps).
- [ ] `tests/bdd/step_definitions/brouillon-liasse.steps.ts` — créer (partagé entre 5 features liasse).
- [ ] `tests/bdd/step_definitions/cfe.steps.ts` — créer (partagé entre 2 features CFE).
- [ ] `tests/integration/repositories/declaration-cfe-repository-sqlite.test.ts` — créer (round-trip 3 cas : tous statuts + Temporal + Money null/non-null).
- [ ] Aucune installation framework : Vitest + Cucumber + fast-check déjà en place depuis Phase 1.

---

## Security Domain

> `security_enforcement` n'est pas explicitement configuré dans `.planning/config.json` → traité comme **enabled** (défaut).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | non | Single-user local-first (CLAUDE.md DV-01). Aucun login Phase 6. |
| V3 Session Management | partiellement (CSRF) | `@fastify/session` + `@fastify/csrf-protection` déjà câblés Phase 1 (POST `/biens/:id/cfe`). |
| V4 Access Control | non | Single-user. Aucune autorisation à vérifier. |
| **V5 Input Validation** | **OUI** | **Zod** aux frontières HTTP (`web/schemas/cfe-schemas.ts`). Invariants domain via `InvariantViolated`. |
| V6 Cryptography | non | Aucun secret manipulé Phase 6. `crypto.randomUUID()` (Node 22 natif) pour `DeclarationCfeId`. |
| V7 Error Handling | OUI | Erreurs typées (`MappingLiasseAbsent`, `DeclarationCfeIntrouvable`) — jamais de stack trace exposée au client. Page d'erreur dédiée 404/422 réutilise `erreur.ejs`. |
| V8 Data Protection | OUI partiellement | `montantAvisCentimes` = donnée financière → `Money` BigInt + stockage SQLite local + rétention 10 ans (DOC-03 cadre Phase 4). |
| V9 Communication | hors scope | App local-only. Le seul lien externe est `https://www.impots.gouv.fr` (rel="noopener noreferrer" obligatoire — UI-SPEC §S9, §S10). |
| V10 Configuration | OUI | `dependency-cruiser` interdit imports infra dans domaine (déjà 0 violation Phase 5.1). |
| **V12 Files & Resources** | OUI partiellement | **Path-traversal Content-Disposition** : `contentDispositionFilename()` existant déjà sanitize (RFC 6266). Le PDF/CSV brouillon liasse réutilise ce helper. |
| V13 API & Web Service | OUI | **CSRF** sur `POST /biens/:id/cfe` (déjà câblé `@fastify/csrf-protection`). Pas de JSON API exposée (vue HTML rendue serveur). |

### Known Threat Patterns for Phase 6 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **CSV injection** (formules malveillantes via libellé/sources dans CSV brouillon liasse) | Tampering | `Money.enEuros()` (Intl.NumberFormat) ne produit pas `=/@/+/-`. Pour les libellés/sources string : préfixer par `'` si commence par caractère dangereux, OU encapsuler entre guillemets doubles. Pattern existant Phase 5 T-05-07-04. **Action research** : étendre la mitigation à la colonne "sources" du CSV brouillon liasse (peut contenir des libellés de Justificatif arbitraires saisis par l'utilisateur). |
| **Path-traversal Content-Disposition** | Tampering | `contentDispositionFilename()` existant sanitize via `encodeURIComponent` (RFC 6266). Réutiliser tel quel. |
| **XSS dans libellé CFE / motif rectificatif** | Tampering | EJS auto-escape `<%= ... %>`. NE PAS utiliser `<%- ... %>` pour les champs utilisateur. |
| **Injection SQL via params route** | Tampering | Kysely query builder + Zod params → pas de concat string. |
| **CSRF sur POST formulaire CFE** | Spoofing | `@fastify/csrf-protection` déjà câblé Phase 1. Token CSRF sur `POST /biens/:id/cfe`. |
| **Fail-open mapping liasse absent** | Information disclosure / Tampering | Fail-fast obligatoire `MappingLiasseAbsent` (D-L6.3) — JAMAIS de defaulting silencieux à un mapping voisin. |
| **Fuite snapshot via réconciliation** | Information disclosure | Le bandeau de réconciliation expose `nbPiecesModifiees` (count, pas contenu). Le drill-down `<details>` montre des URLs vers ressources internes (single-user, pas de risque). |
| **Open redirect via lien externe impots.gouv.fr** | Spoofing | Liens `target="_blank" rel="noopener noreferrer"` obligatoires (déjà en patron UI-SPEC §S9, §S10). |
| **Compromission silencieuse du mapping `mapping-liasse-2026.ts`** | Tampering | Code-review humain obligatoire chaque rédaction (R1.1 RISKS.md). Le test BDD `mapping-liasse-versionne.feature` valide la couverture. |

**Action security planning** : pas de nouveau threat majeur Phase 6 par rapport à Phase 5. Les patterns sont déjà couverts. Le seul point neuf à valider : la **colonne "sources" du CSV** peut contenir des libellés de `Justificatif` arbitraires (utilisateur saisit librement le libellé d'un justificatif Phase 4) — ces libellés doivent passer par la mitigation CSV injection (préfixe `'` si caractère dangereux).

---

## Vertical Slices Suggested (MVP)

> Découpe en **5 plans de 2-5 tâches max** chacun. Chaque slice livre une fonctionnalité bout-en-bout testable. Ordre des waves respecte les dépendances DDD et les patterns Phase 5.

### Plan 06-01 — Walking enabler liasse + CFE (foundations, wave 1, 4 tâches)

**Goal:** Poser les fondations transverses Phase 6 sans surface utilisateur visible. Pattern miroir Plan 05-01.

- **Task 1** : Migration `0023_phase6_declaration_cfe.sql` + extension `kysely-types.ts` (interface `DeclarationsCfeTable`) + brand type `DeclarationCfeId` + `nouveauDeclarationCfeId()` dans `_shared/identifiants.ts`.
- **Task 2** : Domaine `mapping-liasse-2026.ts` (data versionnée 2026 — avec codes cases validés sur PDF officiel impots.gouv.fr en début de tâche) + types `CaseLiasseDto` + `MappingLiasse2026` interface + `mapping-liasse-provider.ts` (port `MappingLiasseProvider` + impl en mémoire `MappingLiasseProviderEnMemoire` couvrant uniquement 2026) + erreurs `MappingLiasseAbsent`, `DeclarationCfeIntrouvable` dans `liasse/erreurs.ts`. **TDD** rouge → vert sur `mapping-liasse-provider.test.ts` + `mapping-liasse-versionne.feature` (3 scénarios).
- **Task 3** : Domaine `declaration-cfe.ts` (agrégat racine, factory `creer()`, `modifier()` copy-on-write, invariants `InvariantViolated`) + `statut-cfe.ts` (type union) + tests unit `declaration-cfe.test.ts` (TDD rouge → vert sur 12+ cas, dont les 5 statuts + invariants).
- **Task 4** : Domaine `reconciliation.ts` (fonction pure `reconcilier`) + tests unit `reconciliation.test.ts` avec propriétés fast-check (réconciliation symétrique + identité + cohérence sur snapshots identiques).

**Surface utilisateur** : aucune (walking enabler) — la sidebar reste inchangée.
**REQs partiellement couverts** : FIS-05 fondations + FIS-06 fondations.

### Plan 06-02 — Vertical slice CFE complet (FIS-06, wave 2, 5 tâches)

**Goal:** Livrer FIS-06 end-to-end : formulaire CFE + persistance + banner J-30 + page index.

- **Task 1** : Infrastructure `declaration-cfe-repository-sqlite.ts` adapter (versDomaine/versRow, méthodes `enregistrer`, `trouverParId`, `listerParBien(bienId)`, `listerToutesAvecAlerte()`) + tests intégration round-trip 5 statuts + Money null/non-null + Temporal ISO 8601.
- **Task 2** : Application use cases `enregistrer-declaration-cfe.ts` + `modifier-declaration-cfe.ts` + `lister-declarations-cfe-avec-alerte.ts` + helper `joursAvantEcheance` + tests unit `jours-avant-echeance.test.ts` (propriété monotone fast-check).
- **Task 3** : Web schemas Zod `cfe-schemas.ts` + routes `GET/POST /biens/:id/cfe/nouvelle` + `GET/POST /biens/:id/cfe/:idDeclaration/editer` + vues EJS `nouvelle.ejs`, `editer.ejs` + partials S8/S9 (`partial-carte-cfe.ejs`, `partial-badge-statut-cfe.ejs`, `partial-aide-cfe.ejs`).
- **Task 4** : Partial `partial-bandeau-cfe-echeance.ejs` (banner J-30 — clone de `partial-indexation-banner.ejs`) + intégration sur fiche `Bien` `/biens/:id` (en haut de section CFE) + helpers EJS `formaterStatutCfe`, `formaterMillesimeCfe`.
- **Task 5** : BDD scénarios `cfe-suivi-declaratif.feature` (6 scénarios) + `cfe-alerte-echeance.feature` (8 scénarios ClockFixe) + step definitions `cfe.steps.ts`. Mise à jour `main.ts` (DI `DeclarationCfeRepositorySqlite`).

**Surface utilisateur** : fiche `Bien` section CFE + formulaire création/édition + banner J-30 contextuel.
**REQ couvert** : FIS-06 complet.

### Plan 06-03 — Vertical slice brouillon liasse régime réel (FIS-05 partie 1, wave 3, 5 tâches)

**Goal:** Livrer le brouillon liasse régime réel (2031-SD + 2033-A/B/C/D) en vue HTML + drill-down sources + bandeau réconciliation.

- **Task 1** : Domaine `case-liasse.ts` (types DTO : `CaseLiasseDto = { numero, libelleOfficiel, valeur, sources? }`, `SectionLiasseDto`, `BrouillonLiasseDto`) + remplir le fichier `mapping-liasse-2026.ts` avec TOUTES les cases 2031-SD + 2033-A/B/C/D (validés sur PDF officiel — voir Open Questions Q1).
- **Task 2** : Application use case `generer-brouillon-liasse.ts` orchestrateur — charge snapshot, résout mapping, agrège sources vivantes (RecettesRepository + ChargesRepository + TableauAmortissementRepository), appelle `reconcilier()`, produit `BrouillonLiasseDto`. **TDD** outside-in : `brouillon-liasse-reel.feature` rouge → unit `generer-brouillon-liasse.test.ts` rouge/vert → feature vert.
- **Task 3** : Web route `GET /fiscalite/declarations/:id/liasse` + vue `brouillon-liasse.ejs` + partials `partial-bandeau-brouillon-liasse.ejs` (S1) + `partial-bandeau-reconciliation.ejs` (S5) + `partial-tableau-liasse-section.ejs` (S2) + `partial-drill-down-sources.ejs` (S4) + helper `formaterCaseLiasse`.
- **Task 4** : BDD scénarios `brouillon-liasse-reel.feature` (6 scénarios) + `liasse-tracabilite.feature` (7 scénarios) + step definitions `brouillon-liasse.steps.ts`. Test intégration sur snapshot Phase 5 réel (charges + recettes + amortissement).
- **Task 5** : Page index `/fiscalite` étendue (S11 UI-SPEC) avec nouveau bloc "Brouillons de liasse" + état vide (`empty-state.ejs` réutilisé). Mise à jour `main.ts` DI `MappingLiasseProviderEnMemoire`.

**Surface utilisateur** : vue HTML `/fiscalite/declarations/:id/liasse` consultée pendant saisie impots.gouv.fr.
**REQ couvert** : FIS-05 partie 1 (régime réel HTML + traçabilité + réconciliation).

### Plan 06-04 — Brouillon liasse micro-BIC + liasse rectificative (FIS-05 partie 2, wave 4, 3 tâches)

**Goal:** Étendre le brouillon liasse au micro-BIC (2042 C PRO) + dériver la liasse rectificative depuis `DeclarationCorrigee`.

- **Task 1** : Étendre `mapping-liasse-2026.ts` avec section 2042 C PRO (case `5NI` longue durée — validée Open Questions Q2). Étendre `generer-brouillon-liasse.ts` : si `decl.regimeApplique === 'micro_bic'`, retourne `BrouillonLiasseDto` minimaliste (1-2 cases). Tests unit étendus.
- **Task 2** : Étendre `generer-brouillon-liasse.ts` pour accepter `DeclarationCorrigeeId` en plus de `DeclarationAnnuelleId`. Si `DeclarationCorrigee` → retourner `BrouillonLiasseDto` avec champ `rectificative: { motif, urlOriginale }`. Vue EJS conditionne le bandeau `partial-bandeau-rectificative.ejs` (S6) sur ce champ.
- **Task 3** : BDD scénarios `brouillon-liasse-micro.feature` (3 scénarios) + `liasse-rectificative.feature` (4 scénarios). Test régression : la `DeclarationAnnuelle` originale reste lisible et le brouillon "original" reste consultable post-création de la corrigée.

**Surface utilisateur** : vue HTML brouillon liasse étendue pour micro + rectificative.
**REQ couvert** : FIS-05 partie 2.

### Plan 06-05 — Exports PDF + CSV brouillon liasse + UI polish + a11y (FIS-05 partie 3, wave 5, 4 tâches)

**Goal:** Compléter FIS-05 avec exports PDF (archivage) et CSV (expert-comptable, colonne sources), polish a11y, audit final.

- **Task 1** : Domaine port `brouillon-liasse-builder.ts` (interface retournant `unknown`) + infra `brouillon-liasse-doc-def.ts` (fonction pure pdfmake construisant la `TDocumentDefinitions` à partir de `BrouillonLiasseDto`) + adapter `brouillon-liasse-builder-pdfmake.ts` (pattern miroir Plan 05-11). DI dans `main.ts`. Tests intégration export PDF (magic bytes `%PDF` + taille > 1000 + nomFichier `brouillon-liasse-{exercice}.pdf`).
- **Task 2** : Application use cases `exporter-pdf-brouillon-liasse.ts` + `exporter-csv-brouillon-liasse.ts` (UTF-8 BOM + séparateur `;` + colonne `sources` avec IDs séparés par `|` + mitigation CSV injection sur libellés utilisateurs). Routes `GET /fiscalite/declarations/:id/liasse.pdf` + `.../liasse.csv` (réutiliser `contentDispositionFilename()`).
- **Task 3** : UI polish + a11y WCAG 2.1 AA selon contrat UI-SPEC §Accessibilité (10 sélecteurs ARIA imposés + tableau case-par-case avec `<caption>` sr-only + `<th scope="col">` + touch target 44px + focus order). Audit Lighthouse sur 3 pages (brouillon liasse, fiche CFE, formulaire CFE).
- **Task 4** : Tests E2E sur le parcours complet : clôture exercice Phase 5 → consulter brouillon liasse → drill-down sources → export PDF/CSV → soft-delete encaissement post-clôture → re-consulter brouillon → bandeau réconciliation affiché. Checkpoint humain (`/gsd-verify-work`).

**Surface utilisateur** : exports PDF + CSV + UI raffinée + a11y validée.
**REQ couvert** : FIS-05 complet.

---

**Total Phase 6** : **5 plans / 21 tâches**. Cohérent avec la granularité Phase 5 (8 plans, ~24 tâches). Couverture BDD attendue : **37 scénarios sur 7 features**.

**Vagues d'exécution** :
1. Wave 1 — Plan 06-01 (foundations transverses)
2. Wave 2 — Plan 06-02 (CFE complet, indépendant de la liasse)
3. Wave 3 — Plan 06-03 (brouillon liasse régime réel — dépend de 06-01)
4. Wave 4 — Plan 06-04 (micro + rectificative — dépend de 06-03)
5. Wave 5 — Plan 06-05 (exports + UI polish — dépend de 06-03/04)

**Indépendance partielle** : 06-02 (CFE) et 06-03 (liasse réel) peuvent être exécutés en parallèle après 06-01 si `workflow.parallelization=true` (config dit `true`). Mais la cohérence UI (page `/fiscalite` étendue, sidebar) suggère de garder un ordre séquentiel pour réduire les conflits de merge.

---

## Open Questions

1. **Numéros de cases cerfa exacts 2026 — codes lettres vs numéros de lignes**

   - **What we know** : sources externes divergent. Codes lettres (`AB`, `CB`, `5NI`, `5NA`, `5NY`, `FA`, `FC`, `FK`, `FY`) ET numéros de lignes (`210`, `218`, `254`, `270`, `310`, `372`) coexistent — le cerfa officiel utilise les DEUX (codes lettres dans les cases, numéros de lignes dans la marge gauche). [CITED: lmnp.ai, lmnp-facile.fr, compta-online.com]
   - **What's unclear** : quel code privilégier dans la colonne "Case" de la vue HTML utilisateur ? Les utilisateurs cherchent typiquement les codes lettres sur impots.gouv.fr (interface de saisie). Les expert-comptables et formulaires papier privilégient les numéros de lignes.
   - **Recommendation** : **stocker LES DEUX** dans `CaseLiasseDto = { numero: string, codeOfficiel: string, ligne: number | null, libelleOfficiel: string, ... }`. Afficher le `codeOfficiel` (ex. `5NI`, `CB`) en monospace dans la colonne "Case" (cf. UI-SPEC §Typography), avec tooltip qui affiche le numéro de ligne en cas de doute. **Action planning Task 06-03 Task 1** : ouvrir le PDF officiel impots.gouv.fr et confirmer code-par-code avec validation utilisateur sur 3-4 codes critiques (`AB`, `CB`/`CC`, `5NI`, ligne 218, ligne 254).

2. **Cas micro-BIC 2042 C PRO : confirmer la case `5NI` pour location meublée longue durée 2026**

   - **What we know** : la réforme Loi Le Meur 2024 a séparé tourisme classé / tourisme non classé / longue durée. Les cases `5ND/5OD/5PD` sont supprimées en 2026 (déclaration sur revenus 2025). Pour location meublée longue durée → **`5NI/5OI/5PI`**. [CITED: rendimmo.fr/case-5nd-supprimee-2026]
   - **What's unclear** : confirmation sur le cerfa officiel 2026 (déclaration revenus 2025) que c'est bien la case `5NI`. Aucun PDF officiel impots.gouv.fr ne pouvait être lu directement dans cette session (PDF binaire non parsable).
   - **Recommendation** : **Action planning Task 06-04 Task 1** : valider sur le PDF officiel 2042 C PRO millésime 2026 — disponible probablement sur `https://www.impots.gouv.fr/formulaire/2042-c-pro` (téléchargement direct PDF impossible cette session, à faire en validation humaine au moment du planning). V1 cible uniquement la location meublée longue durée (CLAUDE.md), donc une seule case micro-BIC à mapper.

3. **Charges 2033-B : ventilation fine entre lignes 242 (autres charges externes) et 252 (impôts/taxes)**

   - **What we know** : `entretien_reparation` → ligne 242 clairement. `amelioration` → 2033-C jamais 2033-B. Mais `charge_courante_periodique` (taxe foncière, CFE, intérêts emprunt, assurance, frais EC, syndic) → mélange ligne 242 + ligne 252 selon nature.
   - **What's unclear** : Phase 5 stocke `chargesQualifieesParCategorie: Record<QualificationFiscale, Money>` avec 4 catégories agrégées — la sous-ventilation TF/CFE/assurance n'est pas matérialisée dans le snapshot. Pour ventiler ligne 242 vs ligne 252, il faudrait re-requêter les sources vivantes au moment de la génération du brouillon.
   - **Recommendation** : **V1 simplifié** : Phase 6 met TOUT `charge_courante_periodique` sur ligne 242 (autres charges externes), avec note pédagogique "L'utilisateur peut affiner cette ventilation directement sur impots.gouv.fr." OU **V1.1** : ajouter sous-ventilation dans le snapshot Phase 5 (extension D-FIS-G2.2 — couteux). **Recommandation forte** : V1 simplifié, conforme à l'objectif "brouillon" et à l'autonomie utilisateur (R4.3). À valider en planning.

4. **Réconciliation : tolérance et périmètre exact**

   - **What we know** : D-T6.4 demande de détecter et signaler les écarts. Money BigInt centimes → comparaison exacte (egale). Périmètre suggéré : recettes annuelles + Σ charges déductibles + dotation d'amortissement.
   - **What's unclear** : qu'est-ce qui se passe si l'écart est de 1 centime (round trip Money) ou de plusieurs millions (encaissement annulé) ? Faut-il aussi réconcilier les composants (sortie de composant post-clôture) ?
   - **Recommendation** : **V1 tolérance = 0** (strict, Money centimes exact). Périmètre = (recettes_totales, charges_par_catégorie, dotation_amortissement). Si un composant est sorti post-clôture, on ne le voit pas dans la réconciliation V1 (acceptable car la composition est dans le `composantsSnapshot` JSON Phase 5). À valider en planning + à itérer en V1.1 si feedback utilisateur indique des faux positifs/négatifs.

5. **`dateEcheancePaiement` : valeur par défaut suggérée ?**

   - **What we know** : la date d'échéance CFE est typiquement le **15 décembre** N pour exercice N (avis communal envoyé en octobre/novembre).
   - **What's unclear** : faut-il pré-remplir le champ `dateEcheancePaiement` à `{millesime}-12-15` dans le formulaire ? Ou laisser l'utilisateur saisir librement ?
   - **Recommendation** : **Pré-remplir à `{millesime}-12-15`** côté serveur Phase 6 mais permettre la modification libre (R4.3 pédagogie + autonomie). Note d'aide : "Date généralement le 15 décembre, mais peut varier selon la commune". À valider en planning Task 06-02 Task 3.

6. **Tableau historique 2033-D : combien d'années en arrière ?**

   - **What we know** : D-A6.4 mentionne "tableau historique compact (année | généré | consommé | cumul)". Phase 5 produit des lignes `AmortissementExercice[type='SYNTHESE_BIEN']` à chaque clôture (cumul ARD CGI 39 B sans limite).
   - **What's unclear** : afficher TOUTES les années depuis l'activation du bien ? Ou tronquer à N-5 / N-10 ?
   - **Recommendation** : **Toutes les années disponibles** (V1 simple). Pagination visuelle si > 15 lignes (CSS scroll). À valider en planning.

7. **Brouillon CSV : séparateur de la colonne "sources" multi-valeurs**

   - **What we know** : sources par case peuvent être multiples (recettes = N encaissements, charges = N justificatifs). UTF-8 BOM + séparateur `;` (français).
   - **What's unclear** : à l'intérieur d'une cellule "sources", comment séparer les N IDs ? Virgule `,` (peut faire problème dans Excel français) ? Pipe `|` ? Espace ?
   - **Recommendation** : **Pipe `|`** (cohérent avec mitigation CSV injection, jamais préfixe formule). Note dans la doc Phase 6 : "La colonne sources liste les IDs séparés par `|`." À valider en planning Task 06-05 Task 2.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Le mapping `mapping-liasse-2026.ts` couvre uniquement le millésime 2026 (révision annuelle vs triennale fiscale) | Pattern 1 + Pitfall 6 | Si la révision est en réalité triennale, on perd l'opportunité de couvrir 2027 sans effort. → Vérifier avec le planning + utilisateur ; pas bloquant pour 06-01. |
| A2 | La case `AB` du 2031-SD = production vendue (services) = loyers encaissés en LMNP réel | Cerfa Case Mapping > 2031-SD | Si le code est différent (ex. `BC` ou ligne 218 plutôt qu'`AB`), l'utilisateur reportera la valeur sur une mauvaise case → erreur déclarative. Mitigation : validation visuelle PDF officiel Task 06-03 Task 1. |
| A3 | Le code `CB` (et non `CA` ou `1GF`) correspond au bénéfice fiscal sur 2031-SD ligne 10 | Cerfa Case Mapping > 2031-SD | Idem A2. Mitigation : validation PDF + test BDD invariant flux 2033-B → 2031-SD. |
| A4 | La case `5NI` (et non `5ND`) correspond au report micro-BIC longue durée 2026 | Cerfa Case Mapping > 2042 C PRO + Open Question Q2 | Mitigation déjà capturée Q2 — validation PDF officiel impots.gouv.fr millésime 2026. [CITED: rendimmo.fr] |
| A5 | `dateEcheancePaiement` est typiquement `{millesime}-12-15` mais varie selon commune | Open Question Q5 | Mitigation : champ libre saisi par utilisateur + pré-remplissage soft. |
| A6 | Tolérance réconciliation = 0 strict en Money centimes (pas d'erreur d'arrondi cross-aggregation) | Pattern 5 + Open Question Q4 | Si V1 montre faux positifs, on relâche à ±1 centime en V1.1. Pas bloquant V1. |
| A7 | Le LMNP non pro déficitaire peut reporter le déficit 10 ans (et non 6 ans) sur revenus locatifs meublés futurs | Cerfa Case Mapping > 2033-D | [CITED: lmnp.ai] — précision V1 ; valider avec utilisateur. Implications V1.1 (sortie de plus-value, suivi déficit reportable). |
| A8 | L'app V1 cible UNIQUEMENT la location meublée longue durée (bail classique/étudiant/mobilité) — pas le tourisme | Cerfa Case Mapping > 2042 C PRO | [VERIFIED: CLAUDE.md ligne 12-14 "V1 = LMNP en location meublée longue durée"]. Confirmé. |
| A9 | Phase 5.1 hardening est complet et `src/application/fiscalite/` n'importe aucune implémentation infra (sauf type-only Kysely) | Reusable Assets + Stack | [VERIFIED: STATE.md "5.1 complete — 0 résultats grep"] + 05-11-SUMMARY.md. Confirmé. |
| A10 | La table SQL `declarations_cfe` peut être créée en migration `0023_phase6_declaration_cfe.sql` (Phase 5 s'arrête à `0022_phase5_ticket_qualifie_le.sql`) | Project Structure | [VERIFIED: ls migrations/ — dernière migration est `0022_phase5_ticket_qualifie_le.sql`]. Confirmé. |
| A11 | `crypto.randomUUID()` est disponible natif Node 22 sans polyfill | Pattern 3 | [VERIFIED: package.json engines.node = ">=22.0.0"]. Confirmé. |
| A12 | Le pattern Phase 3 D-90 banner IRL utilise déjà `partial-indexation-banner.ejs` avec render conditionnel côté serveur (pas de JS client) | Pattern 4 | [VERIFIED: src/web/views/partials/partial-indexation-banner.ejs lu + grep usage]. Confirmé. |

---

## Sources

### Primary (HIGH confidence)

- **Codebase analysis** (lecture directe — HIGH) :
  - `src/domain/fiscalite/declaration-annuelle.ts`, `declaration-corrigee.ts`, `amortissement-exercice.ts`, `qualification-fiscale.ts`, `recap-fiscal-builder.ts` (snapshots Phase 5 sources des valeurs de cases)
  - `src/domain/fiscalite/regles/regle-fiscale-provider.ts`, `regles-2026.ts` (pattern exact à cloner pour `MappingLiasseProvider`)
  - `src/domain/_shared/{money,clock,erreurs,identifiants}.ts` (briques shared, à étendre)
  - `src/application/fiscalite/exporter-csv-fiscal.ts`, `exporter-pdf-recap.ts` (patterns use case)
  - `src/web/routes/fiscalite/exports.ts` (pattern route + `contentDispositionFilename`)
  - `src/web/views/partials/partial-indexation-banner.ejs` (pattern D-90 banner J-30 réutilisable)
  - `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts`, `pdf-renderer-pdfmake.ts` (pattern adapter)
  - `migrations/0014→0022` (séquence migrations Phase 5)
  - `package.json` (versions vérifiées)
- **Planning artefacts Phase 5** (HIGH) :
  - `.planning/phases/05-.../05-CONTEXT.md` (D-FIS-G* + anti-patterns Phase 5)
  - `.planning/phases/05-.../05-01-SUMMARY.md` (pattern walking enabler)
  - `.planning/phases/05-.../05-06-SUMMARY.md` (pattern clôture + ARD cross-exercice)
  - `.planning/phases/05-.../05-11-gap-recap-fiscal-port-hexa-SUMMARY.md` (pattern hexagonal port `unknown`)
- **Planning artefacts Phase 6** (HIGH — source des décisions verrouillées) :
  - `.planning/phases/06-liasse-2031-cfe/06-CONTEXT.md` (19 décisions G1-G4)
  - `.planning/phases/06-liasse-2031-cfe/06-UI-SPEC.md` (contrat UI complet — 11 surfaces S1-S11)
  - `.planning/phases/06-liasse-2031-cfe/06-DISCUSSION-LOG.md` (audit trail des alternatives écartées)
- **Documents projet** (HIGH) :
  - `CLAUDE.md` (V1 LMNP, hexagonal strict, ubiquitous language fr)
  - `LMNP.md` (§7 CFE — CGI art. 1447 + 1478)
  - `.planning/REQUIREMENTS.md` (FIS-05, FIS-06)
  - `.planning/ROADMAP.md` (Phase 6 dépend Phase 5)
  - `practices/BDD_PRACTICES.md` (§7 couverture 100 % fiscale)
  - `practices/DDD.md` (ports & adapters strict)
- **Sources juridiques cadre** (HIGH — citées textuellement dans LMNP.md + REGLES_2026 :
  - CGI art. 39, 39 B, 50-0, 155 IV, 156 I 1° bis, 1447 et s., 1477 III, **1478 II**, 1478 bis
  - BOFIP-BIC-AMT-20-40 (composants amortissables)
  - BOFIP-BIC-DECLA-10-30 (option régime réel 1 an renouvelable)
  - BOFIP-BIC-DECLA-30-30 (comptabilité d'encaissement micro-BIC)
  - BOFIP-BIC-DECLA-30-40-20 (tolérance encaissement réel LMNP non pro)
  - BOFIP-IF-CFE-20-50-10 (annualité CFE + création d'établissement)
  - LF 2025 art. 84 (loi 2025-127 du 14/02/2025) — réintégration amortissements gros œuvre PV (V1.1 SIM-02)
  - LF 2025 art. 11 — abrogation OGA art. 199 quater B + 1649 quater C à O

### Secondary (MEDIUM confidence — sources externes croisées sur 2 minimum)

- `https://www.impots.gouv.fr/formulaire/2031-sd/impot-sur-le-revenu` (page officielle 2031-SD)
- `https://www.impots.gouv.fr/formulaire/2033-sd/liasse-bicsi-regime-rsi-tableaux-ndeg-2033-sd-2033-g-sd` (liasse 2033 complète)
- `https://www.impots.gouv.fr/formulaire/1447-c-sd/declaration-initiale-de-cotisation-fonciere-des-entreprises` (1447-C-SD)
- `https://www.impots.gouv.fr/formulaire/2042-c-pro` (2042 C PRO)
- `https://www.impots.gouv.fr/sites/default/files/formulaires/2031-sd/2026/2031-sd_5396.pdf` (PDF officiel 2031-SD millésime 2026 — non parsable cette session)
- `https://bofip.impots.gouv.fr/bofip/1291-PGP.html/identifiant=BOI-IF-CFE-20-50-10-20211222` (BOFIP CFE exonération première année)
- `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051202382` (CGI art. 1478 Légifrance)
- `https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000042913353` (CGI art. 1478 bis Légifrance)
- `https://entreprendre.service-public.gouv.fr/vosdroits/R17761` (déclaration initiale 1447-C-SD — service public)
- [`lmnp.ai/liasse-fiscale-lmnp`](https://lmnp.ai/liasse-fiscale-lmnp) — guide LMNP avec codes lettres
- [`lmnp-facile.fr/guides/formulaire-2031-lmnp`](https://lmnp-facile.fr/guides/formulaire-2031-lmnp) — cases 2031 LMNP
- [`lmnp-facile.fr/guides/cases-declaration-lmnp-2042-c-pro`](https://lmnp-facile.fr/guides/cases-declaration-lmnp-2042-c-pro) — cases 2042 C PRO
- [`rendimmo.fr/case-5nd-supprimee-2026`](https://rendimmo.fr/case-5nd-supprimee-2026/) — changement micro-BIC 2026
- [`compta-online.com`](https://www.compta-online.com/le-compte-de-resultat-les-tableaux-2052-et-2053-ou-2033-ao1178) — codes 2033-B

### Tertiary (LOW confidence — sources isolées, à valider)

- [`jedeclaremonmeuble.com/cerfa-2031-lmnp`](https://www.jedeclaremonmeuble.com/cerfa-2031-lmnp/) — guide général sans codes exacts
- [`indy.fr/guide/fiscalite/declarations/formulaire-2033/`](https://www.indy.fr/guide/fiscalite/declarations/formulaire-2033/) — lignes 210/218/254
- [`lscompta.fr/blog/formulaire-2033/`](https://www.lscompta.fr/blog/formulaire-2033/) — description générale
- [`locaeo.com/blog/liasse-fiscale-lmnp`](https://www.locaeo.com/blog/liasse-fiscale-lmnp) — lignes 218/254/310/372

---

## Metadata

**Confidence breakdown:**

- **Standard stack** : HIGH — toutes versions et patterns vérifiés via `package.json` + lecture directe codebase Phase 5.
- **Architecture / patterns** : HIGH — patterns Phase 5 (RegleFiscaleProvider, RecapFiscalBuilder, hexagonal Plan 05-11) prouvés à 888/888 tests verts + 0 violation depcruise.
- **Cerfa case mapping** : MEDIUM — sources externes croisées (2-3 par code), mais validation visuelle PDF officiel impots.gouv.fr requise lors du planning Task 06-03 Task 1. Open Questions Q1-Q3 capturent les ambiguïtés résiduelles.
- **Sources juridiques cadre** : HIGH — citations CGI / BOFIP / LF vérifiées dans `LMNP.md` + recherches externes Légifrance.
- **CFE pattern (banner J-30 + agrégat léger)** : HIGH — pattern Phase 3 D-90 IRL banner existant et réutilisable tel quel.
- **Common pitfalls** : HIGH — 7 anti-patterns Phase 5 + 7 nouveaux Phase 6 issus de la lecture directe de `05-CONTEXT.md` anti-patterns + UI-SPEC critique.
- **Validation architecture / BDD** : HIGH — 37 scénarios mappés sur 7 features + propriétés fast-check, cohérent avec couverture Phase 5 (50+ scénarios sur 11 features).

**Research date:** 2026-06-02
**Valid until:** Phase 6 planning + execution (estimation ~30 jours pour une phase MVP standard, cohérent avec Phase 5 durée 12 jours du 2026-05-10 au 2026-05-22). Au-delà, revérifier sources juridiques (LF 2027 possible).

---

## RESEARCH COMPLETE

**Phase 6 livrable comme cloning systématique du pattern Phase 5 (`RegleFiscaleProvider` + `RecapFiscalBuilder` + hexagonal Plan 05-11) appliqué au mapping case-par-case des cerfa 2031-SD/2033-A-D/2042 C PRO + ajout d'un agrégat léger `DeclarationCfe` avec banner J-30 (pattern Phase 3 D-90) — découpé en 5 plans de 2-5 tâches, couverture BDD 100 % fiscale via 37 scénarios sur 7 features, avec 7 Open Questions à trancher au planning (principalement validation visuelle des codes cerfa sur PDF officiel impots.gouv.fr).**
