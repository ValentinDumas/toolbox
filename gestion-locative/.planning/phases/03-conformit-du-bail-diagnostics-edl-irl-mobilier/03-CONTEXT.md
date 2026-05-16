# Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier - Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Le système **garantit la conformité juridique du bail meublé** sur 4 axes :
1. **Diagnostics** (PAT-03) — stockage des DPE, gaz, élec, ERP avec date d'émission et date d'expiration calculée automatiquement selon la durée légale.
2. **État des lieux contradictoire** (LOC-03) — enregistrement EDL d'entrée et de sortie avec inventaire mobilier annexé (structure commune 12 items décret 2015-981).
3. **Indexation IRL** (LOC-04) — à la date anniversaire du Bail, l'app propose la révision, calcule le nouveau loyer, génère l'avenant PDF signable.
4. **Gel loyer Climat** (LOC-05) — toute indexation à la hausse est **refusée** si le DPE du Bien est classé F ou G (décret 2022-1313).
5. **Checklist mobilier** (LOC-06) — à la création/édition du Bail, vérification des 12 éléments obligatoires (décret 2015-981) avec signalement des manquants comme risque de requalification.

**REQs couverts (5)** : PAT-03 (Diagnostics), LOC-03 (EDL + Inventaire), LOC-04 (Indexation IRL → avenant), LOC-05 (gel DPE F/G), LOC-06 (checklist mobilier décret 2015-981).

**Bounded contexts touchés** :
- `Patrimoine` (extension : ajout sous-agrégat `Diagnostic` dans `Bien`, ajout `Bien.classeDpe`).
- `Locatif` (nouveaux agrégats : `EtatDesLieux` avec sous-entité `InventaireItem` ; extension `Bail` pour révision IRL : nouvelle table `bail_indexations`).
- Pas de nouveau BC. Tout s'ajoute aux contextes existants.

