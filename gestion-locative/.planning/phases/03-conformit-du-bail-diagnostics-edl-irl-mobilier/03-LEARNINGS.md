---
phase: 03
phase_name: "conformit-du-bail-diagnostics-edl-irl-mobilier"
project: "Gestion locative"
generated: "2026-05-18"
counts:
  decisions: 18
  lessons: 8
  patterns: 14
  surprises: 8
missing_artifacts:
  - "03-UAT.md (4 items routés en human_verification dans VERIFICATION.md : clavier wizard, annonce SR gel-loyer, rendu @media print, PDF binaire — pas d'UAT conversationnel exécuté)"
---

# Phase 3 Learnings: conformit-du-bail-diagnostics-edl-irl-mobilier

## Decisions

### D-75 — Diagnostic rattaché Bien uniquement (pas par Lot) en V1
Diagnostic appartient au Bien dans sa globalité (un DPE est émis pour un logement entier). Pas de granularité par Lot V1.

**Rationale :** YAGNI V1 — la copropriété par lot pour le DPE n'est pas un cas LMNP standard. Évite un cross-aggregate inutile entre Lot et Diagnostic.
**Source :** 03-01-SUMMARY.md

---

### D-76 — Diagnostic sous-agrégat de Bien (pas d'agrégat indépendant)
`Diagnostic` est une entité du sous-agrégat Bien (DiagnosticId existe mais pas de DiagnosticRepository). Persistance via purge+réinsert dans `BienRepository`.

**Rationale :** Pattern Lot D-29 étendu Phase 1. Cohérence transactionnelle garantie par le repo unique ; pas de cas d'usage où un Diagnostic existerait sans Bien.
**Source :** 03-01-SUMMARY.md

---

### D-77 — DUREES_VALIDITE codé en shared kernel domaine versionneable LF
Constante `DUREES_VALIDITE` (DPE 10 ans, gaz 6 ans, élec 6 ans, ERP null) dans `src/domain/_shared/duree-validite-diagnostic.ts`.

**Rationale :** RISKS.md R1.1 — révision annuelle post-LF en 1 PR. Centraliser évite la duplication ; le shared kernel n'introduit pas de couplage entre BC car la donnée est purement référentielle.
**Source :** 03-01-SUMMARY.md

---

### D-78 — Bien.classeDpe synchronisé auto dans ajouterDiagnostic
La méthode `Bien.ajouterDiagnostic(d)` copy-on-write met à jour `classeDpe` si `d.type === 'dpe'`. Pas de double saisie côté UI.

**Rationale :** DP-14 résolu. La classe DPE est une projection du dernier diagnostic DPE ; la maintenir cohérente dans le domaine évite tout drift entre UI et données.
**Source :** 03-01-SUMMARY.md

---

### D-79 — Historique complet conservé, pas de suppression V1
Aucune méthode `supprimerDiagnostic` ; les diagnostics expirés restent visibles dans la liste avec badge "expiré".

**Rationale :** Traçabilité plus-value LF 2025 — l'administration peut demander l'historique des diagnostics pour la détermination de la base imposable.
**Source :** 03-01-SUMMARY.md

---

### D-80 — Bannière expiration = warning non-bloquant (aria-live=polite)
`aria-live="polite"` plutôt que `role="alert"` ; jamais de redirect ni de blocage du formulaire d'ajout.

**Rationale :** L'expiration est informative (le bailleur peut continuer à gérer le bien). Un `role=alert` interrompt l'utilisateur ce qui n'est pas justifié ici (le diagnostic à venir n'est pas urgent au point de bloquer l'écran).
**Source :** 03-01-SUMMARY.md

---

