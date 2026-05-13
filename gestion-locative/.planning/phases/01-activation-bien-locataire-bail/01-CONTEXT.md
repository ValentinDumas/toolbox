# Phase 1: Activation — Bien, Locataire, Bail - Context

**Gathered:** 2026-05-13
**Status:** Ready for planning

<domain>
## Phase Boundary

L'utilisateur peut créer en une session unique un dossier locatif complet (`Bien` avec ses `Lot`s + `Locataire` + `Bail` meublé classique) persisté localement (SQLite), et le voir dans une liste — **sans aucune logique fiscale, sans diagnostics, sans état des lieux, sans indexation IRL active**.

**REQs couverts (4)** : PAT-01 (CRUD `Bien`), PAT-02 (`Lot`s), LOC-01 (`Locataire`), LOC-02 (`Bail` meublé classique).

**KPI Activation** : un utilisateur ouvrant l'app pour la première fois peut, en une session unique, aboutir à 1 `Bien` + 1 `Locataire` + 1 `Bail` visibles dans une liste persistée.

**Strictement hors périmètre Phase 1** (rappels — ne pas attraper en scope creep) :
- Diagnostics (DPE / gaz / élec / ERP) → Phase 3
- État des lieux contradictoire + inventaire mobilier → Phase 3
- Indexation IRL active + gel DPE F/G → Phase 3
- Checklist mobilier décret 2015-981 → Phase 3
- Quittancement, encaissements, relances → Phase 2
- Coffre documentaire et rétention 10 ans → Phase 4
- Tickets travaux → Phase 4
- Toute fiscalité (amortissement, micro-BIC, liasse 2031, CFE, plus-value) → Phase 5/6
- Dashboard et notifications → Phase 7
- PDF du bail → Phase 1.5 (nouvelle phase à créer dans la ROADMAP)

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (PROJECT.md / ROADMAP.md — non rediscutées)

- **DV-01** : LMNP location meublée longue durée uniquement (bail classique V1, bail étudiant/mobilité reportés V2).
- **DV-02** : Local-first, mono-user, **SQLite**.
- **DV-03** : **DDD hexagonal strict** — domaine pur, ports & adapters, aucun import technique dans `domain/`.
- **DV-04** : **Ubiquitous language français** dans le code (`Bail`, `Quittance`, `Locataire`, `Bailleur`, `IRL`, `ARD`, `CFE`, `BIC`, `DPE`, `LMNP`, `LMP`…), jamais traduit en anglais.
- **DV-05** : **BDD outside-in** (scénario rouge → TDD interne vert → scénario vert), 100 % couverture sur la logique fiscale, tests déterministes (port `Clock`).
- **DV-06** : Mode `mvp` vertical slice — domaine + adapters + UI livrés ensemble (pas de phase "tech" séparée).
- **DV-07** : 6 bounded contexts (Patrimoine, Locatif, Encaissements, Comptabilité, Fiscalité, Documents) — Phase 1 ne touche que Patrimoine et Locatif.

### Forme de l'application & OS cible

- **D-01** : Forme principale = **web local** (serveur localhost + navigateur).
- **D-02** : Multi-OS = **macOS / Windows / Linux** dès V1.
- **D-03** : Rendu UI = **SSR pur** (HTML server-rendered, EJS partials = composants modulaires réutilisables). React/SPA/HTMX explicitement écartés (sur-équipement pour CRUD admin sobre, viole audit-friendly).
- **D-04** : Lancement quotidien V1 = **commande terminal explicite** (`pnpm start` → `tsx src/main.ts serve`). Packaging app installée double-clic reporté V1.1+.
- **D-05** : Emplacement DB = **OS-conventional path** (`~/Library/Application Support/gestion-locative/`, `%APPDATA%/gestion-locative/`, `~/.local/share/gestion-locative/`). Chemin affiché au premier lancement. Backup = copie manuelle du `.sqlite`.
- **D-06** : Binding réseau = **127.0.0.1 uniquement** (loopback). Pas d'auth requise (mono-user + machine-only).
- **D-07** : Lifecycle = **port fixe + détection « déjà lancé »** (lockfile/pidfile ou check HTTP au démarrage). Évite double-lock SQLite. Message clair "déjà lancé, ouvre http://localhost:XXXX".

### Stack technique