**Strictement hors périmètre Phase 3** (rappels — ne pas attraper en scope creep) :
- **Diagnostics par Lot** (gaz/élec installations séparées dans un immeuble) → V2 (cf. déférés).
- **Inventaire libre par pièce** (configurable user) → V2 (cf. déférés).
- **Vue diff UI côte à côte entrée/sortie** → Phase 4 ou plus (Phase 3 = listing simple).
- **PDF de l'EDL** → Phase 4 (Coffre documentaire). Phase 3 stocke et affiche en HTML uniquement.
- **Notifications J-30 / J-7** (expiration DPE, date anniversaire IRL, fin de bail) → Phase 7 (Dashboard & Notifications).
- **Calcul du montant de la retenue sur dépôt** à partir du delta d'état entrée/sortie → Phase 3.x ou plus. Phase 3 émet seulement un **warning textuel** "vérifier retenue" via domain service `comparerInventaires()`.
- **Intégration INSEE auto** pour récupération IRL (INS-01) → V1.1+ (saisie manuelle reste V1, cf. D-37 Phase 1).
- **Coffre documentaire** (justificatifs, recherche, rétention 10 ans, OCR) → Phase 4.
- **Tickets travaux / incidents** → Phase 4.
- **Bascule LMP, micro-BIC, amortissement, liasse 2031, CFE, plus-value** → Phases 5 et 6.
- **Indemnités d'occupation post-résiliation** → V2.
- **Procédure huissier détaillée** (enum contradictoire/huissier_bailleur/huissier_locataire) → V1.x.
- **Multi-bailleur, SCI, gestion déléguée** → jamais (V1 mono-user).
- **PDF avenant IRL en Phase 3 OU en Phase 4 ?** L'avenant est jugé **livrable Phase 3** (LOC-04 explicite : "le système génère l'avenant d'indexation signable") — il fait partie du workflow IRL. Le PDF EDL en revanche est différé Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (PROJECT.md / ROADMAP.md / Phases 1-2 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md) : LMNP location meublée longue durée uniquement, local-first SQLite, DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in 100% couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1 — `01-CONTEXT.md`) : Web local SSR (Fastify + EJS), 127.0.0.1 + port fixe + lockfile, multi-OS, Pico.css, **TypeScript strict, Node 22 LTS, Fastify, EJS via `@fastify/view`, better-sqlite3 + Kysely, Vitest, @cucumber/cucumber-js, fast-check, Money bigint centimes maison, Temporal API, Zod + fastify-type-provider-zod, pdfmake, Pico.css, ESLint + Prettier + dependency-cruiser, pnpm, pino, tsx, Mise**.
- **D-28 → D-43** (Phase 1) : Périmètre entités Bien/Lot/Locataire/Bail figé. `Bail.irlReference` (VO IRL) existe déjà. `Bail.actif_depuis` existe (D-51 Phase 2). `Bail.dureeMois` ≥ 12.
- **D-37** (Phase 1) : **Saisie manuelle de l'IRL V1** — l'utilisateur récupère la valeur sur insee.fr. Intégration INSEE auto = V1.1+ (INS-01 deferred).
- **D-38** (Phase 1) : `Bail` statuts incrémentaux par phase. Phase 3 introduit la notion **"indexable"** (= bail actif + date anniversaire atteinte + classe DPE compatible).
- **D-44 → D-50** (Phase 1) : Standards UI/UX/A11y opposables (WCAG 2.1 AA, 1 dominant/écran, spacing 8 px, color, typography, forms 1 colonne label-au-dessus + validation au blur, destructive = confirmation).
- **Patterns Phase 1 (`01-LEARNINGS.md`) à rejouer Phase 3** : factory `X.creer()` + `InvariantViolated`, brand types pour identifiants, builders `tests/_builders/`, TDD outside-in (BDD rouge → tests unit/integration rouges → green), repository `versDomaine`/`versRow` + `transaction()`, use case multi-repos pour cross-aggregate, EJS layout split `debut`/`fin`, partials configurables via `locals`, preHandler limité aux helpers pure (pas d'accès session), Money INTEGER cents (BigInt domaine), Temporal.PlainDate ↔ TEXT ISO, JSON inline pour VOs imbriqués.
- **D-51 → D-74** (Phase 2 — `02-CONTEXT.md`) : `Bail.actif_depuis`, `Bail.jour_echeance` (1..28), `EcheanceLoyer` snapshot complet, statuts dérivés (pas "en retard" stocké), modèle Encaissement N:1, soft-delete + compensateur, Quittance numérotée AAAA-NNN, Bailleur singleton mono-user. **Pattern D-73 (régénération des échéances futures `en_attente`/`partiellement_payee` lors d'une modification du Bail)** sera **réutilisé tel quel pour l'indexation IRL** (D-94 ci-dessous).
- **Patterns Phase 2 (Cautionnement JSON inline)** : confirme que les VOs imbriqués sont stockés en JSON inline sur la table de l'agrégat racine, pas dans une table séparée.

### Diagnostics (PAT-03)

- **D-75** : **Rattachement au `Bien` uniquement** V1. Diagnostics (DPE, gaz, élec, ERP) = établis sur le logement entier (DDT juridique = par logement, pas par parking). Modèle simple : `Bien.diagnostics: Diagnostic[]`. Per-Lot (immeubles de rapport avec installations séparées par appartement) = **reporté V2** (cf. déférés).
- **D-76** : **Diagnostic = sous-agrégat de `Bien`** (entité avec `DiagnosticId`, pas d'agrégat racine séparé, pas de `DiagnosticRepository`). Pattern identique à `Lot` (Phase 1 D-29). `BienRepository` gère tout. Pour Phase 7 (dashboard "diagnostics expirés"), ajouter `BienRepository.trouverBiensAvecDiagnosticsExpiresAvant(date)` — pas un nouveau repository.
- **D-77** : **Types fixes + durées légales codées dans le domaine.** `TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp'`. Constante `DUREES_VALIDITE: Record<TypeDiagnostic, { annees: number | null }>` (DPE: 10 ans, gaz: 6 ans, élec: 6 ans, ERP: validité illimitée — `null`). L'utilisateur saisit `date_emission`, le domaine calcule `date_expiration = date_emission + durees_validite[type].annees`. La constante est **versionneable LF annuelle** (revue chaque janvier post-loi de finances, R1.1 RISKS.md).
- **D-78** : **`Bien.classeDpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null`** — champ explicite sur l'agrégat `Bien`, mis à jour quand un nouveau `Diagnostic` de type `'dpe'` est ajouté (le planner décide entre méthode `Bien.ajouterDiagnostic()` qui sync automatiquement OU un handler dédié — recommandation : la méthode `ajouterDiagnostic()` qui maintient la cohérence dans l'agrégat). Permet `Bien.estGelLoyer(): boolean` (= `classeDpe ∈ {'F', 'G'}`) consommable par le domain service IRL sans JOIN.
- **D-79** : **Historique complet conservé.** `Bien.diagnostics[]` contient tous les diagnostics (anciens + nouveaux), tri par `date_emission desc`. Le "diagnostic actif" par type = le plus récent non expiré (index 0 du tri). **Raison fiscale** : trace l'évolution DPE avant/après travaux pour justifier la qualification fiscale des dépenses (amélioration vs entretien) lors de la Phase 5 (amortissement par composant) et pour la plus-value LF 2025. Domain service : `Bien.diagnosticActif(type: TypeDiagnostic): Diagnostic | null`.
- **D-80** : **Diagnostic expiré + bail actif = warning non bloquant.** Badge rouge sur la fiche `Bien` et `Bail` + bandeau d'info textuel. **Jamais bloquant** sur quittancement, encaissement, ou indexation IRL. Aligné vision sobre + autonome (pas paternaliste). Les notifications J-30/J-7 (anticipation expiration) sont **Phase 7**.

### EtatDesLieux + Inventaire (LOC-03)

- **D-81** : **Inventaire = liste fixe des 12 items du décret 2015-981 + état + note.** Structure : `InventaireItem = { typeItem: TypeItemInventaire, present: boolean, etat: 'bon' | 'moyen' | 'degrade' | null, note: string | null }`. Couvre **LOC-03** (EDL avec inventaire) ET **LOC-06** (checklist 12 items) dans **une seule structure**. Pas de dualité ChecklistBail / InventaireEDL.
- **D-82** : **Un seul agrégat `EtatDesLieux` avec type discriminant.** `EtatDesLieux = { id, bailId, type: 'entree' | 'sortie', dateEdl: PlainDate, contradictoire: boolean, dateSignature: PlainDate | null, inventaire: InventaireItem[] }`. Une seule classe TS, un seul repository, comparaison entrée↔sortie facile (même type → `edl.comparerAvec(autreEdl)`). Si une "retenue sur dépôt" devient un sous-agrégat distinct plus tard (V2), elle sera modélisée séparément (`RetenueDépôt`), pas par clonage d'`EtatDesLieux`.
- **D-83** : **`contradictoire: boolean` + `dateSignature: PlainDate | null`**. Suffit V1. "Non contradictoire" = procédure huissier (notaire pas concerné — il intervient en vente). La distinction huissier_bailleur / huissier_locataire = **reportée V1.x** (cf. déférés).
- **D-84** : **EDL de sortie permissif.** L'EDL sortie peut être enregistré avant `Bail.dateDebut + dureeMois` (cas courant : locataire qui rend les clés en pré-avis). Warning informatif si `dateEdl < dateDebut + dureeMois` ("EDL de sortie enregistré avant la fin officielle du bail — vérifie que tu as bien la situation réelle"). Jamais bloquant.
- **D-85** : **EDL d'entrée absent au moment de l'EDL sortie = warning non bloquant.** Message : *"Pas d'EDL d'entrée enregistré pour ce bail — la comparaison entrée/sortie ne sera pas possible et la retenue sur dépôt sera plus difficile à justifier."* L'utilisateur reste libre de continuer (cas : EDL papier hors système).
- **D-86** : **Inventaire JSON inline sur `etat_des_lieux`.** Colonne `inventaire: TEXT (JSON array of InventaireItem)`. Pattern Cautionnement Phase 1 (D-33). 12 items max = payload de quelques ko. Pas de JOIN, pas de table `inventaire_items`. Lecture/écriture en un round-trip. Sérialisation : `JSON.stringify(items)` / `JSON.parse(row.inventaire)`.
- **D-87** : **PDF de l'EDL = différé Phase 4** (Coffre documentaire). Phase 3 = stocker + afficher en HTML (page `/baux/:id/edl/entree` et `/baux/:id/edl/sortie`). L'utilisateur peut imprimer la page HTML s'il veut une trace papier V1.
- **D-88** : **Comparaison visuelle entrée vs sortie (vue diff UI) = différée Phase 4+.** Phase 3 = listing simple : la fiche `Bail` affiche un encart "État des lieux" avec 0 / 1 / 2 EDL et liens vers chacun. **Mais le calcul du delta** (domain service `comparerInventaires()` qui génère des warnings de dégradation item par item) **est inclus Phase 3** — c'est de la logique métier pure, pas de l'UI.
- **D-89** : **1 EDL d'entrée + 1 EDL de sortie maximum par bail** (invariant métier). Use case `EnregistrerEDL` vérifie cross-aggregate. Correction = soft-delete + nouvel EDL (pattern D-60 Phase 2 : `annule_le: PlainDate | null` + `raison_annulation: string`).

### Workflow IRL & Indexation (LOC-04)

- **D-90** : **Banner sur la fiche `Bail` à la date anniversaire.** Quand `aujourdHui >= bail.dateDebut + N × 1 an` ET la dernière indexation enregistrée < `aujourdHui - 1 an` (ou aucune indexation), la fiche Bail affiche un banner discret : *"Révision IRL disponible depuis le {date_anniversaire}. Cliquer pour lancer."* Page dédiée transversale "Révisions IRL" listant tous les baux à réviser = **Phase 7 (Dashboard)**, pas Phase 3.
- **D-91** : **Workflow 5 étapes :**
  1. **Banner** sur la fiche `Bail` ("Révision IRL disponible").
  2. **Saisie** du nouvel IRL (trimestre + valeur via VO `IRL` déjà existant — réutilisation D-37 Phase 1). L'utilisateur le récupère manuellement sur insee.fr.
  3. **Simulation** : l'app calcule `nouveau_loyer_hc = loyer_actuel × (IRL_nouveau.valeur / IRL_référence.valeur)` (formule légale loi 89 art. 17-1) et affiche la comparaison (loyer avant / loyer après / différence). Arrondi banker's sur le résultat en centimes (réutilisation DP-10 Phase 2).
  4. **Confirmation** par l'utilisateur (bouton "Appliquer la révision" OU "Ne pas indexer cette année" — cf. D-95).
  5. **Application** : `Bail.loyerHc` mis à jour + `Bail.irlReference` pivoté vers IRL nouveau + `EcheancesLoyer` futures régénérées + nouvelle ligne dans `bail_indexations` + **avenant PDF** disponible au téléchargement.
- **D-92** : **Gel loyer Climat = blocage dur.** Si `Bien.classeDpe ∈ {'F', 'G'}` à l'étape 2 du workflow, le formulaire affiche un message bloquant : *"Gel loyer Climat actif (DPE {classe}). Toute hausse de loyer est interdite (décret 2022-1313, prorogé). L'indexation ne peut pas être appliquée."* Bouton "Compris" (pas de bypass). Conforme LOC-05 "**le système refuse**". Protectif : sanctionne le risque de requalification que le bailleur prendrait. **Bail.irlReference reste inchangé** dans ce cas (pas de pivot — la prochaine vérification annuelle re-tentera la révision si le DPE s'est amélioré entre-temps).
- **D-93** : **Avenant PDF — mentions obligatoires loi 89.** Contenu minimal :
  - Référence au bail original (numéro/identifiant, date de signature, parties : Bailleur + Locataire).
  - Ancien loyer HC.
  - IRL de référence original (trimestre + valeur).
  - IRL nouveau (trimestre + valeur).
  - Nouveau loyer HC calculé (formule rappelée pour transparence).
  - Date d'effet (= date d'anniversaire du Bail, **pas** la date du clic).
  - Clause de signature ("Les parties acceptent la révision ci-dessus").
  - Lieux pour signature (Bailleur / Locataire).
  - Généré via **pdfmake** (réutilisation pattern Phase 2 quittance/avis/relance).
  - **Persistance fichier local** dans `~/.../gestion-locative/documents/avenants/{annee}/avenant-{bailIdCourt}-{date}.pdf` (cohérent avec D-63 Phase 2 stockage quittances).
- **D-94** : **Effet de l'application d'une indexation IRL :**
  1. `Bail.loyerHc` = `nouveau_loyer_hc` calculé.
  2. `Bail.irlReference` = IRL nouveau (pivot — sert de référence pour la prochaine révision N+1).
  3. **Régénération des `EcheanceLoyer` futures** (`statut = 'en_attente'` ou `'partiellement_payee'` ET `periode_debut >= date_effet_indexation`) — pattern strict D-73 Phase 2. Les échéances passées et payées restent intactes (immutables, opposables fiscalement).
  4. Une nouvelle ligne dans **table `bail_indexations`** (cf. D-96).
  5. Avenant PDF généré et stocké.
  6. Use case `AppliquerIndexationIRL` orchestre les 5 étapes dans une transaction Kysely unique (pattern Phase 1 `transaction()`).
- **D-95** : **Option "Ne pas indexer cette année".** À l'étape 4 du workflow, en plus du bouton "Appliquer la révision", un bouton secondaire "Ne pas indexer cette année" est affiché avec un paragraphe explicatif :

  > *Vous pouvez renoncer à la révision annuelle. Le loyer reste inchangé. L'IRL de référence est tout de même mis à jour afin que la prochaine révision parte de la bonne base (sinon vous resteriez bloqué indéfiniment sur l'ancien indice).*

  Si l'utilisateur choisit "Ne pas indexer" : `Bail.loyerHc` **inchangé** ; `Bail.irlReference` = IRL nouveau (pivot) ; ligne dans `bail_indexations` avec `indexation_appliquee = false` ; **pas d'avenant PDF** généré ; pas de régénération d'échéances. Le bailleur conserve son droit (en droit, l'indexation est une faculté, pas une obligation).