### D-92 — Bien.estGelLoyer() = classeDpe ∈ {F, G}
Méthode pure sur Bien, sans paramètre date (le gel est lié au DPE actif, pas à la date d'application).

**Rationale :** Décret 2022-1313 — gel des loyers F/G. La logique métier est portée par l'agrégat Bien et consommée par les use cases d'indexation (defense en profondeur cross-aggregate).
**Source :** 03-01-SUMMARY.md, 03-03-SUMMARY.md

---

### D-84/D-85/D-89 — EtatDesLieux soft-delete + UNIQUE partial index
EDL `annule_le IS NULL` + raisonAnnulation ; index UNIQUE partiel `WHERE annule_le IS NULL` pour D-89 (un seul EDL actif par bail+type).

**Rationale :** Soft-delete (pattern Encaissement Phase 2) préserve l'historique pour audit. L'index partiel pousse l'invariant au niveau DB (double barrier avec le use case).
**Source :** 03-02-SUMMARY.md

---

### D-94 — Orchestration apply IRL en 5 effets séquentiels (pas de transaction Kysely englobante)
Use case `appliquerIndexationIRL` : bail save → echeances regen → bail_indexations insert → PDF gen → file write. DB commit avant PDF ; échec PDF = log CRITICAL + re-throw.

**Rationale :** `BailRepository.enregistrer` a déjà sa propre transaction interne ; étendre le port pour accepter une transaction externe imposait une cascade hors scope MVP. Append-only autorise un nouvel essai si échec PDF. T-03-04-02 mitigé par SQLite mono-process + WAL.
**Source :** 03-04-SUMMARY.md

---

### D-96 — BailIndexation strictement append-only (pas de méthode annuler)
Aucune mutation possible après `BailIndexation.creer`. Correction métier = nouvelle ligne (dateEffet différent).

**Rationale :** Traçabilité fiscale (Phase 5 liasse 2031) — l'historique des indexations doit refléter la réalité juridique des avenants émis. Une annulation soft cacherait l'avenant déjà signé.
**Source :** 03-04-SUMMARY.md

---

### D-98 — Gel Climat F/G vérifié AVANT toute écriture (apply ET renoncer)
Defense en profondeur 2 niveaux : UI route (GET render `gel-loyer.ejs`) ET use case (throw `GelLoyerClimatActif` avant le moindre side-effect).

**Rationale :** T-03-03-01 bypass UI — sans la garde au use case, un POST direct contournerait la protection. La défense au domaine garantit la conformité décret 2022-1313 indépendamment de l'UI.
**Source :** 03-03-SUMMARY.md, 03-04-SUMMARY.md

---

### Méthodes pures sur agrégat consommées par use case orchestrateur (DP-20)
`Bail.dateAnniversaireProchaine`, `Bail.simulerIndexation`, `Bien.estGelLoyer` sont des read-only methods sur l'agrégat (pas de copy-on-write, pas de service externe).

**Rationale :** DP-20 résolu — la logique métier vit dans l'agrégat ; le use case n'orchestre que le lookup multi-repos + la persistance. Testabilité unitaire pure.
**Source :** 03-03-SUMMARY.md

---

### Money.multiplyByRatio en additive change (pas de remplacement de multiplyByFraction)
Nouvelle méthode `Money.multiplyByRatio(num, den, mode)` accepte `num > den` (indexation hausse). `multiplyByFraction` (invariant `0 ≤ num ≤ den`) préservé pour le prorata Phase 2.

**Rationale :** DP-16 résolu sans casser la sémantique du prorata. Les deux méthodes coexistent avec des invariants distincts ; les tests Phase 2 restent verts (T9 explicite).
**Source :** 03-03-SUMMARY.md

---

### Zod transform accepte 2 formats trimestre (UI + canonique)
`indexationSaisieSchema.transform` accepte `'1T2026'` (convention FR UI) et `'2026-T1'` (canonique domain), normalise vers canonique avant `IRL.creer`.

**Rationale :** Pas de fuite du format UI dans le domaine. Le boundary HTTP est responsable de la normalisation des conventions de saisie utilisateur.
**Source :** 03-03-SUMMARY.md

---

### InventaireItem.creer : etat='bon' par défaut si présent dans la checklist mobilier
`mobilierVersInventaireItems` (helper boundary) fixe `etat='bon'` pour les items cochés présents dans la checklist Bail (pas dans l'EDL).

**Rationale :** L'invariant domaine "L'état est requis si l'item est présent" est strict. La checklist mobilier (signée à la rédaction du bail) n'est pas un EDL ; l'état réel sera affiné lors de l'EDL d'entrée. Défaut `'bon'` est la convention LMNP.
**Source :** 03-02-SUMMARY.md

---

### Bail.mobilier stocké en JSON inline (pas de table dédiée)
12 items mobilier complets stockés en TEXT JSON sur `bail.mobilier`. Roundtrip via `JSON.stringify/parse`.

**Rationale :** Pattern Cautionnement Phase 1 (D-33). Le mobilier appartient au Bail, n'est jamais requêté indépendamment. Une table dédiée serait du sur-modèle.
**Source :** 03-02-SUMMARY.md

---

### listerBailsIndexables : filtre 12-mois optionnel (rétro-compat)
Le filtre "dernière indexation < 12 mois" n'est activé que si `bailIndexationRepo` est injecté. 03-03 sans repo = sans filtre ; 03-04 avec repo = avec filtre.

**Rationale :** Préserve la rétro-compat de la signature use case et permet aux callers existants (BDD 03-03) de continuer à fonctionner sans modification. Évolution propre cross-plans.
**Source :** 03-04-SUMMARY.md

---

### Steps BDD a11y suffixés `(a11y-phase3)` pour éviter collisions
Les step definitions du feature accessibilité Phase 3 sont suffixés `(a11y-phase3)` plutôt que d'être réutilisés depuis diagnostics/edl/irl.

**Rationale :** Évite l'ambiguïté "Multiple step definitions match" rencontrée Phase 1 (cf. 03-01 deviation step doublon). Pattern d'isolation reproductible pour les futurs audits a11y transverses.
**Source :** 03-05-SUMMARY.md

---

## Lessons

### Use case `BailRepository.enregistrer` a sa propre transaction interne — pas extensible facilement
L'étendre pour accepter une transaction externe imposait une cascade de changement du port `BailRepository` + tous les adapters. Le plan 03-04 a dû renoncer à une transaction Kysely englobante des 5 effets.

**Context :** Plan 03-04 (apply IRL) — décision D-94 documentée. Une amélioration future pourrait introduire une variante `enregistrerDansTransaction(trx, bail)`.
**Source :** 03-04-SUMMARY.md

---

### Sémantique "anniversaire atteint aujourd'hui = +1 an" force récursion pure (bissextile)
`dateDebut=2024-02-29 + 1y` retourne `2025-02-28` nativement via Temporal. Sur `today=2025-02-28`, la branche simple "compare > 0 ? même année : +1 an" retourne 2025 alors que la sémantique attend 2026. Fix : boucle récursive `prochainDepuis(n)` qui incrémente N jusqu'à dépasser strictement today.

**Context :** Plan 03-03 — test T15 a déclenché la découverte. La récursion locale contourne aussi le warning `functional/no-let`.
**Source :** 03-03-SUMMARY.md

---

### esbuild parse `loyer_*/irl_*` dans un commentaire JSDoc comme regex non terminé
Le commentaire `* (jamais d'UPDATE des colonnes loyer_*/irl_*/date_effet).` faisait crash esbuild en transform error.

**Context :** Plan 03-04 — fix par remplacement par texte explicite `loyer_avant/loyer_apres/irl_avant/irl_apres`. À éviter dans tous les commentaires JSDoc/inline futurs.
**Source :** 03-04-SUMMARY.md

---

### Wording mention légale "art. 17-1" vs "article 17-1" — test strict
Le test T27 integration PDF attendait `article 17-1` ; le footer utilisait `art. 17-1`. Cassé silencieusement.

**Context :** Plan 03-04 — fix par remplacement global. Lesson : les mentions légales sont testées au caractère près, l'abréviation doit être documentée dans la spec UI ou évitée.
**Source :** 03-04-SUMMARY.md

---

### Cucumber expressions interprètent `(...)` comme groupe optionnel
`(literie décochée)` rend le groupe optionnel, le pattern ne match pas la phrase exacte. Fix : échappement `\(literie décochée\)` ou bascule en regex.

**Context :** Plan 03-02 — step `Quand le bailleur saisit le bail (literie décochée)`. Pattern reproductible de Phase 1 (Cucumber `/` alternation).
**Source :** 03-02-SUMMARY.md

---

### Step `la page affiche {string}` déjà exporté par activation.steps.ts (collision)
Ré-exporter le même step dans `diagnostics.steps.ts` cause "Multiple step definitions match" ambiguity.

**Context :** Plan 03-01 — fix par suppression du doublon, réutilisation du step existant. Lesson : avant d'écrire un step générique, vérifier qu'il n'existe pas déjà dans un autre fichier.
**Source :** 03-01-SUMMARY.md

---

### Champs Zod schema renommés silencieusement vs BDD step definitions
Le schema attend `loyerHcEuros`/`montantChargesEuros`/`depotGarantieEuros` mais les steps utilisaient `loyerHc`/`montantCharges`/`depotGarantie` (Phase 1 naming). Aucune erreur de typecheck (steps sont des strings), seulement échec au runtime BDD.

**Context :** Plan 03-02 — fix par alignement des step builders. Lesson : tout renommage de schema doit grep-checker `tests/bdd/step_definitions/` immédiatement.
**Source :** 03-02-SUMMARY.md

---

### URL POST `/baux/:id` vs `/baux/:id/modifier` — la route modifier est dédiée
Step BDD envoyait POST `/baux/:id` (n'existe pas) au lieu de `/baux/:id/modifier`.

**Context :** Plan 03-02 — fix URL. Lesson : conventions REST locales du projet (modifier = sous-route POST `/modifier`) doivent être documentées ; un step écrit "par habitude" REST standard rate la cible.
**Source :** 03-02-SUMMARY.md

---

## Patterns

### Sous-agrégat avec factory `creer()` + private constructor (Lot D-29 étendu)
`Diagnostic.creer()`, `EtatDesLieux.creer()`, `BailIndexation.creer()`, `InventaireItem.creer()` — tous suivent le pattern Phase 1 Lot avec invariants stricts au boundary.

**When to use :** Toute entité du sous-agrégat (rattachée à un agrégat racine, sans repo dédié). Garantit l'immuabilité et la cohérence.
**Source :** 03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-04-SUMMARY.md

---

### Purge + réinsert atomique pour listes de sous-entités
`DELETE diagnostics WHERE bien_id = X` + `INSERT batch` dans transaction Kysely unique sur `BienRepository.enregistrer`. Idem pour `bail_lots`.

**When to use :** Sous-agrégat liste persisté avec son agrégat racine. Garantit la cohérence transactionnelle sans tracking de diff côté domaine.
**Source :** 03-01-SUMMARY.md

---

### Shared kernel domaine versionneable LF (DUREES_VALIDITE pattern)
Constantes métier réglementaires dans `src/domain/_shared/` (ex: `DUREES_VALIDITE`, futures barèmes fiscaux Phase 5).

**When to use :** Toute donnée référentielle réglementaire révisée annuellement par loi de finances. 1 fichier = 1 PR de mise à jour.
**Source :** 03-01-SUMMARY.md

---

### Helpers preHandler avec `today` déterministe injecté
`today = clock.aujourdhui()` dans `reply.locals` via preHandler. Helpers EJS purs (`formaterStatutDiagnostic(dateExp, today)`) consomment `today` sans dépendance ambient.

**When to use :** Tout helper de format dépendant de la date courante. Garantit le déterminisme BDD (ClockFixe) sans propager `today` dans chaque route handler.
**Source :** 03-01-SUMMARY.md

---

### Badge coloré accessible (couleur + texte + aria-label, jamais couleur seule)
Badge DPE 8 cas (A..G + null) : pair couleur + texte visible + `aria-label="Classe DPE : F"`. Contraste ≥ 4.5:1.

**When to use :** Tout badge d'état (DPE, statut diagnostic, état EDL, etc.). Conforme WCAG 1.4.1 / 1.4.3.
**Source :** 03-01-SUMMARY.md, 03-05-SUMMARY.md

---

### Bannière warning non-bloquante D-80 (aria-live=polite, pas role=alert)
`<div aria-live="polite">` pour les warnings informatifs (expiration diagnostic, anniversaire IRL). Réservation `role="alert"` aux blocages critiques (gel-loyer).

**When to use :** Information non-urgente que l'utilisateur peut consulter à son rythme. Pour blocages métier interruptifs : `role="alert"` + `aria-live="assertive"` + autofocus.
**Source :** 03-01-SUMMARY.md, 03-05-SUMMARY.md

---

### Soft-delete avec UNIQUE partial index DB (double barrier D-89)
Colonne `annule_le TIMESTAMP NULL` + `CREATE UNIQUE INDEX ... WHERE annule_le IS NULL`. Use case vérifie l'invariant ; DB confirme.

**When to use :** Toute entité dont l'historique doit être conservé mais avec un seul actif à la fois (EDL, futurs avenants, contrats résiliés).
**Source :** 03-02-SUMMARY.md

---

### Defense en profondeur cross-aggregate (UI + use case)
Garde métier (`Bien.estGelLoyer`) vérifiée à 2 niveaux : route UI (rendu page d'erreur) + use case (throw erreur domain catché en 403).

**When to use :** Toute contrainte métier liée à un agrégat externe consommée par un use case. Le bypass POST direct est rejeté avant tout side-effect.
**Source :** 03-03-SUMMARY.md, 03-04-SUMMARY.md

---

### Méthode pure sur agrégat (DP-20) consommée par use case orchestrateur
`Bail.simulerIndexation`, `Bail.dateAnniversaireProchaine` — read-only methods, sans copy-on-write, sans I/O. Le use case orchestre lookup multi-repos.

**When to use :** Calcul métier déterministe sur l'état de l'agrégat. Évite l'anti-pattern "domain service externe" pour de la logique qui appartient à l'agrégat.
**Source :** 03-03-SUMMARY.md

---

### Additive change sur VO partagé (multiplyByRatio sans casser multiplyByFraction)
Nouvelle méthode avec invariant distinct cohabite avec l'existante. Test explicite préserve l'invariant historique.

**When to use :** Évolution d'un VO réutilisé (Money, Temporal, IRL) — ajouter une méthode avec sémantique différente plutôt que d'élargir un invariant existant.
**Source :** 03-03-SUMMARY.md

---

### Agrégat append-only sans méthode annuler (D-96)
`BailIndexation.creer` pour pose seulement, aucune mutation. Correction = nouvelle ligne. Rejoint le pattern Encaissement compensateur Phase 2.

**When to use :** Données d'audit fiscal/juridique (indexations, écritures comptables, avenants). L'historique reflète la vérité juridique.
**Source :** 03-04-SUMMARY.md

---

### Use case multi-repos avec compensation hors transaction pour PDF
DB commit séquentiel + PDF gen hors transaction. Échec PDF = log CRITICAL + re-throw. Append-only autorise un nouvel essai.

**When to use :** Tout use case combinant écriture DB + génération de fichier immutable (quittance, avenant, futurs bordereaux Phase 5).
**Source :** 03-04-SUMMARY.md

---

### Storage immutable symétrique (flag 'wx' + path traversal protection)
`ecrireAvenant` / `lireAvenant` symétriques à `ecrireQuittance` / `lireQuittance` — flag `'wx'` (refuse overwrite), NULL byte check, realpath boundary.

**When to use :** Tout fichier généré une fois immutable (PDF légal, snapshot signé, export CSV daté). Pattern Phase 2 D-63 étendu.
**Source :** 03-04-SUMMARY.md

---

### Snapshot tests EJS avec UUID scrub
Helper local `scrub(html)` remplace `[0-9a-f]{8}-...-[0-9a-f]{12}` par `UUID` avant `toMatchSnapshot()`.

**When to use :** Régression visuelle sur vues EJS rendues — toute donnée non déterministe (UUID, timestamp) doit être scrubée pour reproductibilité.
**Source :** 03-05-SUMMARY.md

---

## Surprises

### Money.multiplyByRatio + bissextile : clamp natif Temporal mais sémantique custom
`Temporal.PlainDate.from('2024-02-29').add({years: 1})` retourne `2025-02-28` sans erreur (clamp natif). Mais la sémantique "anniversaire atteint aujourd'hui = +1 an" exige une boucle récursive pour gérer le cas où Temporal.until retourne `N-1 ans + 11 mois + 28 jours`.

**Impact :** Plan 03-03 — fix par récursion pure `prochainDepuis(n)`. Pattern à retenir pour toute sémantique "anniversaire" : ne pas faire confiance à un simple `+1y` calendaire.
**Source :** 03-03-SUMMARY.md

---

### listerBailsIndexables filtre 12-mois optionnel par injection conditionnelle
Le filtre n'est activé que si `bailIndexationRepo` est injecté ; le use case détecte sa présence et adapte sa requête. Pattern rétro-compat élégant entre 03-03 (sans repo) et 03-04 (avec repo).

**Impact :** Aucune migration API requise pour les BDD 03-03 ; 03-04 active le filtre via DI. Pattern à reproduire pour les évolutions cross-plans qui ajoutent une contrainte secondaire.
**Source :** 03-04-SUMMARY.md

---

### esbuild parse error sur commentaire JSDoc avec `*/`
Le commentaire `loyer_*/irl_*/date_effet` à l'intérieur d'un bloc JSDoc déclenche esbuild transform error (interprété comme regex non terminé suivi de fin de bloc).

**Impact :** Plan 03-04 fix immédiat par texte explicite. Lesson durable : éviter `*/` ou patterns regex-like dans tout commentaire JSDoc, même imbriqué.
**Source :** 03-04-SUMMARY.md

---

### Mention légale "art. 17-1" vs "article 17-1" — test strict cassait silencieusement
Aucun typecheck, aucune erreur de lint — juste le test T27 PDF qui matchait sur la chaîne complète `article 17-1`.

**Impact :** Plan 03-04 fix global. Les mentions légales sont du contenu testé caractère-près ; les abréviations doivent être interdites par convention ou la spec UI doit lister la chaîne exacte attendue.
**Source :** 03-04-SUMMARY.md

---

### InventaireItem invariant strict cassait mobilierVersInventaireItems
`InventaireItem.creer` throw si `present=true && etat=null`. La checklist mobilier (Bail signé) n'a pas d'état car ce n'est pas un EDL.

**Impact :** Plan 03-02 — fix par helper boundary `mobilierVersInventaireItems` qui set `etat='bon'` par défaut. Lesson : un invariant domaine strict force le boundary à fournir des défauts métier explicites.
**Source :** 03-02-SUMMARY.md

---

### Cucumber expression parenthèses = groupe optionnel
`(literie décochée)` rend littéralement le groupe optionnel ; le step matche aussi "le bailleur saisit le bail" sans suffixe. Pas d'erreur, juste un faux positif silencieux.

**Impact :** Plan 03-02 — échappement obligatoire. Pattern à appliquer pour toutes les annotations contextuelles entre parenthèses dans les steps.
**Source :** 03-02-SUMMARY.md

---

### Cucumber `{int} ligne(s)` syntaxe officielle pluriel optionnel
La feature dit `1 ligne` (singulier) ; le step `{int} lignes pour ce bail` ne matche pas. Cucumber expression supporte `(s)` pour rendre le caractère optionnel.

**Impact :** Plan 03-02 — fix par `{int} ligne(s) pour ce bail`. Pattern à généraliser pour tout step parlant de comptage.
**Source :** 03-02-SUMMARY.md

---

### Wizard IRL multi-étapes oblige session draft + recalcul à chaque étape
Le wizard 5 étapes (banner → saisie → simulation → confirmation → résultat) ne peut pas porter l'état métier dans des hidden fields (manipulation possible). La session Fastify porte `indexationDraft` ; `confirmation.ejs` recalcule via `simulerIndexationIRL` pour defense en profondeur.

**Impact :** Plan 03-03/03-04 — pattern documenté. Tout wizard métier sensible (IRL, futur dépôt de garantie, futur changement de locataire) doit recalculer côté serveur à chaque étape, jamais faire confiance au draft client.
**Source :** 03-03-SUMMARY.md, 03-04-SUMMARY.md
