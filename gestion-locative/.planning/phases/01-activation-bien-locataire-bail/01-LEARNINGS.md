---
phase: 01
phase_name: "activation-bien-locataire-bail"
project: "Gestion locative"
generated: "2026-05-14"
counts:
  decisions: 18
  lessons: 9
  patterns: 14
  surprises: 8
missing_artifacts:
  - "01-UAT.md (workflow d'UAT pas exécuté pour cette phase)"
---

# Phase 1 Learnings: activation-bien-locataire-bail

## Decisions

### ConnexionDb expose Kysely + driver SQLite ensemble
`ConnexionDb = { db: Kysely<DB>, sqlite: BetterSqlite3.Database }` — passé en bloc aux migrations brutes, parce que Kysely n'expose aucune API publique pour exécuter du SQL multi-statements arbitraire.

**Rationale :** `db.executeQuery` exige une `CompiledQuery` complète avec `queryId` ; `sql.raw()` n'existe pas. `sqlite.exec(content)` est la seule voie pragmatique pour les fichiers `.sql` versionnés.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### `creerApp(db)` séparé de `demarrer()`
Le bootstrap Fastify est exporté comme factory pure prenant la DB en paramètre ; `demarrer()` n'orchestre que l'IO (env vars, pidfile, listen).

**Rationale :** Cucumber world et tests d'intégration peuvent instancier l'app sans serveur HTTP réel via `app.inject()`. Sans cette séparation, chaque test devrait écouter un port et nettoyer.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Fastify 5 logger en objet de config, pas en instance pino
Fastify 5 vérifie `typeof logger` au boot et rejette une instance pino existante. La config est passée nue (`{ level, transport }`) et Fastify instancie pino lui-même.

**Rationale :** Régression de contrat entre Fastify 4 et Fastify 5 non documentée dans les guides de migration.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Cucumber Expression avec `/` → regex obligatoire
Les steps contenant une URL (`GET /biens`) sont déclarés en regex `/^...$/` plutôt qu'en Cucumber Expression DSL.

**Rationale :** Le parser Cucumber Expression interprète `/` comme alternation vide, ce qui crash le step au load.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### `# language: fr` retiré des `.feature`
Les keywords Gherkin restent en anglais (`Feature`, `Scenario`, `Given`, `When`, `Then`), seuls les textes de steps sont français.

**Rationale :** `# language: fr` impose `Fonctionnalité`, `Scénario`, etc., ce qui dégrade la lisibilité IDE/tooling sans bénéfice métier.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### `layout-debut.ejs` + `layout-fin.ejs` au lieu de `layout.ejs` unique
Les pages s'enveloppent dans deux partials EJS distincts (entête + fin) plutôt que de construire une string `contenu` injectée dans un layout unique.

**Rationale :** `<%- include(...) %>` EJS ne peut pas être appelé depuis un template literal JS — la stratégie initiale Plan 02 bloquait toute composition de partials. Split adopté Plan 03, conservé Plan 07.
**Source :** 01-03-patrimoine-crud-SUMMARY.md, 01-07-ui-polish-SUMMARY.md

---

### Erreurs domaine par bounded context
`BienIntrouvable` dans `src/domain/patrimoine/erreurs.ts`, `LocataireIntrouvable` dans `src/domain/locatif/erreurs.ts`, `BailIntrouvable` aussi dans `locatif/erreurs.ts`. `InvariantViolated` reste dans `_shared/erreurs.ts`.

**Rationale :** Les erreurs lookup-failure sont spécifiques au contexte ; les invariants sont transverses. Séparation conforme DDD §4.4.
**Source :** 01-03-patrimoine-crud-SUMMARY.md, 01-04-locataire-crud-SUMMARY.md, 01-05-bail-classique-SUMMARY.md

---

### `LieuNaissance` VO inline dans `locataire.ts`
Pas de fichier dédié — type littéral `{ commune: string; pays: string }` validé par helper privé `validerLieuNaissance()`.