- **D-96** : **Table dédiée `bail_indexations`** :
  ```
  bail_indexations {
    id,
    bail_id (FK),
    date_effet: PlainDate,
    irl_avant_trimestre, irl_avant_valeur,
    irl_apres_trimestre, irl_apres_valeur,
    loyer_avant_centimes (BigInt),
    loyer_apres_centimes (BigInt),
    indexation_appliquee: boolean,
    raison_non_application: string | null,  -- null si appliquée ; 'gel_dpe' / 'refus_bailleur' sinon
    cree_le: PlainDate
  }
  ```
  Append-only (jamais d'UPDATE). Queryable Phase 5 (historique des recettes, justification hausse de loyer pour la liasse 2031).

### Checklist mobilier (LOC-06)

- **D-97** : **Structure unique `InventaireItem` partagée** entre la checklist Bail et l'inventaire EDL (cf. D-81). Le `Bail` stocke une liste d'`InventaireItem` minimaliste (présence seulement, état et note non pertinents à la création du bail) ; l'EDL stocke la même structure mais avec état rempli. Une seule définition TS, une seule validation.
- **D-98** : **LOC-06 vérifié uniquement à la création/édition du `Bail`** — **invariant DDD de l'agrégat `Bail`**. Lors du `Bail.creer()` ou `Bail.modifier()`, si la checklist a des items obligatoires marqués `present: false`, le domaine **signale** (pas bloque) le risque de requalification via un domain event ou un avertissement retourné par la factory. Pas de re-déclenchement dans `EtatDesLieux.creer()` (DDD : pas de cross-aggregate invariant). **Complément léger Phase 3** : lors de la création de l'EDL d'entrée, le domain service `creerEDLEntree` peut émettre un warning textuel non bloquant si des items obligatoires sont `present: false` ("X éléments du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé."). Domain service, pas invariant.
- **D-99** : **Sémantique double du champ `present`** selon le `type` de l'EDL :
  - **EDL d'entrée** : `present = true` signifie *"l'item est fourni par le bailleur au locataire"*. Warning si item obligatoire (décret 2015-981) marqué `present: false`.
  - **EDL de sortie** : `present = true` signifie *"l'item est encore là (rendu par le locataire)"*. Warning si item était `present: true` à l'entrée et `present: false` à la sortie ("Item manquant retour, potentielle retenue sur dépôt à examiner").

  Même structure de données (`InventaireItem`), domain service `comparerInventaires(edlEntree, edlSortie)` gère les warnings spécifiques selon le contexte.
- **D-100** : **Enum `TypeItemInventaire` codé en dur V1** dans `src/domain/locatif/inventaire-item.ts` (liste complète décret 2015-981 — 12 valeurs). Map `LABELS_ITEM_INVENTAIRE: Record<TypeItemInventaire, string>` pour l'affichage français. **Gestion en BD** (table `inventaire_items` admin CRUD permettant d'ajouter/modifier les items si la législation évolue) = **déféré V1.x** (cf. déférés). Si le décret change avant V1.x, mise à jour par PR + commit.
- **D-101** : **Delta état (domain service) inclus Phase 3 ; vue diff UI différée Phase 4.** Domain service `comparerInventaires(edlEntree, edlSortie): Warning[]` parcourt les items et génère des warnings :
  - Item présent entrée + absent sortie → `WARNING_ITEM_DISPARU` ("vérifier retenue").
  - Item présent entrée + état_sortie < état_entrée (bon→moyen, bon→dégradé, moyen→dégradé) → `WARNING_ITEM_DEGRADE` ("vérifier retenue, dégradation : {avant} → {après}").
  - Item absent entrée + présent sortie → ignoré (le locataire a ajouté du mobilier ? cas rare, non bloquant).

  Ces warnings sont **affichés sur la fiche EDL de sortie** (texte simple, pas de tableau côte à côte). La **vue diff UI** (tableau HTML côte à côte avec indicateurs visuels) = **Phase 4+** (cf. déférés).

