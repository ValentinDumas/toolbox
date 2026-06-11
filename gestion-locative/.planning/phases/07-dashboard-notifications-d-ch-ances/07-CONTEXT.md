# Phase 7: Dashboard & Notifications d'échéances - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Langue:** Français (project response_language)

<domain>
## Phase Boundary

Phase 7 délivre **deux capacités** consolidant les échéances et signaux émis par
toutes les phases précédentes :

1. **Dashboard de la page d'accueil (DAS-01)** — vue synthétique en 4 sections
   empilées par priorité d'urgence : (a) **Alertes critiques** (banniers
   CFE/IRL/diagnostics/fin de bail en retard ou J-7), (b) **Impayés** ouverts
   (loyers en retard, consomme `listerImpayes` Phase 2), (c) **Actions du jour**
   (relances dues + IRL imminentes J-30..J-0), (d) **Échéances loyer à venir**
   (mois courant + 1 mois). Top 5 par section + lien `Voir tout`. Tri ASC par
   `joursRestants`. Hiérarchie d'urgence rendue par code couleur tri-état
   (réutilise les 3 variantes du `partial-bandeau-cfe-echeance.ejs` Phase 6).

2. **Notifications J-30 / J-7 sur 4 sources (DAS-02)** — **calcul à la demande**
   via `Clock` injecté (jamais de cron, jamais de `setInterval` — cohérent
   D-CFE6.5 Phase 6 + Pattern critique 4 Phase 3 D-90) :
   - **CFE** — paiement décembre (`DeclarationCfe.dateEcheancePaiement`, Phase 6).
   - **Révision IRL annuelle** — `Bail.dateAnniversaireProchaine(today)` (Phase 3 D-91).
   - **Expiration diagnostic** — `Diagnostic.dateExpiration` (DPE / gaz / élec ;
     ERP exclu car validité illimitée, Phase 3 D-77).
   - **Fin de bail** — `Bail.dateDebut + Bail.dureeMois` (Phase 1 D-29).

**REQs couverts (2)** : DAS-01 (Dashboard récap), DAS-02 (Notifications J-30/J-7).

**Bounded contexts touchés** :
- **`Fiscalité` (lecture seule)** — réutilise `calculerAlertesCfe()` existante
  Phase 6, ajoute interface `Alerte` partagée.
- **`Locatif` (extension légère)** — nouvelles fonctions pures domain
  `calculerAlertesIrl()` + `calculerAlertesFinBail()`. Pas de mutation des agrégats
  `Bail` ou `EtatDesLieux`.
- **`Patrimoine` (extension légère)** — nouvelle fonction pure
  `calculerAlertesDiagnostic()`. Pas de mutation `Bien` ou `Diagnostic`.
- **`Encaissements` (lecture seule)** — `listerImpayes`, `calculerRelanceDisponible`,
  `EcheanceLoyerRepository` consommés par l'agrégateur.
- **Application layer** — nouveau use case agrégateur
  `src/application/dashboard/calculer-toutes-alertes.ts` (transversal, lecture pure).

### Strictement hors périmètre Phase 7 (ne pas attraper en scope creep)

- **Notifications J-30/J-7 sur Justificatifs proches de 10 ans (DOC-03)** → V1.1.
  Différé Phase 4 (cf. `04-CONTEXT.md` deferred). Pas dans la formulation DAS-02 ROADMAP.
- **Dashboard 'tickets travaux en cours' cross-Bien** → V1.1 (Phase 4 D-114 deferred).
- **Vue agrégée 'documents générés' cross-Bien** (quittances, avis échéance,
  avenants IRL) → V1.1 (Phase 4 D-110/D-111 deferred).
- **Workflow de renouvellement / clôture de bail** → V1.1. Aucune mutation du
  domaine `Bail` Phase 7 (pas de flag `cloture`, pas de `Bail.successeur`).
- **Concept "bail successeur"** (lien parent/enfant entre baux successifs sur
  un même Bien) → V1.1.
- **Snooze / dismiss persistant d'une alerte** → V1.1 si retour utilisateur révèle
  le besoin. V1 = alerte vit tant que l'invariant métier est vrai.
- **Canal email mailto pour rappel d'alerte** → V1.1. V1 = banner UI seul.
- **Notifications push OS natives** (toast macOS/Windows/Linux) → V2.
- **Cron / service worker / background polling** → jamais (viole pattern
  Clock-driven D-CFE6.5).
- **Fenêtres J-X configurables par bailleur** → différé (viole sobriété V1).
- **Intégration iCal / .ics** vers calendriers tiers → non planifié.
- **Calcul d'IR + prélèvements sociaux** (sur résultat fiscal Phase 5/6) → V1.1
  (SIM-01).