**Rationale :** YAGNI V1 (D-32) — le VO n'est utilisé qu'à un seul endroit ; un fichier séparé serait du sur-design.
**Source :** 01-04-locataire-crud-SUMMARY.md

---

### Double-barrière email : regex minimal domaine + Zod HTTP
Le domaine valide via une regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` (rejet des cas absurdes) ; `z.string().email()` valide la conformité RFC côté HTTP.

**Rationale :** Le domaine reste pur (pas d'import Zod) tout en gardant un invariant ; la validation fine vit au boundary.
**Source :** 01-04-locataire-crud-SUMMARY.md

---

### Money stocké en INTEGER centimes (BigInt côté domaine)
`Money` interne en `bigint` centimes ; sérialisation SQLite via `Number(money.toCentimes())` en écriture, `Money.fromCentimes(BigInt(row.loyer_hc))` en lecture.

**Rationale :** Évite tout drift flottant REAL. Number safe-integer suffit pour les loyers (< 2^53). BigInt côté domaine garantit la rigueur arithmétique pour les sommes/multiplications (Phases 2-6).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### IRL.valeur en string decimal
L'indice INSEE est conservé tel quel (`'145.47'`), pas converti en number.

**Rationale :** Évite l'arrondi flottant JavaScript qui corromprait les calculs d'indexation Phase 3.
**Source :** 01-05-bail-classique-SUMMARY.md

---

### Cautionnement en TEXT JSON inline sur `bail.cautionnement`
`JSON.stringify(cautionnement.toJSON())` en écriture, `Cautionnement.creer(JSON.parse(row.cautionnement))` en lecture — pas de table dédiée.

**Rationale :** D-33 — le cautionnement appartient au Bail (loi 89, contrat-bound) et n'est pas requêté indépendamment Phase 1. Mono-user local : pas de fuite (T-05-04 accept). Une table dédiée serait du sur-modèle.
**Source :** 01-05-bail-classique-SUMMARY.md

---

### Cross-aggregate vérifié au use case, pas dans l'agrégat
`creerBail` invoque `BienRepository.trouverParId` pour vérifier `lot_ids ⊂ bien.lots` (D-30). L'agrégat `Bail` ne traverse jamais `Bien` directement.

**Rationale :** DDD §4.3 — les agrégats ne se référencent que par ID. La cohérence inter-agrégats est l'affaire du use case.
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `lotIds` schema Zod = union(string, array).transform
`z.union([z.string().uuid(), z.array(z.string().uuid())]).transform(v => Array.isArray(v) ? v : [v])`.

**Rationale :** `x-www-form-urlencoded` envoie un scalaire string si une seule checkbox est cochée, un array si plusieurs. Le schema doit accepter les deux et normaliser.
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `SESSION_SECRET` fail-fast au boot
`process.exit(1)` si la variable est absente ou < 32 chars, avec message recommandant `openssl rand -hex 32`.

**Rationale :** DP-05 — sans secret, les cookies de session sont compromis ; un fail-fast évite tout démarrage en config dégradée silencieuse.
**Source :** 01-06-activation-wizard-SUMMARY.md

---

### `wizardBailSchema` recréé explicitement, pas dérivé via `.omit()`
Le schema wizard est dupliqué (sans `bienId`/`locataireId` qui viennent de session) plutôt que dérivé.

**Rationale :** `bailCreationSchema` utilise `.superRefine()` qui retourne `ZodEffects`. `.omit()` n'existe pas sur ce type — la composabilité Zod casse dès qu'un raffinement est ajouté.
**Source :** 01-06-activation-wizard-SUMMARY.md

---

### preHandler restreint à `formatDate` + `formatMoney`
Le hook global injecte uniquement les helpers de format dans `reply.locals` ; la `banniereSuccess` reste gérée route par route.

**Rationale :** Une tentative d'injection globale de `banniereSuccess` causait une double-lecture de session (le preHandler vidait avant que la route lise), cassant le BDD scenario "Bail enregistré avec succès". Les routes lisent + vident la session elles-mêmes.
**Source :** 01-07-ui-polish-SUMMARY.md

---

### ROADMAP critère 3 amendé rétroactivement (D-32/D-33)
"garant, pièces" retiré du critère 3 Phase 1 après VERIFICATION goal-backward.

**Rationale :** Le code respecte les décisions D-33 (cautionnement sur Bail) et D-32 (pièces Phase 4) ; le critère ROADMAP n'avait pas été aligné après le discuss-phase. Amendement pour cohérence documentaire.
**Source :** VERIFICATION.md, commit 39e98b3

---

## Lessons

### Kysely n'expose pas d'API publique pour SQL brut multi-statements
`db.executeQuery` exige `CompiledQuery` ; `sql.raw()` n'existe pas. Pour les migrations brutes, il faut passer par le driver `better-sqlite3` directement (`sqlite.exec()`).

**Context :** Plan 02 — tentative d'utiliser Kysely seul pour appliquer `0001_init.sql` a forcé l'introduction de la structure `ConnexionDb`.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Fastify 5 a cassé le contrat du logger
Une instance pino fournie à Fastify 5 lève `FastifyError: logger options only accepts a configuration object`. Régression vs Fastify 4.

**Context :** Plan 02, Task 3 BDD Before hook. La migration de doc Fastify 4 → 5 ne mentionne pas explicitement le changement.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Cucumber Expression interprète `/` comme alternation
Tout `/` dans un texte de step Cucumber Expression doit être échappé ou le step doit passer en regex `/^...$/`.

**Context :** Plan 02 — le step `"GET /biens"` faisait crash le parser au load. Convention adoptée : steps avec URL → regex systématiquement.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### EJS `<%- include(...) %>` ne fonctionne pas depuis un template literal JS
Si la vue construit la chaîne `contenu` côté JS et l'injecte dans `layout.ejs`, les `include` imbriqués sont ignorés (pas de contexte EJS).

**Context :** Plan 03 — stratégie initiale Plan 02 bloquante dès qu'on a voulu inclure `form-field` / `data-table`. Pivot vers split `layout-debut.ejs` + `layout-fin.ejs`.
**Source :** 01-03-patrimoine-crud-SUMMARY.md

---

### `Temporal.PlainDate ↔ string ISO` est un roundtrip sans piège
`.toString()` produit `YYYY-MM-DD` ; `Temporal.PlainDate.from('YYYY-MM-DD')` reconstruit l'objet exactement. Aucun fuseau horaire à gérer.

**Context :** Plan 04 — utilisé pour `date_naissance`, étendu Plan 05 pour `date_debut`, `date_fin`, `date_signature`. Compatible SQLite TEXT.
**Source :** 01-04-locataire-crud-SUMMARY.md, 01-05-bail-classique-SUMMARY.md

---

### `Intl.NumberFormat('fr-FR')` insère un espace insécable U+00A0
La sortie de `formatMoney(800.50)` est `"800,50 €"` mais avec U+00A0 entre le nombre et `€`, pas un espace normal U+0020. Toute comparaison stricte `toBe('800,50 €')` échoue.

**Context :** Plan 05, Task 1 — les tests Money utilisent `.toMatch()` au lieu de `.toBe()`. Pas de workaround côté Intl (comportement standard).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `x-www-form-urlencoded` : 1 checkbox → string, ≥ 2 → array
Le body parser émet `lotIds = 'uuid'` (string) si une seule checkbox est cochée, `lotIds = ['uuid1', 'uuid2']` si plusieurs. Le schema Zod doit accepter les deux.

**Context :** Plan 05 — `z.union([z.string().uuid(), z.array(z.string().uuid())]).transform(...)`. Pattern à appliquer pour tout multi-select FormData Phase 2+.
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `ZodEffects` (de `.superRefine()`) bloque la composition
Une fois un schema raffiné via `.superRefine()` ou `.refine()`, il ne supporte plus `.omit()`, `.partial()`, `.extend()`. Il faut le recréer ou raffiner le schema dérivé séparément.

**Context :** Plan 06 — `wizardBailSchema` ne pouvait pas être `bailCreationSchema.omit({bienId, locataireId})` ; recréation explicite avec duplication du `superRefine` dépôt ≤ 2×.
**Source :** 01-06-activation-wizard-SUMMARY.md

---

### Le critère ROADMAP peut diverger silencieusement des décisions projet
Un critère de succès rédigé tôt (avant `discuss-phase`) reste tel quel si on ne l'amende pas après les décisions structurantes (D-32/D-33 ici). Aucune erreur de typecheck, aucune erreur de tests — détecté seulement à la VERIFICATION goal-backward.

**Context :** VERIFICATION Phase 1 — critère 3 listait "garant, pièces" sur Locataire alors que D-33 (cautionnement → Bail) et D-32 (pièces → Phase 4) avaient déplacé le scope. Recommandation : amender ROADMAP dès qu'une décision contredit un critère existant.
**Source :** VERIFICATION.md

---

## Patterns

### Hexagonal strict avec dependency-cruiser
`src/domain/**` n'importe ni Fastify ni Kysely ni Zod ni pino. Frontière vérifiée par `pnpm lint:deps` (0 violations sur 49 modules à la fin Phase 1).

**When to use :** Toutes les phases ; règle non négociable du projet (cf. CLAUDE.md).
**Source :** 01-02-walking-skeleton-SUMMARY.md, 01-07-ui-polish-SUMMARY.md

---

### Factory statique + `InvariantViolated`
Chaque entité expose `X.creer(props)` qui valide les invariants et throw `InvariantViolated` sur violation. Pas de `new X()` direct.

**When to use :** Toute entité ou VO domaine. Garantit l'immuabilité et la cohérence dès la construction.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Brand types pour les identifiants
`type BienId = string & { readonly __brand: 'BienId' }`, `nouveauBienId()` retourne `crypto.randomUUID()` casté.

**When to use :** Tout identifiant transverse (Bien, Lot, Locataire, Bail, etc.) — empêche les mix-up à la compilation sans coût runtime.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Builders dans `tests/_builders/`
`unBienValide(overrides?)`, `unLocataireValide(overrides?)`, `unBailValide(overrides?)`, `unMontantValide(centimes?)`, `unIrlValide(overrides?)`, `uneCautionnementPhysique(overrides?)`.

**When to use :** Tests unitaires et intégration — fixture par défaut valide, overrides pour cibler le cas testé. Conforme BDD_PRACTICES §9.
**Source :** 01-03-patrimoine-crud-SUMMARY.md, 01-04-locataire-crud-SUMMARY.md, 01-05-bail-classique-SUMMARY.md

---

### TDD outside-in : BDD rouge → unit/integration rouges → green
Chaque plan implémentation commence par 1 commit `test(NN-NN): ... rouge` qui code tous les tests attendus. Puis les tasks suivantes les font passer au vert.

**When to use :** Plans `type: execute` avec contenu domaine ou interactions UI. La discipline TDD est explicitement requise par BDD_PRACTICES §5.
**Source :** 01-02 → 01-06 SUMMARYs

---

### Repository : `versDomaine(row)` + `versRow(entity)` + `transaction()`
Helpers privés de mapping bidirectionnel, écritures atomiques via `db.transaction().execute()` quand plusieurs tables sont impactées (bien + lots, bail + bail_lots).

**When to use :** Tout adapter SQLite Kysely qui touche > 1 table en cohérence.
**Source :** 01-02-walking-skeleton-SUMMARY.md, 01-03-patrimoine-crud-SUMMARY.md, 01-05-bail-classique-SUMMARY.md

---

### Use case multi-repos pour cross-aggregate
Quand l'agrégat A doit vérifier qu'une référence à B existe (lot_ids ⊂ bien.lots, locataireId existant), le use case prend les deux repos en paramètre et fait la vérification AVANT d'appeler la factory.

**When to use :** Création / modification de Bail (vérifier Bien + Locataire + Lots), Quittance Phase 2 (vérifier Bail), Justificatif Phase 4 (vérifier Bien/Locataire).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### EJS layout split `debut.ejs` + `fin.ejs`
Chaque page enveloppe son contenu entre `<%- include('../../partials/layout-debut', {...}) %>` et `<%- include('../../partials/layout-fin') %>`.

**When to use :** Toutes les pages non-wizard. Variante wizard : `wizard-layout.ejs` + `wizard-layout-fin.ejs` avec step indicator.
**Source :** 01-03-patrimoine-crud-SUMMARY.md, 01-06-activation-wizard-SUMMARY.md

---

### Partials EJS configurables via locals
8 partials réutilisables : `form-field`, `data-table`, `confirm-dialog`, `sidebar-nav`, `breadcrumbs`, `empty-state`, `banniere-success`, `wizard-layout`. Chacun prend un objet `locals` typé (label, value, ariaLabel, colonnes, formAction, etc.).

**When to use :** Toute nouvelle page Phase 2+ — composer les partials existants avant d'écrire du HTML ad-hoc.
**Source :** 01-03-patrimoine-crud-SUMMARY.md, 01-07-ui-polish-SUMMARY.md

---

### `normaliserLotsFormBody(body)` pour FormData arrays indexés
Regroupe les champs `lots[0].XXX`, `lots[1].XXX`, ... en `[{XXX}, ...]` avant `bienCreationSchema.safeParse()`.

**When to use :** Tout formulaire FormData avec collection imbriquée (lots, justificatifs Phase 4, etc.).
**Source :** 01-03-patrimoine-crud-SUMMARY.md

---

### Roundtrip SQLite : Temporal.PlainDate ↔ TEXT ISO
`.toString()` → SQLite TEXT (`YYYY-MM-DD`), `Temporal.PlainDate.from(row.x)` → objet Temporal. Pas de fuseau, pas d'arrondi.

**When to use :** Toute date métier (naissance, début bail, échéance Phase 2, signature acte).
**Source :** 01-04-locataire-crud-SUMMARY.md, 01-05-bail-classique-SUMMARY.md

---

### Roundtrip SQLite : Money ↔ INTEGER centimes
`Number(money.toCentimes())` écriture, `Money.fromCentimes(BigInt(row.x))` lecture. Toute la rigueur arithmétique reste en BigInt dans le domaine.

**When to use :** Tout champ monétaire (loyer, charges, dépôt, encaissement Phase 2, amortissement Phase 5).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `creerApp(db)` factory + `demarrer()` IO séparée
Le bootstrap Fastify est testable sans IO ; `demarrer()` n'orchestre que l'IO (env, listen, pidfile, signaux).

**When to use :** Toute nouvelle phase qui ajoute du wiring HTTP — étendre `creerApp(db)` plutôt que `demarrer()`.
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### preHandler hook pour injecter des helpers dans EJS
`reply.locals.formatDate = formatDate` dans un preHandler global ; disponibles dans toutes les vues sans passer par chaque `reply.view({...})`.

**When to use :** Helpers pure functions, sans dépendance à la session ou au request. Pour la session, lire/clear dans la route handler elle-même (cf. lesson preHandler).
**Source :** 01-07-ui-polish-SUMMARY.md

---

## Surprises

### Plan 02 : 4 auto-fixes dans un seul plan d'amorce
Logger Fastify 5, Cucumber `/`, `# language: fr`, Kysely SQL brut — quatre régressions/incompatibilités API rencontrées dans le Walking Skeleton.

**Impact :** Le plan a tenu son temps (10 min) malgré les 4 fix, mais a démontré que la couche d'intégration TS/Fastify 5/Kysely/Cucumber a beaucoup de drift API non documenté. Plans 03+ ont bénéficié des découvertes (patterns stabilisés).
**Source :** 01-02-walking-skeleton-SUMMARY.md

---

### Plan 03 : layout split tardif obligatoire
L'incompatibilité `<%- include(...) %>` ↔ template literal JS n'a été détectée qu'au moment où Plan 03 a voulu factoriser des partials. Plan 02 avait shippé une stratégie qui paraissait propre.

**Impact :** Plan 03 a dû introduire `layout-debut.ejs` + `layout-fin.ejs` ET maintenir `layout.ejs` pour ne pas casser le BDD scenario Plan 02. Léger sur-coût d'architecture lié à l'inertie.
**Source :** 01-03-patrimoine-crud-SUMMARY.md

---

### Intl.NumberFormat insère U+00A0, pas un espace normal
Espace insécable entre le nombre et l'unité monétaire `€`. Comportement standard mais surprenant pour les tests stricts.

**Impact :** Plan 05 — les tests Money.enEuros() utilisent `.toMatch(/800,50/)` + `.toMatch(/€/)` au lieu de `toBe('800,50 €')`. Pattern à appliquer pour tous les tests Intl Phase 2+ (numéro de TVA, dates Intl, etc.).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### FormData : 1 checkbox = string, ≥ 2 = array
La structure du body change selon la cardinalité. Sans union Zod, le schema rejette le cas mono-checkbox.

**Impact :** Plan 05 — `lotIds` schema en `union(string, array).transform(...)`. Pattern à appliquer à tout multi-select (Justificatifs Phase 4, Encaissements Phase 2).
**Source :** 01-05-bail-classique-SUMMARY.md

---

### `ZodEffects` casse `.omit()` / `.partial()` / `.extend()`
Tout schema raffiné via `.superRefine()` ou `.refine()` perd la composabilité Zod standard.

**Impact :** Plan 06 a dû dupliquer `bailCreationSchema` en `wizardBailSchema` (sans bienId/locataireId, mais avec le même `superRefine` dépôt ≤ 2×). Pattern : tout schema réutilisé en mode "subset" doit être recréé OU le refinement doit vivre côté route, pas dans le schema.
**Source :** 01-06-activation-wizard-SUMMARY.md

---

### BDD step doit fetch les lot IDs depuis la DB
Les IDs des Lots créés à l'étape 1 du wizard sont des UUID générés serveur — le step Cucumber qui submit l'étape 3 ne les connaît pas a priori. Solution : SELECT en SQLite avant le POST.

**Impact :** Plan 06 — step BDD étendu avec accès direct à la DB (acceptable dans le world Cucumber qui contrôle déjà l'instance SQLite). Pattern à reproduire pour tout BDD multi-step où des IDs intermédiaires sont générés.
**Source :** 01-06-activation-wizard-SUMMARY.md

---

### preHandler accédant à la session crée une race condition
Lire+vider la session dans un preHandler global est consommé AVANT que la route handler ne la lise. La bannière `banniereSuccess` se retrouve à `null` côté template.

**Impact :** Plan 07 a dû restreindre le preHandler aux helpers pure (`formatDate`, `formatMoney`). Toute donnée stateful (session, flash, csrf) reste gérée route par route. Pattern à respecter pour Phases 2+ qui auront aussi du flash messaging (échéances, relances).
**Source :** 01-07-ui-polish-SUMMARY.md

---

### Le critère ROADMAP §3 a dérivé sans alerte
"garant, pièces" sur Locataire alors que D-33 et D-32 avaient déplacé le scope (cautionnement → Bail, pièces → Phase 4). Détecté uniquement par la VERIFICATION goal-backward — ni typecheck, ni tests, ni lint:deps ne pouvaient le repérer.

**Impact :** Une PARTIAL purement rédactionnelle (4/5 PASS, 1/5 PARTIAL). Recommandation : `gsd-discuss-phase` doit produire un diff explicite ROADMAP vs décisions et l'appliquer immédiatement, sinon le drift n'est rattrapé qu'en bout de phase.
**Source :** VERIFICATION.md