### Décisions différées au `gsd-plan-phase 3`

- **DP-14** : Méthode exacte de synchronisation `Bien.classeDpe` ↔ ajout de `Diagnostic` DPE (recommandation : méthode `Bien.ajouterDiagnostic(d)` qui maintient l'invariant interne, plutôt qu'un handler externe).
- **DP-15** : Stockage de `Bien.diagnostics[]` — table dédiée `diagnostics` (recommandation : 1 row par diagnostic, FK `bien_id`, pas de JSON inline ici car queryable Phase 7 dashboard).
- **DP-16** : Formule exacte d'arrondi du calcul IRL (réutilisation D-72/DP-10 Phase 2 — banker's sur centimes du résultat final, pas accumulation).
- **DP-17** : Routes Fastify Phase 3 (recommandation : `/biens/:id/diagnostics`, `/baux/:id/edl/entree`, `/baux/:id/edl/sortie`, `/baux/:id/indexer`).
- **DP-18** : Pré-handler EJS spécifique Phase 3 (helpers `formaterClasseDpe(classe)`, `formaterTypeDiagnostic(type)`, `formaterEtatItem(etat)`).
- **DP-19** : Découpage des migrations SQLite (recommandation : `0003_phase3_init.sql` couvrant `diagnostics`, `etat_des_lieux`, `bail_indexations` + ALTER `bien` (ajout `classe_dpe`) ; OU plusieurs migrations atomiques par plan — à trancher selon le découpage des plans).
- **DP-20** : Mécanisme de détection de la date anniversaire (recommandation : domain service `dateAnniversaireProchaine(bail, today)` qui retourne la prochaine date d'anniversaire à partir d'aujourd'hui, calcul à la demande sans cron).

### Claude's Discretion (à trancher par le planner / executor)

- Convention de nommage exact des routes Fastify Phase 3.
- Structure des partials EJS Phase 3 (`partial-diagnostic-row`, `partial-edl-form`, `partial-inventaire-checklist`, `partial-indexation-banner`).
- Choix précis des libellés et placeholders d'inputs.
- Politique de placement du calcul `nouveau_loyer = loyer × (IRL_apres / IRL_avant)` (domain service vs méthode de `Bail` — recommandation : méthode `Bail.simulerIndexation(irlNouveau): { nouveauLoyer, gelLoyer }` qui encapsule la règle métier dans l'agrégat).
- Format exact du fichier PDF de l'avenant (mise en page pdfmake).
- Encoding des accents dans le nom de fichier PDF (UTF-8, slug ASCII).

### Folded Todos

*(aucun — pas de todo.match-phase exécuté ; à ré-évaluer en planning si besoin)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-ui-researcher`, `gsd-executor`) MUST read these before planning or implementing.**

### Domaine produit / projet

- `.planning/PROJECT.md` — contraintes verrouillées, bounded contexts (Patrimoine + Locatif), key decisions, principes directeurs, hors-périmètre.
- `.planning/REQUIREMENTS.md` — REQs PAT-03, LOC-03, LOC-04, LOC-05, LOC-06 (V1) + traceability par phase.
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, dépendances (Phase 1).
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD : cible, périmètre MVP, principes UX.

### Phases 1-2 (artefacts à respecter)

- `.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md` — décisions verrouillées D-01 → D-50 (stack technique, statut Bail, périmètre entités, standards UI/UX/A11y) + en particulier D-37 (IRL saisie manuelle V1).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` — patterns établis (factory + InvariantViolated, brand types, builders, repository transaction, EJS layout split, preHandler pure, Money cents, Temporal roundtrip, **Cautionnement JSON inline** = directement applicable à `Inventaire` D-86) + surprises Fastify/Cucumber/EJS/Zod.
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-CONTEXT.md` — D-51 → D-74 (extension Bail `actif_depuis`/`jour_echeance`, snapshot complet `EcheanceLoyer`, soft-delete + compensateur, Bailleur singleton, **D-73 pattern régénération des échéances futures** = réutilisé pour indexation IRL D-94).

### Domaine fiscal / juridique LMNP

- `LMNP.md` — base de connaissances fiscale LMNP (importante pour la traçabilité plus-value via DPE historique D-79 — anticipation Phase 5 amortissement par composant et plus-value LF 2025 réintégration des amortissements).
- `LOCATION_MEUBLEE_REGLES.md` — règles juridiques :
  - **§1 (définition meublé)** + **§2 (mobilier minimum décret 2015-981, 12 éléments exhaustifs)** — fondement de l'enum `TypeItemInventaire` D-100 et du warning de requalification.
  - §3.1 (bail meublé classique : durée 1 an min) — déjà géré Phase 1.
  - §3.3 (clauses obligatoires bail — IRL, état des lieux) — fondement workflow Phase 3.
  - **§6 (état des lieux contradictoire — loi 89 art. 3-2)** — fondement EDL D-82, D-83.
  - **§7 (DDT — dossier de diagnostic technique : DPE, gaz, élec, ERP, amiante, plomb)** — fondement Diagnostic D-75 → D-80.
  - §9.1 (mentions obligatoires bail) — déjà géré Phase 1/2 mais à respecter dans l'avenant IRL (D-93).
  - §11 (documents à conserver 10 ans) — diagnostics, EDL, avenants → cohérence avec stockage local (Phase 4 coffre).
- **Loi 89-462 art. 3-2** — état des lieux contradictoire (motive D-82, D-83).
- **Loi 89-462 art. 17-1** — formule légale de révision IRL (`nouveau = ancien × IRL_nouveau / IRL_référence`) (motive D-91 étape 3).
- **Décret n° 2015-981 du 31/07/2015** — liste des 12 éléments mobilier obligatoires (motive D-81, D-100).
- **Décret n° 2022-1313** — gel loyer Climat (DPE F/G) (motive D-92, LOC-05).
- **Code de l'énergie L173-1-1 et suivants** — classes énergétiques DPE A-G (motive D-78 `Bien.classeDpe`).
- **Durées légales de validité des diagnostics** :
  - DPE : **10 ans** (Code de la construction et de l'habitation L126-26).
  - Diagnostic gaz : **6 ans** (R134-6 CCH).
  - Diagnostic élec : **6 ans** (R134-10 CCH).
  - ERP : validité **illimitée** (sauf changement situation), mais doit être annexé à chaque bail.

### Pratiques d'ingénierie (opposables)

- `DDD.md` — bounded contexts, agrégats, ports & adapters, ubiquitous language français, tactical patterns (entité, VO, agrégat, **sous-agrégat** — utile pour `Diagnostic` dans `Bien` D-76 et `InventaireItem` dans `EtatDesLieux` D-81), repository, domain service (utile pour `comparerInventaires` D-101 et `dateAnniversaireProchaine` DP-20), anti-patterns.
- `BDD_PRACTICES.md` — outside-in, pyramide tests, **cas obligatoires §8** (à appliquer aux 4 axes Phase 3 : calcul date_expiration diagnostics par type, formule IRL, gel DPE F/G, delta état entrée/sortie, checklist obligatoire), data builders, **port `Clock`** (déterminisme indispensable pour les dates anniversaires et expirations — réutiliser le port `Clock` Phase 1).
- `SOFTWARE_CRAFTSMANSHIP.md` — SOLID, Clean Code, KISS/DRY/YAGNI, code review checklist, **gates CI bloquants §8** : 0 warning, ≥80 % coverage, 100 % logique métier, cyclomatic < 10, suite unitaire < 30 s. Les nouveaux agrégats/sous-agrégats Phase 3 doivent passer 100 % couverture (calcul IRL = logique fiscale, gel DPE = règle juridique impérative).

### Pratiques UI / UX / Accessibilité (opposables)

- `UI_DESIGN.md` — Gestalt, hiérarchie visuelle (1 dominant/écran : la fiche EDL avec ses 12 items), color (rouge = obligatoire absent / warning DPE expiré, ambre = avenir gel DPE / warning sur-paiement, vert = item présent / état bon), typography, spacing 8 px, **feedback states (banner "Révision IRL disponible" vs "Gel loyer Climat actif")**, **data tables (page Diagnostics et historique des indexations IRL doivent suivre les standards Phase 1 D-41)**.
- `UX_DESIGN.md` — Hick / Fitts / Miller / Jakob / Doherty laws, flow & navigation (sidebar gauche fixe Phase 1 — ajout d'une entrée "Diagnostics" sous le `Bien` et "État des lieux" sous le `Bail` ou en sidebar), forms (saisie Diagnostic = 1 colonne, label au-dessus, validation au blur ; saisie IRL = formulaire dédié à 2 champs trimestre+valeur), **error handling** (cas gel DPE = blocage explicatif, pas de friction inutile), **empty states** ("Aucun diagnostic pour ce bien — ajouter DPE/gaz/élec/ERP"), affordance (banner cliquable révision IRL), cognitive load (le workflow IRL en 5 étapes = wizard linéaire), **trust & transparency** (formule de calcul IRL affichée pendant la simulation).
- `ACCESSIBILITY.md` — WCAG 2.1 AA : POUR principles, contrast 4.5:1, keyboard nav (le wizard IRL = entièrement tabulable), semantic HTML, ARIA (sparingly — `aria-live` pour le warning de comparaison EDL et le banner de révision IRL), **forms (saisie IRL, saisie Diagnostic, checklist mobilier)**, **tables (liste diagnostics du Bien, historique bail_indexations)**, motion respecting `prefers-reduced-motion`, testing checklist.
- `BEHAVIOR.md` — code of conduct par session : posture sceptique, speed levers (parallel calls, allowlist, no trivial agents, tight prompts, cache discipline). Gain particulier Phase 3 : 3 zones distinctes (Diagnostics / EDL / IRL) peuvent être planifiées en plans parallélisables wave (après extension du `Bien` pour `classeDpe`).

### Risques & contraintes

- `RISKS.md` — registre des risques pertinents Phase 3 :
  - **R1.1** (surveillance fiscale annuelle) — les durées légales D-77 et la liste décret D-100 doivent être versionnées et revues chaque janvier post-LF.
  - **R2.1** (alertes échéances) — le banner révision IRL D-90 est une mitigation directe ; les notifications J-30/J-7 (Phase 7) consolideront.
  - **R2.x** (gel loyer Climat) — D-92 est la mitigation directe contre l'indexation illégale.
  - **R3.1** (backup) — les PDF avenants stockés (D-93) doivent être inclus dans le périmètre du backup futur (Phase BAK).
  - **R4.3** (pédagogie fiscale + juridique) — l'UI doit afficher les motifs (gel DPE, requalification, retenue) de manière compréhensible (D-95 paragraphe explicatif "Ne pas indexer", D-98 warning EDL entrée).
- `CLAUDE.md` — règles non négociables projet (top priority V1 LMNP meublé, principes directeurs **audit-friendly + sobre**, hors périmètre).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phases 1-2)

- **`src/domain/_shared/identifiants.ts`** — Brand types (`BienId`, `LotId`, `LocataireId`, `BailId`, `EcheanceLoyerId`, `EncaissementId`, `QuittanceId`, `RelanceId`, `BailleurId`). **À étendre** avec `DiagnosticId`, `EtatDesLieuxId`, `BailIndexationId` + leurs générateurs `nouveauXxxId()`.
- **`src/domain/_shared/erreurs.ts`** — `InvariantViolated`. Réutilisé tel quel.
- **`src/domain/_shared/clock.ts`** — port `Clock`. Indispensable Phase 3 pour les dates anniversaires (workflow IRL D-90, D-91), les expirations diagnostics (D-77, D-80), et les comparaisons date EDL (D-84).
- **`src/domain/_shared/irl.ts`** — VO `IRL { trimestre, valeur }` (D-37 Phase 1). Réutilisé tel quel pour D-91 (saisie IRL nouveau lors de l'indexation) et D-94 (pivot `Bail.irlReference`).
- **`src/domain/_shared/money.ts`** — VO Money en BigInt centimes + `Money.multiplyByFraction(num, den)` (ajouté Phase 2 DP-10). **Réutilisé** tel quel pour le calcul `loyer × (IRL_apres / IRL_avant)` lors de l'indexation (D-91 étape 3).
- **`src/domain/patrimoine/bien.ts`** — Agrégat `Bien`. **À étendre Phase 3** :
  - Ajouter `diagnostics: Diagnostic[]` (sous-agrégat D-76).
  - Ajouter `classeDpe: ClasseDpe | null` (D-78).
  - Ajouter méthode `ajouterDiagnostic(d: Diagnostic): Bien` (copy-on-write Phase 1 pattern + maj `classeDpe` si DPE).
  - Ajouter méthode `diagnosticActif(type: TypeDiagnostic): Diagnostic | null` (D-79).
  - Ajouter méthode `estGelLoyer(): boolean` (D-92).
- **`src/domain/patrimoine/bien-repository.ts`** — port. **À étendre** : méthode pour requêter les biens avec diagnostics expirés (anticipation Phase 7 D-80).
- **`src/domain/locatif/bail.ts`** — Agrégat `Bail`. **À étendre Phase 3** :
  - Ajouter méthode `dateAnniversaireProchaine(today: PlainDate): PlainDate` (DP-20).
  - Ajouter méthode `simulerIndexation(irlNouveau: IRL, classeDpeBien: ClasseDpe | null): { nouveauLoyerHc: Money, gelLoyer: boolean, raison?: string }` (D-91 étape 3 + D-92).
  - Ajouter méthode `appliquerIndexation(irlNouveau: IRL, dateEffet: PlainDate): Bail` (D-94 pivot irlReference + nouveau loyer).
  - Ajouter méthode `verifierChecklistMobilier(): ChecklistResult` (D-98).
  - Note : `Bail` continue de référencer `irlReference: IRL` (D-94 = remplacement direct).
- **`src/infrastructure/db/database.ts`** — `ConnexionDb`. Réutilisé pour les nouvelles tables (`diagnostics`, `etat_des_lieux`, `bail_indexations`).
- **`src/infrastructure/repositories/bien-repository-sqlite.ts`** — adapter Kysely. **À étendre** : sérialisation `diagnostics[]` (recommandation : table dédiée `diagnostics` avec FK `bien_id` — pas JSON inline, car queryable Phase 7 ; cf. DP-15) + ALTER `bien` (ajout `classe_dpe`).
- **`src/web/views/partials/`** — partials Phase 1/2 (form-field, data-table, confirm-dialog, sidebar-nav, breadcrumbs, empty-state, banniere-success). **Réutilisés** pour les pages `/biens/:id/diagnostics`, `/baux/:id/edl/entree`, `/baux/:id/edl/sortie`, `/baux/:id/indexer`. Étendre `sidebar-nav` avec les nouveaux liens (Diagnostics sous Bien, EDL sous Bail).
- **`src/helpers/format-*.ts`** — helpers existants (formatDate, formatMoney, formatPeriode). **À étendre** avec `formaterClasseDpe`, `formaterTypeDiagnostic`, `formaterEtatItem`, `formaterTrimestreIRL` (DP-18).

### Established Patterns (Phases 1-2)

- **Hexagonal strict** : `domain/patrimoine/diagnostic.ts`, `domain/locatif/etat-des-lieux.ts`, `domain/locatif/inventaire-item.ts` (ou `domain/_shared/`) sans aucun import technique. Vérifié par dependency-cruiser.
- **Factory + InvariantViolated** : chaque nouveau agrégat/sous-agrégat (`Diagnostic`, `EtatDesLieux`, `InventaireItem`) expose `X.creer(props)` qui valide les invariants (ex: `Diagnostic.creer({ type, dateEmission })` calcule `dateExpiration` selon `DUREES_VALIDITE[type]`).
- **Brand types** : nouveaux identifiants suivent le pattern `DiagnosticId = string & { readonly __brand: 'DiagnosticId' }`.
- **Builders** : `unDiagnosticValide`, `unEtatDesLieuxEntreeValide`, `unEtatDesLieuxSortieValide`, `unInventaireItemValide`, `uneBailIndexationValide` dans `tests/_builders/`.
- **TDD outside-in** : chaque plan exécution démarre par `test(NN-NN): ... rouge` (BDD Cucumber + Vitest interne).
- **Repository pattern** : `versDomaine(row)` + `versRow(entity)` + `transaction()` quand multi-table (use case `AppliquerIndexationIRL` modifie `bail` + `echeances_loyer` + insère `bail_indexations` → 1 transaction).
- **Use case multi-repos** : pour `EnregistrerEDL`, le use case prend `BailRepository` + `EtatDesLieuxRepository` et vérifie l'invariant cross-aggregate D-89 (≤1 EDL entrée + ≤1 EDL sortie par bail).
- **Migration ALTER** : ajout colonnes par fichier `0003_phase3_*.sql` exécuté via `sqlite.exec()` (pas Kysely brut — Phase 1 LEARNING multi-statements).
- **Money roundtrip SQLite** : `Number(money.toCentimes())` écriture, `Money.fromCentimes(BigInt(row.x))` lecture (réutilisé pour `bail_indexations.loyer_avant_centimes` / `loyer_apres_centimes`).
- **Temporal.PlainDate roundtrip** : `.toString()` (TEXT ISO) écriture, `Temporal.PlainDate.from(row.x)` lecture (utilisé pour `dateEmission`, `dateExpiration`, `dateEdl`, `dateSignature`, `dateEffet`).
- **IRL roundtrip SQLite** : pattern à confirmer (colonnes plates `trimestre` + `valeur` recommandées — cohérent avec D-96 table `bail_indexations`).
- **JSON inline pour VOs imbriqués** : pattern Cautionnement (Phase 1 D-33) **directement applicable à `InventaireItem[]`** dans la colonne `etat_des_lieux.inventaire` (D-86).
- **Layout EJS split** : `layout-debut.ejs` + `layout-fin.ejs` pour toutes les nouvelles pages. Réutiliser tel quel.
- **preHandler pure** : seuls les helpers de format injectés (formatDate, formatMoney, formatPeriode + ajouter formaterClasseDpe etc.). Toute donnée stateful gérée route par route.
- **Schema Zod** : `bail-schemas.ts`-style, `fastify-type-provider-zod` + `z.string().email()` côté HTTP. Pour les checkboxes multiples (12 items inventaire), réutiliser le pattern `z.union([z.string(), z.array(z.string())]).transform(...)` (Phase 1 LEARNING `lotIds`).
- **PDF pdfmake** : pattern déjà utilisé (Quittance, Avis échéance, Mise en demeure Phase 2). **Réutilisé** pour l'avenant IRL (D-93).
- **Stockage fichiers PDF local** : `~/.../gestion-locative/documents/{type}/{annee}/...` (D-63 Phase 2). **Réutilisé** pour `documents/avenants/{annee}/`.

### Integration Points

- **Sidebar nav** (`src/web/views/partials/sidebar-nav.ejs`) — ajouter "Diagnostics" sous la section Bien (ou en sous-page de la fiche Bien). État des lieux sera accessible depuis la fiche Bail. La révision IRL est accessible via banner sur la fiche Bail.
- **Fiche Bien** (`src/web/views/pages/biens/[id].ejs`) — ajouter une section "Diagnostics" listant les diagnostics actifs + bouton "Ajouter un diagnostic" + indicateur classe DPE coloré.
- **Fiche Bail** (`src/web/views/pages/baux/[id].ejs`) — ajouter une section "État des lieux" (0/1/2 EDL avec liens), un banner conditionnel "Révision IRL disponible", une section "Historique des indexations" listant `bail_indexations`.
- **Schémas Zod** — nouveaux fichiers `diagnostic-schemas.ts`, `edl-schemas.ts`, `indexation-schemas.ts`.
- **Migration SQLite** — fichier `0003_phase3_init.sql` (recommandation DP-19) crée 3 tables (`diagnostics`, `etat_des_lieux`, `bail_indexations`) + ALTER `bien` ajout `classe_dpe`.

</code_context>

<specifics>
## Specific Ideas

- **Pattern Lot (Phase 1 D-29)** explicitement choisi comme modèle pour `Diagnostic` (sous-agrégat de `Bien`, pas d'agrégat racine séparé) — cohérence DDD avec ce qui existe (D-76).
- **Pattern Cautionnement (Phase 1 D-33)** explicitement choisi comme modèle pour `InventaireItem[]` (JSON inline sur la table `etat_des_lieux`) — cohérence pattern Phase 1/2 (D-86).
- **Pattern D-73 Phase 2 (régénération des échéances futures lors de la modification du Bail)** explicitement réutilisé pour l'effet d'une indexation IRL (D-94 étape 3).
- **VO IRL existant** (Phase 1 D-37) — réutilisation telle quelle, pas d'extension (D-91 étape 2, D-94 pivot).
- **Mise à jour automatique de `Bien.classeDpe`** lors de l'ajout d'un Diagnostic DPE choisie pour la performance (LOC-05 gel = check pur sur `Bien.classeDpe` sans JOIN) et l'invariant cohérent dans l'agrégat (D-78).
- **Historique complet des diagnostics** (pas de remplacement) choisi pour la traçabilité plus-value LF 2025 — preuve documentaire de l'évolution énergétique avant/après travaux (D-79).
- **Avenant PDF mentions obligatoires loi 89** explicitement choisi plutôt qu'une simple notification — valeur juridique probante (D-93).
- **Option "Ne pas indexer cette année" avec pivot IRL** explicitement choisie — le bailleur peut renoncer (faculté, pas obligation) mais le pivot évite le blocage indéfini (D-95).
- **Blocage dur gel DPE F/G** (pas de bypass utilisateur) explicitement choisi — protection contre l'indexation illégale qui exposerait le bailleur à requalification + sanctions (D-92).

</specifics>

<deferred>
## Deferred Ideas

Idées soulevées pendant la discussion qui n'entrent pas dans le périmètre Phase 3. Ne pas perdre.

### V1.1 / V1.x

- **Procédure huissier détaillée pour EDL non contradictoire** — enum `'contradictoire' | 'huissier_bailleur' | 'huissier_locataire'` au lieu d'un simple bool. Ajoutable V1.x si besoin réel (D-83).
- **Gestion en BD des items inventaire (admin CRUD)** — table `inventaire_items` permettant d'ajouter/modifier les items obligatoires sans toucher au code (utile si la législation évolue). V1 = enum codé en dur, V1.x = config dynamique (D-100).
- **Intégration INSEE auto pour récupération IRL** — INS-01 deferred Phase 1 (D-37). V1.1+.
- **Override utilisateur des templates** (notamment l'avenant IRL) dans `~/.../gestion-locative/templates/avenant.ejs`. Reporté V1.x cohérent avec D-70 Phase 2 (templates relances).

### V2

- **Diagnostics par Lot** (gaz/élec installations séparées dans un immeuble de rapport avec plusieurs appartements + compteurs individuels). Pour V2 — cas multi-lots avec installations distinctes nécessite une modélisation à 2 niveaux (Bien.diagnostics[] généraux + Lot.diagnostics[] spécifiques).
- **Inventaire libre par pièce avec items configurables** — l'utilisateur crée ses pièces (salon, chambre 1, cuisine, sdb) et liste les éléments. Plus expressif mais UX complexe (drag, ajout, ordre), dépasse les 12 items obligatoires. V2 si besoin de richesse documentaire ; V1 reste sur les 12 fixes.
- **Indemnités d'occupation post-résiliation** — locataire qui occupe après fin de bail. V2.

### Phase 3.x ou Phase 4+

- **Vue diff UI côte à côte entrée vs sortie** — tableau HTML avec colonnes "item | état entrée | état sortie | variation". Phase 4+ (le calcul de delta est lui inclus Phase 3 via domain service D-101).
- **Calcul du montant de la retenue sur dépôt** à partir des warnings de dégradation. Phase 3.x ou plus — Phase 3 émet seulement des warnings textuels "vérifier retenue" via `comparerInventaires()`.
- **PDF de l'EDL (entrée et sortie)** — Phase 4 (Coffre documentaire). Phase 3 = stockage et affichage HTML uniquement (D-87).

### Phase 7

- **Notifications J-30 / J-7** sur expiration des diagnostics, dates anniversaires de Bail (révision IRL), expiration DPE (passage en F/G qui activerait le gel). Phase 7 (Dashboard & Notifications).
- **Page transversale "Révisions IRL"** listant tous les baux à réviser cross-Bien. Phase 7 (D-90).
- **Dashboard diagnostics expirés** cross-Bien — utilise la méthode `BienRepository.trouverBiensAvecDiagnosticsExpiresAvant(date)` ajoutée Phase 3 (D-76, D-80).

</deferred>

---

*Phase: 3-Conformité du bail — Diagnostics, EDL, IRL, Mobilier*
*Context gathered: 2026-05-16*