- **Simulateur micro vs réel** (SIM-01) → V1.1.

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (Phases 1-6 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md) : LMNP meublé longue durée, local-first SQLite,
  DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in
  100 % couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1) : stack TS strict / Node 22 / Fastify / EJS /
  better-sqlite3 + Kysely / Vitest / Cucumber / fast-check / Money bigint centimes /
  Temporal API / Zod + fastify-type-provider-zod / pdfmake / Pico.css /
  ESLint + dependency-cruiser / pnpm.
- **D-44 → D-50** (Phase 1) : WCAG 2.1 AA opposable (couleur jamais seule, libellé
  obligatoire, role='alert' pour destructive, role='status' pour status).
- **D-55, D-66 → D-74** (Phase 2) : `Impaye` = calcul dérivé pur (D-55), pattern
  `calculerRelanceDisponible` (D-71), bannières via session (mais Phase 7 lit
  toujours à la demande — pas de session pour les alertes).
- **D-77** (Phase 3) : `DUREES_VALIDITE` (DPE 10 ans, gaz/élec 6 ans, ERP null =
  illimité). ERP **exclu** des alertes Phase 7.
- **D-78** (Phase 3) : `Bien.classeDpe` + `Bien.estGelLoyer()` (gel Climat F/G).
- **D-80** (Phase 3) : diagnostic expiré + bail actif = warning non bloquant.
  Phase 7 **ajoute** l'anticipation J-30/J-7.
- **D-90** (Phase 3) : banner IRL sur fiche `Bail` à la date anniversaire (calcul à
  la demande). Phase 7 **consolide** dans le dashboard global + ajoute une page
  transversale "Toutes les révisions IRL" si jugée utile par le planner.
- **D-91** (Phase 3) : `Bail.dateAnniversaireProchaine(today)` est la source
  canonique de la date d'alerte IRL.
- **D-CFE6.2 → D-CFE6.5** (Phase 6) : agrégat `DeclarationCfe`, fonction pure
  `calculerAlertesCfe()`, fenêtre `[-60, +30]`, statuts alertables
  `{non_deposee, deposee}`. **Modèle exact à dupliquer** pour les 3 nouvelles
  fonctions Phase 7.

### G1 — Composition dashboard + page racine (DAS-01)