- **D-08** : Langage = **TypeScript** strict.
- **D-09** : Runtime = **Node.js LTS 22+**.
- **D-10** : Framework HTTP = **Fastify** (plugins riches : `@fastify/view`, `@fastify/cookie`, `@fastify/csrf-protection`, `@fastify/formbody`, `@fastify/static`).
- **D-11** : Templating = **EJS** via `@fastify/view`. Partials = composants modulaires (props via `locals`).
- **D-12** : Persistance = **better-sqlite3 + Kysely (query builder type-safe) + migrations SQL versionnées** (`migrations/000N_*.sql` exécutées par Kysely). Pas d'ORM (pas de fuite dans le domaine).
- **D-13** : Tests unit/integration = **Vitest** (coverage v8 intégré).
- **D-14** : BDD (Gherkin) = **@cucumber/cucumber-js** (officiel, 10+ ans, universellement reconnu — futur onboarding comptable possible).
- **D-15** : Property-based testing = **fast-check** (intégration Vitest fluide).
- **D-16** : Money = **`bigint` en centimes + Value Object `Money` maison** (zéro dépendance, aucun bug virgule flottante, strict aligné DDD.md §4.2).
- **D-17** : Date/Time = **Temporal API + `@js-temporal/polyfill`** (immutable, timezone Europe/Paris).
- **D-18** : Validation HTTP = **Zod** + `fastify-type-provider-zod` (schemas TS-first, infer types).
- **D-19** : PDF = **pdfmake** (déclaratif JSON, ~1 Mo, idéal tabulaire — quittance, avis, liasse 2031). Puppeteer écarté (200 Mo Chromium).
- **D-20** : CSS V1 = **Pico.css** (classless, semantic HTML stylé out-of-the-box, ~10 ko, sober). Tailwind à réévaluer Phase 7 si Pico insuffisant.
- **D-21** : Linter + Formatter = **ESLint (flat config) + Prettier** avec plugins DDD : `eslint-plugin-import` (boundaries), `@typescript-eslint`, `eslint-plugin-functional` (immutabilité VOs), custom rule pour interdire identifiants en anglais.
- **D-22** : Architecture boundary enforcement = **dependency-cruiser** (complément ESLint, vérifie au CI que `domain/` ne dépend d'aucun module technique).
- **D-23** : Package manager = **pnpm** (strict, rapide).
- **D-24** : Logger = **pino + pino-pretty (dev)** (JSON structuré, audit-friendly, intégré Fastify).
- **D-25** : Build / distribution V1 = **`tsx` direct** (pas de build). Mono-binaire `pkg`/Node SEA reporté V1.1+.
- **D-26** : Scripts pnpm V1 = `start`, `typecheck`, `test` (vitest), `test:bdd` (cucumber-js), `lint`, `format`.
- **D-27** : Version manager / repro = **Mise (`.mise.toml`)** pin Node 22.x + pnpm 9.x. Polyglot (futur `dbmate`/Rust). Audit-friendly, 10-year repro garantie.

### Périmètre exact des entités V1

- **D-28** : `Bien` V1 — champs **strict PAT-01** : `id`, `adresse { rue, code_postal, ville }`, `surface`, `type ∈ {appartement, maison, immeuble, local_commercial}`, `annee_construction`. Composants amortissables, prix/date acquisition, mise en service → ajoutés par migration ALTER en Phase 5.
- **D-29** : `Lot` **toujours obligatoire** (≥1 par Bien) — pas de dualité `Bail.bien_id` vs `Bail.lot_id`. `Lot = { id, bien_id, designation, surface, type ∈ {appartement, parking, cave, local_commercial, terrasse, autre}, etage }`.
- **D-30** : `Bail` ↔ `Lot` = **1 Bail = 1 ou N Lots du même Bien** (table jointure `bail_lots`). Invariant agrégat : tous les `lot_ids` appartiennent au même `bien_id`, ≥1.
- **D-31** : `Locataire` V1 — champs : `id`, `nom`, `prenom`, `date_naissance` (PlainDate), `lieu_naissance { commune, pays }`, `nationalite`, `email`, `telephone`, `adresse_actuelle` (VO `Adresse`). Aligné LOCATION_MEUBLEE_REGLES.md §9.1 (mentions obligatoires du bail).
- **D-32** : `Locataire` pièces = **aucune pièce V1 (strict YAGNI)**. Phase 4 = coffre documentaire complet avec rétention 10 ans.
- **D-33** : Cautionnement = **VO `Cautionnement` rattaché à l'agrégat `Bail`** (pas champ Locataire). Juridiquement correct : cautionnement = acte signé pour un bail spécifique (art. 22 loi 89). Structure : `Cautionnement = { type ∈ {physique, visale, gli}, garant: Garant, montant_garanti: Money | null, date_signature: PlainDate, duree_engagement }`. UI fiche Locataire affiche les garants via projection lecture des Baux.
- **D-34** : `Bail` type V1 = **bail meublé classique uniquement** (durée ≥ 12 mois). Étudiant/mobilité = deferred V2.
- **D-35** : `Bail` V1 — champs : `id`, `locataire_id`, `bien_id`, `lot_ids[]` (≥1, même `bien_id`), `type='classique'`, `date_debut` (PlainDate), `duree_mois` (≥12), `loyer_hc` (Money positif), `mode_charges ∈ {forfait, provisions}`, `montant_charges` (Money), `depot_garantie` (Money, ≤ 2 × `loyer_hc` — invariant), `indice_irl_reference` (VO `IRL`), `cautionnement` (VO | null).
- **D-36** : Génération PDF du Bail = **reportée à Phase 1.5** (nouvelle phase à créer dans ROADMAP via `/gsd-phase`). Cette Phase 1.5 dédiera la production des artefacts légaux du bail (PDF brouillon + base annexes pour Phase 3).
- **D-37** : Clause IRL V1 = **VO `IRL { trimestre: string, valeur: Decimal }` + saisie manuelle V1**. L'utilisateur récupère manuellement la valeur sur insee.fr. Phase 3 active la révision auto à partir de cette référence. Phase V1.1+ ajoute l'intégration INSEE auto (INS-01 deferred).
- **D-38** : `Bail` V1 = **pure saisie sans statut** (pas de notion brouillon/signé/actif). Phase 1.5 introduira "brouillon PDF" ; Phase 2 introduira "actif" (génère échéances) ; Phase 3 introduira "indexable".

### Workflow d'activation & navigation

- **D-39** : Parcours premier lancement = **wizard guidé 3 étapes** (Bien+Lots → Locataire → Bail). Aligné Hick's Law, Miller's Law, PRD §6, UX_DESIGN.md §Empty States. Une fois réalisé, plus jamais affiché.
- **D-40** : Navigation post-wizard = **sidebar gauche fixe** (Biens / Locataires / Baux) + **breadcrumbs sur chaque page**. Pattern admin Jakob's Law. Scale propre vers Phase 4-7 (ajout sections Documents/Travaux/Fiscalité/Dashboard).
- **D-41** : Affichage listes = **table HTML normative** : `<table>` avec `<th scope='col'>`, sticky header, zebra discrète, sort indicators, actions edit/delete sur row-hover. Right-align numbers (loyer, surface). Conforme UI_DESIGN.md §Data Tables + ACCESSIBILITY.md §Tables.
- **D-42** : Multi-bien V1 = **oui** — CRUD complet (create + edit + delete) sur Biens / Locataires / Baux. PAT-01 success criteria requiert delete. Coût marginal vs mono-bien.
- **D-43** : Empty states = **normatifs UX_DESIGN.md §Empty States** — toujours titre + raison + CTA. Empty state `Baux` mentionne le prérequis (« Tu as besoin d'au moins 1 Bien et 1 Locataire »).

### Standards UI/UX/A11y appliqués à toute la UI V1 (gates de qualité)

À appliquer **partout** en V1, vérifiables par UI-CHECKER au moment du `gsd-ui-phase` / `gsd-ui-review` :

- **D-44** : **WCAG 2.1 AA** — contraste 4.5:1 body / 3:1 large ; navigation 100 % clavier ; focus visible toujours ; `<label>` sur chaque input ; `aria-describedby` pour erreurs ; `prefers-reduced-motion` respecté ; un `<h1>` par page ; `<th scope>` sur tables.
- **D-45** : **Visual hierarchy** — 1 élément dominant/écran ; max 3 tailles de police, 2 graisses ; size > weight > color pour l'importance ; white space porteur.
- **D-46** : **Spacing system** — base 8 px ; multiples 4/8/16/24/32/48/64 strict (jamais d'arbitraire).
- **D-47** : **Color** — 1 primary action ; max 3 accents ; semantic : rouge=erreur / ambre=warning / vert=success ; jamais couleur seule (pair icon ou texte).
- **D-48** : **Typography** — body ≥ 16 px ; line-height 1.4–1.6 ; line-length 60–80 chars ; pas d'all-caps en phrases.
- **D-49** : **Forms** — one column ; label au-dessus du champ (pas placeholder) ; validation inline **au blur** (pas submit) ; required marqué (pas "optional") ; submit disabled tant que required pas remplis ; erreur juxtaposée + `aria-describedby` ; input préservé sur échec.
- **D-50** : **Destructive** — suppression = confirmation step ; Undo > confirm quand possible.

### Décisions différées au `gsd-plan-phase 1`

- **DP-01** : Hard-delete vs soft-delete (audit-friendly penche vers soft-delete `deleted_at` ou table corbeille).
- **DP-02** : pnpm workspaces vs flat `src/{domain,adapters,web,cli}/` (hypothèse : flat suffit V1 + eslint-plugin-import + dependency-cruiser).
- **DP-03** : Sérialisation `Money` en SQLite (TEXT decimal vs INTEGER cents — recommandation forte INTEGER cents pour aligner bigint).
- **DP-04** : Sérialisation `IRL` (table dédiée vs JSON inline vs colonnes plates `trimestre` + `valeur`).
- **DP-05** : Stratégie de session pour le wizard (cookie session vs query param vs storage local).
- **DP-06** : Détection "premier lancement" (table `users` vide vs flag config vs présence du fichier `.sqlite`).

### Claude's Discretion (à trancher par le planner/researcher)

- Choix précis du nom du binaire CLI (`gestion-locative`, `gl`, autre — convention kebab-case).
- Choix du port fixe par défaut (suggestion : 7878 ou autre — éviter conflits port-réservés).
- Routes Fastify exactes (`/biens`, `/biens/:id`, `/biens/:id/lots`, etc. — convention REST).
- Structure exacte du dossier `src/` (cf. DP-02).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-ui-researcher`, `gsd-executor`) MUST read these before planning or implementing.**

### Domaine métier (fiscal, juridique, produit)

- `.planning/PROJECT.md` — contraintes verrouillées, bounded contexts, key decisions.
- `.planning/REQUIREMENTS.md` — REQs PAT-01, PAT-02, LOC-01, LOC-02 (V1) + traceability par phase.
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, dépendances.
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD : cible, périmètre MVP, principes UX, KPIs (KPI Activation = critère #5 Phase 1).
- `LMNP.md` — base de connaissances fiscale LMNP (utile pour Phase 5+ mais structure les bounded contexts dès Phase 1).
- `LOCATION_MEUBLEE_REGLES.md` — règles juridiques du bail meublé : mobilier (décret 2015-981), types de bail, loyer/charges, dépôt de garantie (§5), EDL (§6), DDT (§7), clauses obligatoires (§9), documents à conserver (§11).

### Pratiques d'ingénierie

- `DDD.md` — bounded contexts, agrégats, ports & adapters, ubiquitous language français, tactical patterns (entité, VO, agrégat, repository, domain service, domain event), anti-patterns.
- `BDD_PRACTICES.md` — outside-in, pyramide tests, cas obligatoires (§8), data builders, port `Clock`, anti-patterns testing.
- `SOFTWARE_CRAFTSMANSHIP.md` — SOLID, Clean Code, KISS/DRY/YAGNI, code review checklist, **gates CI bloquants (§8)** : 0 warning, ≥80 % coverage, 100 % logique métier, cyclomatic < 10, suite unitaire < 30 s.

### Pratiques UI/UX/Accessibility

- `UI_DESIGN.md` — Gestalt laws, visual hierarchy, color, typography, spacing system, feedback states, data tables.
- `UX_DESIGN.md` — Hick / Fitts / Miller / Jakob / Doherty laws, flow & navigation, forms, error handling, empty states, affordance & discoverability, cognitive load, trust & transparency.
- `ACCESSIBILITY.md` — WCAG 2.1 AA : POUR principles, contrast & color, keyboard nav, semantic HTML, ARIA (sparingly), images & icons, forms, tables, motion & animation, testing checklist.
- `BEHAVIOR.md` — code of conduct par session : posture sceptique, speed levers (parallel calls, allowlist, no trivial agents, tight prompts, cache discipline).

### Risques & contraintes

- `RISKS.md` — registre des risques (R1 fiscal, R2 juridique, R3 technique/sécurité, R4 UX, R5 maintenance). En particulier R1.1 (surveillance fiscale annuelle), R3.1 (backup), R3.3 (RGPD), R5.1 (maintenance des règles).
- `CLAUDE.md` — règles non négociables projet (top priority V1 LMNP meublé, principes directeurs, hors périmètre).

</canonical_refs>

<code_context>
## Existing Code Insights

**Greenfield** — aucun code, aucun pattern, aucun adapter, aucun composant à réutiliser.

### Reusable Assets
- *(aucun — projet vide)*

### Established Patterns
- *(aucun — projet vide)*

### Integration Points
- *(aucun — Phase 1 = premier code écrit)*

### Conséquence pour le researcher

→ Le `gsd-phase-researcher` devra prospecter **les bonnes pratiques externes** plutôt que des assets internes. Cibles de recherche :
- Patterns DDD hexagonal en TypeScript/Node (séparation `domain/` / `adapters/` / `web/`)
- Bonnes pratiques Fastify + EJS + Kysely (structure projet, plugins recommandés)
- Patterns de wizards SSR multi-étapes (state management entre POST)
- Snippets `Money` bigint VO en TS (équivalents `dinero.js` minus la dépendance)
- Patterns de Lot/Bien agrégats (modélisation 1:N avec invariants cross-aggregate)
- Migrations SQLite + Kysely (templates communautaires)
- Exemples Pico.css + formulaires admin accessibles
- Modèles de Cautionnement bail meublé (champs juridiques précis)

</code_context>

<specifics>
## Specific Ideas

- **Pico.css** explicitement choisi pour l'esthétique sober par défaut (https://picocss.com/docs).
- **Temporal API** choisi malgré son statut polyfill — alignement avec le futur natif.
- **Cautionnement sur Bail** (option 4 dans la discussion) — explicitement aligné avec la réalité juridique (art. 22 loi 89), pas avec la lecture littérale de LOC-01.
- **Mise pour repro** — choisi pour la promesse audit-friendly 10 ans.
- **`@cucumber/cucumber-js`** (officiel) plutôt que `vitest-cucumber` — choisi pour la pérennité d'écosystème et l'éventuel onboarding d'un expert-comptable lisant les scénarios Gherkin.

</specifics>

<deferred>
## Deferred Ideas

### À ajouter dans la ROADMAP (action requise après ce discuss-phase)

- **Phase 1.5 à créer** — Artefacts légaux du bail : génération PDF brouillon du bail (mentions art. 3 loi 89), structure pour annexes Phase 3 (EDL, inventaire, DDT). À insérer via `/gsd-phase` entre Phase 1 et Phase 2.

### À reconsidérer dans des phases ultérieures

- **Phase 5 (Fiscalité)** : Composants amortissables sur `Bien` (gros œuvre, toiture, agencements, mobilier) + prix/date acquisition + mise en service — ajoutés par migration ALTER TABLE.
- **Phase 4 (Coffre documentaire)** : Pièces locataire (CNI, ressources, avis d'impôt) — gérées via `Justificatif` rattachable à `Locataire`/`Bien`.
- **Phase 3 (Conformité du bail)** : IRL active (révision auto à la date anniversaire), gel DPE F/G (loi Climat), diagnostics, EDL contradictoire, checklist mobilier (décret 2015-981).
- **Phase 5 (Fiscalité)** : Réévaluer Turbo (Turborepo) — trigger : suite tests > 90 s OU ≥5 packages workspace.
- **Phase 7 (Dashboard)** : Réévaluer Tailwind si Pico.css insuffisant pour matérialiser la hiérarchie d'urgence (en retard / à venir / à jour).

### À reconsidérer en V1.1+

- **Packaging app installée** (DMG / MSI / AppImage) avec code signing — cf. R3.1 backup, BAK-01.
- **Authentification + accès LAN** (passcode/biometric) — cf. R3.3 RGPD, BAK-02 chiffrement.
- **Auto-launch navigateur** au démarrage — cosmétique.
- **Mono-binaire per-OS** (`pkg` / Node SEA / Bun compile) — couplé au packaging app installée.
- **Intégration INSEE auto IRL** (INS-01) — saisie manuelle V1.

### À trancher au `gsd-plan-phase 1`

- pnpm workspaces vs flat `src/`.
- Sérialisation `Money` SQLite (INTEGER cents recommandé).
- Sérialisation `IRL` SQLite.
- Hard-delete vs soft-delete.
- Stratégie session wizard.
- Détection "premier lancement".

### Reviewed Todos (not folded)

*(aucun todo pré-existant — pas de cross-référence)*

</deferred>

---

*Phase: 1-activation-bien-locataire-bail*
*Context gathered: 2026-05-13*