- **D-DASH-01 — `/` devient le dashboard direct.** Remplace le redirect actuel
  (`racine.ts` : `/` → `/biens` ou `/wizard/bien`) par un rendering direct de la
  vue `pages/dashboard/accueil.ejs`. **Préservation du KPI Activation Phase 1** :
  si `estPremierLancement(db) === true`, on continue de rediriger vers
  `/wizard/bien` (parcours d'activation intact). Une fois 1 Bien + 1 Locataire +
  1 Bail créés, le dashboard prend la main.
- **D-DASH-02 — 4 sections empilées par ordre d'urgence (haut = priorité immédiate) :**
  1. **Alertes critiques** — banniers en retard (joursRestants < 0) ou J-7
     (joursRestants ≤ 7) toutes sources confondues. Affiche le partial unifié
     `partial-bandeau-alerte.ejs` (cf. D-AL-05).
  2. **Impayés** — `listerImpayes()` Phase 2, tri par `joursDeRetard` desc.
  3. **Actions du jour** — relances dues (`calculerRelanceDisponible() !== null`)
     + alertes IRL J-30..J-0 (sous-ensemble des Alertes critiques mais relistées
     ici pour rendre l'action `Lancer la révision` accessible). Pas de bug :
     même alerte peut apparaître en section 1 (vue d'ensemble urgente) ET en
     section 3 (action concrète à mener) — c'est intentionnel.
  4. **Échéances loyer à venir** — `EcheanceLoyer` du mois courant + 1 mois
     (`statut ∈ {en_attente, partiellement_payee}` ET
     `jourEcheanceAttendue > today`).
- **D-DASH-03 — Hiérarchie d'urgence : code couleur tri-état + tri ASC par
  joursRestants.** Réutilise rigoureusement les 3 variantes existantes du
  `partial-bandeau-cfe-echeance.ejs` :
  - **`destructive`** (rouge) : `joursRestants < 0` OU `joursRestants === 0`.
    `role='alert'`, `aria-live='assertive'`.
  - **`warning-fort`** (orange foncé) : `1 ≤ joursRestants ≤ 7`. `role='alert'`,
    `aria-live='assertive'`.
  - **`warning`** (orange clair) : `8 ≤ joursRestants ≤ 30`. `role='status'`,
    `aria-live='polite'`.
  Libellé textuel WCAG 2.1 AA obligatoire (`'Échéance dépassée depuis N jours'`,
  `'Échéance dans N jours'`, `'Échéance aujourd'hui'`) — la couleur n'est jamais
  seule (cf. ACCESSIBILITY.md).
- **D-DASH-04 — Top 5 par section + lien `Voir tout`.** Limite visuelle uniforme.
  Les liens `Voir tout` renvoient vers :
  - Alertes critiques → ancre intra-page (ou `/dashboard/alertes` si jugé utile
    planner).
  - Impayés → `/impayes` (existant Phase 2).
  - Actions du jour → split par type : relances → `/relances`, IRL → page
    transversale **nouvelle Phase 7** `/baux/indexations` (D-90 Phase 3 deferred,
    réutilise le `listerAlertesIrl()` agrégateur).
  - Échéances loyer → `/echeances` (existant Phase 2).

### G2 — Périmètre des sources d'alerte V1 (DAS-02)

- **D-SRC-01 — 4 sources strictes ROADMAP DAS-02.** CFE + IRL + DPE/gaz/élec +
  fin de bail. **Justificatifs proches de 10 ans (DOC-03), tickets travaux
  cross-Bien, documents générés agrégés cross-Bien** → différés V1.1 (cf.
  `<deferred>`). Conforme au principe de sobriété V1 (CLAUDE.md).
- **D-SRC-02 — Fenêtre unique J-30 + J-7 fixée pour toutes les sources.**
  Constante partagée `FENETRE_ALERTE_JOURS = 30` + palier interne `J-7` pour la
  variante `warning-fort`. Alignée `alerte-cfe-j30.ts` (`FENETRE_ALERTE_JOURS = 30`).
  Une constante par module domaine (fiscalité/cfe, locatif, patrimoine), revue
  annuelle si retour utilisateur. Pas de paramétrage utilisateur V1.
- **D-SRC-03 — Filtres par source alignés aux invariants existants :**
  - **CFE** : `statut ∈ {non_deposee, deposee}` (déjà Phase 6 D-CFE6.5).
    Exclus : `payee`, `exoneree_premiere_annee`, `exoneree_commune`.
  - **IRL** : aucune `BailIndexation` enregistrée sur l'exercice courant
    (`BailIndexationRepository.dernierExerciceAvecIndexation(bailId, today.year)
    === null`) **ET** `bien.classeDpe ∉ {'F', 'G'}` (gel Climat = pas d'alerte
    de révision — l'utilisateur ne peut pas indexer, inutile de bruiter).
    Cohérent avec D-92 Phase 3.
  - **Diagnostic (DPE / gaz / élec)** : diagnostic actif (le plus récent par
    type — Phase 3 D-79) avec `dateExpiration !== null` (exclut ERP) ET
    `dateExpiration ∈ [today, today + 30j]` (anticipation) OU `dateExpiration <
    today` (déjà expiré, miroir warning Phase 3 D-80 mais avec niveau d'urgence
    visible).
  - **Fin de bail** : `bail.actifDepuis !== null` (filtre les baux jamais activés
    Phase 2). Pas de filtre `bail.cloture` (n'existe pas V1).
- **D-SRC-04 — Granularité alerte diagnostic = 1 alerte par diagnostic actif par
  Bien.** Pour un Bien avec DPE + gaz + élec actifs, jusqu'à 3 alertes
  distinctes (chacune avec sa propre `dateExpiration` et son `joursRestants`).
  `urlAction` = `/biens/:id/diagnostics` (ancre vers le diagnostic spécifique
  laissée à la discrétion du planner — `#diag-{type}` ou route dédiée).
- **D-SRC-05 — Fenêtre alerte fin de bail = `[-30, +60]` miroir CFE.** Alerte
  affichée de J-30 à J+60. Au-delà de J+60, l'alerte disparaît (le bailleur a
  soit créé un nouveau bail successeur, soit la situation est inconnue de l'app —
  laisser l'alerte indéfiniment serait du bruit). Recommandation Claude
  appliquée par l'utilisateur ("applique toutes tes recommandations").

### G3 — Modèle domaine alerte + canal + persistance

- **D-AL-01 — Read-model unifié `Alerte` avec discriminant `type`.** Interface
  partagée dans `src/domain/_shared/alerte.ts` :
  ```ts
  export type TypeAlerte = 'cfe' | 'irl' | 'diagnostic' | 'fin_bail';
  export interface Alerte {
    readonly type: TypeAlerte;
    readonly joursRestants: number;       // peut être négatif
    readonly dateEcheance: Temporal.PlainDate;
    readonly libelle: string;             // pré-calculé côté domaine
    readonly urlAction: string;           // route Fastify vers l'écran d'action
    readonly source: {                    // discriminant union typé par TypeAlerte
      readonly type: TypeAlerte;
      readonly refId: string;             // DeclarationCfeId / BailId / DiagnosticId
      readonly bienId?: BienId;
      readonly extra?: Record<string, unknown>; // millesime CFE, classeDpe, etc.
    };
  }
  ```
  Permet tri ASC global sur `joursRestants` au niveau de l'agrégateur, rendu par
  un seul partial banner unifié, et extension future (V1.1) sans casser
  l'interface.
- **D-AL-02 — Localisation des fonctions calculer* alignée aux 6 BC :**
  - `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` — **existant Phase 6**, étendu
    pour produire `Alerte[]` au lieu de `AlerteCfe[]` (refactor : `AlerteCfe`
    devient un alias / un sous-type de `Alerte` pour préserver les use cases
    Phase 6 existants, OU adapter le mapping au niveau use case dashboard).
    **Choix planner** (cf. Claude's Discretion).
  - `src/domain/locatif/alerte-irl.ts` — **nouveau**. Fonction pure
    `calculerAlertesIrl(baux, biens, indexations, maintenant): Alerte[]`.
  - `src/domain/patrimoine/alerte-diagnostic.ts` — **nouveau**. Fonction pure
    `calculerAlertesDiagnostic(biens, maintenant): Alerte[]`.
  - `src/domain/locatif/alerte-fin-bail.ts` — **nouveau**. Fonction pure
    `calculerAlertesFinBail(baux, maintenant): Alerte[]`.
  - `src/application/dashboard/calculer-toutes-alertes.ts` — **nouveau use case
    transversal**. Charge les repos sources (CfeRepo, BailRepo, BienRepo,
    BailIndexationRepo), appelle les 4 fonctions pures, fusionne les `Alerte[]`,
    trie ASC par `joursRestants`, retourne le tableau global.
  Respect strict du DDD hexagonal : aucun import infra dans `domain/`.
- **D-AL-03 — Canal V1 = banner UI sur dashboard uniquement.** Pas d'email
  mailto, pas de cron, pas de push, pas de service worker, pas de notification
  système. Conforme :
  - **Vision local-first + autonome** (VISION.md, CLAUDE.md).
  - **Pattern Clock-driven** (D-CFE6.5 Phase 6 + Pattern critique 4 Phase 3 D-90).
  - **Sobriété V1** (R4.3 RISKS.md — pédagogie sans paternalisme).
  Robuste : zéro intégration externe (SMTP, calendrier, etc.). Le bailleur
  consulte son app en se connectant (single-user local).
- **D-AL-04 — Pas de dismiss / snooze / acknowledgement persistant.** L'alerte
  vit tant que la condition métier est vraie (snapshot Phase 6 anti-pattern #4
  + D-CFE6.5). Source unique de vérité = l'invariant. Zéro état utilisateur à
  persister, zéro nouvelle table SQLite, audit-friendly. L'utilisateur fait
  l'action métier (payer CFE / appliquer IRL / renouveler diagnostic / créer
  nouveau bail) → l'alerte disparaît automatiquement à la prochaine vue. Snooze
  V1.1 si retour utilisateur révèle le besoin.
- **D-AL-05 — Partial banner unifié.** Nouveau partial
  `src/web/views/partials/partial-bandeau-alerte.ejs` qui consomme `Alerte`
  polymorphe (sélectionne le libellé + le bouton d'action selon `alerte.type`).
  **Référence visuelle exacte** : `partial-bandeau-cfe-echeance.ejs` (3 variantes
  + role / aria-live + lien externe avec rel="noopener noreferrer"). Le partial
  Phase 6 reste en place pour la fiche `Bien` ; à la discrétion du planner de
  migrer ou de garder les deux (préférence : factoriser dans `partial-bandeau-alerte.ejs`
  et adapter `biens/cfe.ts` pour utiliser le nouveau partial — cohérence UI).
  `partial-indexation-banner.ejs` Phase 3 idem.

### G4 — Workflow fin de bail

- **D-FB-01 — V1 = alerte seulement, pas de workflow renouvellement / clôture.**
  Aucune mutation du domaine `Bail` Phase 7 (pas de flag `cloture`, pas de
  `Bail.successeur`, pas de `Bail.statut`). Scope creep évité — un workflow de
  renouvellement nécessiterait extension du domaine `Bail`, modification UI
  wizard, nouvelle migration, etc. Hors périmètre DAS-02 (qui demande
  seulement d'**alerter**, pas de gérer la fin).
- **D-FB-02 — Action target = `/baux/:id`.** L'alerte fin de bail renvoie vers
  la fiche Bail existante Phase 1. À cette fiche, l'utilisateur peut :
  - Soit créer manuellement un nouveau Bail successeur (workflow Phase 1
    existant via `/baux/nouveau`) — il devient le nouveau bail actif sur le Bien.
  - Soit ignorer (cas d'un mono-locataire qui reste, indéterminé V1).
  L'action ne **rien faire** est aussi un choix valide : l'alerte continuera de
  s'afficher jusqu'à J+60 puis disparaîtra.
- **D-FB-03 — Fenêtre fin de bail = `[-30, +60]` miroir CFE.** Décision D-SRC-05
  (recommandation appliquée).
- **D-FB-04 — Notion "bail successeur" / "bail clôturé" / "renouvellement
  automatique" → V1.1.** Différée explicitement. Cohérent avec la stratégie MVP
  vertical slice (PROJECT.md).

### Claude's Discretion (à trancher par researcher / planner / executor)

- **Refactor `AlerteCfe` → `Alerte`** : adapter `alerte-cfe-j30.ts` pour produire
  directement `Alerte` (modifier le type de retour) OU mapper `AlerteCfe → Alerte`
  au niveau de l'agrégateur application. Recommandation : refactor au niveau
  domaine (préserve un seul type partagé), tests Phase 6 à adapter mineurement.
- **Type exact de `Alerte.urlAction`** : `string` brut vs route typée (template
  literal type `\`/biens/${string}/cfe/${string}/editer\``) vs URL builder. V1 =
  `string` brut suffit (lisible, debug facile).
- **Ancrage diagnostic spécifique** : `/biens/:id/diagnostics#diag-{type}` (ancre
  HTML) vs nouvelle route `/biens/:id/diagnostics/:diagnosticId`. V1 = ancre
  HTML (zéro nouvelle route, suffit pour scroll).
- **Page transversale "Toutes les révisions IRL"** : créer `/baux/indexations`
  Phase 7 (D-90 Phase 3 deferred) — la page liste les baux dont
  `dateAnniversaireProchaine ≤ today` ET `bien.classeDpe ∉ {F, G}`. Recommandé,
  satisfait D-90 + permet une vraie action "Voir tout" depuis le dashboard. Si
  jugée trop ambitieuse, fallback : lien direct vers chaque fiche Bail concernée.
- **Découpage des migrations SQLite** : **aucune migration Phase 7** attendue
  (calcul à la demande, pas de table d'acquittement). À confirmer par le planner.
  Si la page `/baux/indexations` exige un nouveau repository, c'est de la
  lecture seule sur les tables existantes (`bail`, `bail_indexations`,
  `bien_diagnostics`) — aucune nouvelle migration.
- **Routes Fastify exactes** : recommandation `GET /` (dashboard), `GET
  /baux/indexations` (page transversale IRL). Plugin route :
  `src/web/routes/dashboard.ts`.
- **Helpers EJS** : `formaterAlerteUrgence(alerte)` (libellé textuel WCAG),
  `iconeTypeAlerte(alerte.type)` (DPE → 🏠, CFE → 📄, IRL → 📈, fin_bail → 📅 —
  ou variantes ASCII si choix sobre), `urlActionAlerte(alerte)` (= alerte.urlAction
  + helper de centralisation). À trancher planner / UI-SPEC.
- **Mise en page CSS dashboard** : grille / flow / wrap responsive — relève
  UI-SPEC Phase 7 (UI hint = yes dans ROADMAP).
- **Forme exacte du DTO `Alerte.source`** : union typée discriminée
  (`type='cfe' { declarationCfeId, millesime }` | `type='irl' { bailId,
  bienId, classeDpe }` | etc.) ou interface générique avec `extra: Record<>`. V1
  recommandation : union typée discriminée (type safety + auto-complétion EJS
  via TypeScript view types).
- **Quelle limite "mois courant + 1 mois" pour les Échéances loyer à venir** :
  fenêtre `[today, today.add({months: 2}).with({day: 1}).subtract({days: 1})]`
  ou simple `[today, today.add({days: 60})]`. À trancher planner — préférence
  pour la première (sémantique métier : "ce mois + le suivant").
- **`/baux/indexations` doit-il aussi rester accessible via la sidebar nav** ?
  Recommandation : non (l'accès se fait via le dashboard). Sidebar reste sobre
  (déjà 6 entrées + sous-menu Encaissements).

### Folded Todos

*(aucun — `todo.match-phase 7` → `todo_count = 0`)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, ui-researcher, executor) MUST read these.**

### Domaine produit / projet
- `.planning/PROJECT.md` — contraintes (hexagonal, Money bigint, Temporal,
  audit-friendly, ubiquitous language fr), 6 BC.
- `.planning/REQUIREMENTS.md` — **DAS-01, DAS-02** (V1). DOC-03 retention
  notifications = V1.1 deferred.
- `.planning/ROADMAP.md` §Phase 7 — **goal + 4 success criteria** (dashboard
  récap + hiérarchie urgence + notifs J-30/J-7 sur CFE/IRL/diagnostics/fin de
  bail + action en un clic). Dépend de Phases 2, 3, 6.
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD dashboard, notifications.
- `CLAUDE.md` — règles non négociables (V1 LMNP, domaine pur, doc commitée avec
  le code, ubiquitous language fr).

### Domaine fiscal LMNP / juridique
- `LMNP.md` — CFE échéance décembre.
- `LOCATION_MEUBLEE_REGLES.md` — bail meublé (`dureeMois ≥ 12`, fin de bail).
- `RISKS.md` — **R2.1** (alertes échéances — c'est la mitigation Phase 7),
  **R4.3** (pédagogie sans paternalisme — pas de dismiss persistant qui
  cacherait une alerte critique).

### Artefacts Phases 2-6 à respecter (MODÈLES À RÉUTILISER)
- `.planning/phases/06-liasse-2031-cfe/06-CONTEXT.md` — **D-CFE6.5 pattern
  banner Clock-driven** (modèle exact). **Source la plus importante pour Phase 7.**
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md`
  — D-77 (DUREES_VALIDITE diagnostics), D-78 (`Bien.classeDpe` + `estGelLoyer()`),
  D-80 (diagnostic expiré warning non bloquant), D-90 (banner IRL fiche Bail),
  D-91 (`Bail.dateAnniversaireProchaine`), D-92 (gel Climat F/G).
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-CONTEXT.md`
  — D-55 (Impaye = calcul dérivé pur), D-71 (`calculerRelanceDisponible`),
  pattern session bannières.
- `.planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md` — déférés
  explicites Phase 7 (vue agrégée documents générés, dashboard tickets travaux
  cross-Bien, notifs justificatifs 10 ans — tous **V1.1** ici).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` —
  patterns Phase 1 : factory `X.creer()`, brand types, builders, repository
  `versDomaine`/`versRow`.

### Pratiques opposables
- `practices/DDD.md` — 6 BC, agrégat / port / adapter, ubiquitous language fr.
- `practices/BDD_PRACTICES.md` — outside-in, **100 % couverture sur la logique
  fiscale** (alerte CFE = logique fiscale), scénario dédié par règle.
- `practices/SOFTWARE_CRAFTSMANSHIP.md` — gates CI (0 warning, ≥80 %, 100 %
  métier, cyclo < 10, suite < 30 s).
- `practices/UI_DESIGN.md` — hiérarchie visuelle (urgence), data tables, helpers
  fr, spacing 8 px.
- `practices/UX_DESIGN.md` — Hick / Fitts / Miller (top 5 par section), flow &
  nav, empty state, trust.
- `practices/ACCESSIBILITY.md` — **WCAG 2.1 AA** (couleur jamais seule,
  `role='alert'` pour destructive, `role='status'` pour status, libellé textuel
  obligatoire).

### Anti-patterns inviolables (rappel)
- **Pas de cron / setInterval / service worker** — pattern Clock-driven, calcul
  à la demande au point d'entrée HTTP (D-CFE6.5 + D-90).
- **Pas de mutation des snapshots Phases 5-6** — lecture seule absolue Phase 7.
- **Pas de nouveau BC `alertes`** — chaque fonction `calculer*` vit dans son BC
  d'origine, l'agrégation est un use case application.
- **Pas d'import technique dans `domain/`** — dependency-cruiser doit rester
  vert (cf. Phase 5.1 hardening hexagonal).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (NE PAS RÉ-IMPLÉMENTER)
- **`src/domain/fiscalite/cfe/alerte-cfe-j30.ts`** — **MODÈLE EXACT** :
  `joursAvantEcheance()`, `estAlerteActive()`, `calculerAlertesCfe()`,
  `FENETRE_ALERTE_JOURS = 30`, `STATUTS_ALERTABLES`. À dupliquer pour les 3
  nouvelles fonctions `calculerAlertesIrl` / `calculerAlertesDiagnostic` /
  `calculerAlertesFinBail`. Possible refactor : extraire `joursAvantEcheance()`
  dans `_shared/alerte.ts` (helper partagé).
- **`src/web/views/partials/partial-bandeau-cfe-echeance.ejs`** — **MODÈLE
  EXACT** des 3 variantes (destructive / warning-fort / warning) + role +
  aria-live + lien externe `rel="noopener noreferrer"`. À généraliser dans
  `partial-bandeau-alerte.ejs` consommant `Alerte` polymorphe (libellé + bouton
  d'action sélectionnés via `alerte.type`).
- **`src/web/views/partials/partial-indexation-banner.ejs`** — banner IRL fiche
  Bail Phase 3 D-90 existant. À factoriser dans le nouveau partial unifié OU à
  conserver pour la fiche Bail (le dashboard utilise le nouveau partial pour
  toutes les sources). Préférence : factoriser.
- **`src/domain/_shared/clock.ts`** — port `Clock` (Phase 1) pour injection à la
  demande dans les use cases dashboard.
- **`src/domain/_shared/duree-validite-diagnostic.ts`** — `DUREES_VALIDITE`
  (DPE 10 ans, gaz/élec 6 ans, ERP null = illimité). Source pour l'exclusion ERP
  des alertes diagnostic.
- **`src/domain/patrimoine/diagnostic.ts`** — `Diagnostic.dateExpiration` +
  `estExpire(today)`. Source pour `calculerAlertesDiagnostic()`.
- **`src/domain/patrimoine/bien.ts`** — `Bien.diagnostics: Diagnostic[]`,
  `Bien.diagnosticActif(type)` (D-79 Phase 3), `Bien.classeDpe` (D-78).
- **`src/domain/locatif/bail.ts`** — `Bail.dateAnniversaireProchaine(today)`
  (D-91), `Bail.dateDebut`, `Bail.dureeMois` (fin de bail = `dateDebut +
  dureeMois`), `Bail.actifDepuis` (Phase 2 D-51 — filtre fin de bail).
- **`src/domain/encaissements/impaye.ts`** — `listerImpayes(filtres, repos,
  clock)` + DTO `Impaye`. Consommé tel quel par la section Impayés du dashboard.
- **`src/application/encaissements/calculer-relance-disponible.ts`** — niveau
  relance disponible. Consommé par la section Actions du jour (relances dues).
- **`src/web/routes/racine.ts`** — **À RÉÉCRIRE** : remplace le redirect par un
  render dashboard. Conserve la branche `estPremierLancement → /wizard/bien`.
- **`src/web/views/partials/sidebar-nav.ejs`** — ajout d'une entrée
  "Tableau de bord" en première position (navActive='dashboard') OU pas d'entrée
  dédiée et `/` accessible depuis le logo (à trancher UI-SPEC).
- **Repositories sources existants** (lecture seule) : `DeclarationCfeRepository`
  (Phase 6), `BailRepository`, `BienRepository`, `BailIndexationRepository`
  (Phase 3), `EcheanceLoyerRepository`, `RelanceRepository`,
  `EncaissementRepository`, `LocataireRepository`.

### Established Patterns (à respecter)
- **Hexagonal strict** : nouveaux fichiers `domain/locatif/alerte-irl.ts`,
  `domain/patrimoine/alerte-diagnostic.ts`, `domain/locatif/alerte-fin-bail.ts`,
  `domain/_shared/alerte.ts` — **zéro import technique** (dependency-cruiser).
  Use case agrégateur `application/dashboard/calculer-toutes-alertes.ts` peut
  importer les repos (interfaces domaine) mais pas d'implémentations infra.
- **Fonctions pures domain** : Clock jamais accédé en interne, `maintenant:
  Temporal.PlainDate` passé en argument. Pattern strict `calculer*(donnees,
  maintenant): Alerte[]`.
- **Factory `X.creer()` + `InvariantViolated`** : N/A Phase 7 (aucun nouvel
  agrégat).
- **Pas de migration SQLite Phase 7** (calcul à la demande, aucune table
  d'acquittement).
- **Builders** `tests/_builders/` — étendre avec `alerteBuilder({type, joursRestants,
  ...})` pour les unit tests.
- **BDD outside-in** :
  - `dashboard-composition.feature` (4 sections + tri urgence + top 5).
  - `dashboard-empty-state.feature` (premier lancement → wizard, fallback dashboard).
  - `alerte-irl.feature` (fenêtre J-30/J-7, filtres gel DPE F/G + exercice
    courant, granularité par bail).
  - `alerte-diagnostic.feature` (DPE / gaz / élec, ERP exclu, fenêtre, 1 alerte
    par diagnostic actif).
  - `alerte-fin-bail.feature` (fenêtre `[-30, +60]`, bail.actifDepuis non null).
  - `alerte-cfe-deja-couverte.feature` (régression : pattern Phase 6 reste vert
    après refactor `AlerteCfe → Alerte`).
  - `alerte-agregation.feature` (read-model unifié, tri ASC global,
    déterminisme).
- **EJS layout-debut/fin + partials + helpers fr** ; Zod aux frontières HTTP.
- **WCAG 2.1 AA** : tests d'accessibilité automatisés (axe-core, déjà installé
  Phase 3) sur la page dashboard.

### Integration Points
- **Phase 6 → 7** : import `calculerAlertesCfe()` (extension produire `Alerte`),
  lecture `DeclarationCfeRepository`.
- **Phase 5/6 → 7** : pas de lecture des snapshots fiscaux Phase 5/6 (Phase 7 ne
  consomme PAS la liasse ni les `DeclarationAnnuelle`).
- **Phase 3 → 7** : `BienRepository.listerTous()` pour les diagnostics,
  `BailRepository.listerTous()` pour IRL + fin de bail, `BailIndexationRepository`
  pour filtrer IRL exercice courant. Le `partial-indexation-banner.ejs` Phase 3
  D-90 reste fonctionnel sur la fiche Bail OU est migré vers le partial unifié.
- **Phase 2 → 7** : `listerImpayes` (section Impayés), `EcheanceLoyerRepository`
  (section Échéances loyer à venir), `calculerRelanceDisponible` + `RelanceRepository`
  (section Actions du jour).
- **Phase 1 → 7** : `racine.ts` rénové, `sidebar-nav.ejs` augmenté,
  `estPremierLancement()` conservé.
- **Migration** : **aucune** Phase 7. La dernière migration reste `0022_phase6_*`.
- **Composition use case dashboard** :
  ```
  GET / →
    si estPremierLancement → redirect /wizard/bien
    sinon →
      impayes = listerImpayes(...)
      alertes = calculerToutesAlertes(repos, clock)   ← nouveau
      relancesAJour = listerRelancesDues(...)
      echeancesAVenir = listerEcheancesAVenir(...)
      render('dashboard/accueil', { impayes, alertes, ... })
  ```

</code_context>

<specifics>
## Specific Ideas

- **Pattern `calculerAlertesCfe()` (Phase 6) est canonique** — les 3 nouvelles
  fonctions doivent reproduire **exactement** sa structure : `joursAvantEcheance`,
  `estAlerteActive`, `calculerAlertes*`, `STATUTS_ALERTABLES` (par source),
  `FENETRE_ALERTE_JOURS = 30`, borne inférieure (`-60` CFE, `-30` IRL/diag,
  `+60` fin de bail comme borne SUPÉRIEURE inversée), tri ASC interne.
- **Read-model `Alerte` unifié explicite** (D-AL-01) — un partial banner
  unique + tri global trivial. La discrimination par `type` se fait dans le
  partial EJS via switch sur `alerte.type`.
- **Sobriété V1 stricte** (vision locale autonome + R4.3) : pas d'email, pas de
  cron, pas de dismiss persistant, pas de workflow renouvellement bail. Tout
  ajout demande retour utilisateur d'abord.
- **Action en un clic (success-criteria #4)** — `Alerte.urlAction` est une route
  Fastify atteignable. Mapping :
  - `type='cfe'` → `/biens/{bienId}/cfe/{declarationCfeId}/editer` (Phase 6
    existant).
  - `type='irl'` → `/baux/{bailId}/indexer` (Phase 3 existant).
  - `type='diagnostic'` → `/biens/{bienId}/diagnostics` + ancre `#diag-{type}`
    (à confirmer planner).
  - `type='fin_bail'` → `/baux/{bailId}` (fiche Bail Phase 1 existant).
- **Cucumber `.feature` minimaux par règle** (BDD 100 % logique fiscale CFE +
  conformité juridique IRL/diag) :
  - `dashboard-composition.feature`
  - `dashboard-empty-state.feature`
  - `alerte-irl.feature`
  - `alerte-diagnostic.feature`
  - `alerte-fin-bail.feature`
  - `alerte-cfe-deja-couverte.feature` (régression Phase 6)
  - `alerte-agregation.feature`
- **Helpers UI** : `formaterAlerteUrgence(alerte)` (libellé textuel WCAG),
  `iconeTypeAlerte(alerte.type)` (DPE / CFE / IRL / fin_bail — symbole sobre
  ASCII préféré au glyphe emoji), `urlActionAlerte(alerte)`.

</specifics>

<deferred>
## Deferred Ideas

### V1.1
- **Notifications J-30/J-7 sur Justificatifs proches de 10 ans (DOC-03)** —
  Phase 4 deferred ; pas dans la formulation DAS-02 ROADMAP. Mitigation R2.1
  rétention légale fiscale.
- **Dashboard "tickets travaux en cours" cross-Bien** — Phase 4 D-114 deferred.
- **Dashboard "tickets travaux par nature"** (préparation amortissement vs
  charge) — Phase 4 deferred. Lie potentiellement Phase 5 (qualification fiscale)
  + Phase 7.
- **Vue agrégée "documents générés" cross-Bien** (quittances, avis échéance,
  avenants IRL) — Phase 4 D-110 / D-111 deferred.
- **Workflow renouvellement / clôture de bail** — extension domaine `Bail`
  (`Bail.cloture`, `Bail.statut: 'actif' | 'cloture' | 'expire'`,
  `Bail.successeur: BailId | null`).
- **Concept "bail successeur"** — lien parent/enfant entre baux successifs sur
  même Bien.
- **Snooze / dismiss persistant d'une alerte** — si retour utilisateur révèle un
  besoin réel.
- **Canal email mailto** pour s'envoyer un rappel d'alerte — pattern Phase 2
  relances.
- **Fenêtres J-X configurables par bailleur** dans le profil — viole sobriété V1.
- **SIM-01 / SIM-02** — simulateur micro vs réel, plus-value de cession (LF 2025).

### V2
- **Notifications push système OS** (toast natif macOS / Windows / Linux).
- **Service worker / background polling** (si app déployée en service externe —
  viole pour l'instant local-first).
- **Intégration calendrier (iCal / .ics)** pour synchro échéances vers Google
  Calendar / Apple Calendar / Outlook.
- **Cron déclenchant un envoi email** (idem : nécessite SMTP, viole
  local-first + pattern Clock-driven).

### Phase 8+ ou non planifié
- **Multi-bailleur dashboard agrégé** — viole single-user V1 (jamais ?).
- **Tableau de bord comparatif inter-bailleur / benchmark** — jamais.

### Reviewed Todos (not folded)
*(aucun — `todo.match-phase 7` → `todo_count = 0`)*

</deferred>

---

*Phase: 7-dashboard-notifications-d-ch-ances*
*Context gathered: 2026-06-11*
*Décisions capturées: 18 (G1 Composition: 4, G2 Sources: 5, G3 Modèle/Canal/Persistance: 5, G4 Fin de bail: 4) + rappels verrouillés Phases 1-6*
