# Phase 7 — Plan Outline : Dashboard & Notifications d'échéances

**Mode :** MVP (vertical slices) + TDD enforced (logique d'alerte = fonctions pures à I/O défini).
**Outline généré :** 2026-06-11
**REQs couverts :** DAS-01 (dashboard récap), DAS-02 (notifications J-30/J-7 sur 4 sources).

> Stratégie de découpage : le read-model `Alerte` unifié (D-AL-01) + le helper partagé
> `joursAvantEcheance` sont le contrat commun à toutes les sources → ils arrivent en
> **Wave 1** avec le refactor CFE (modèle exact à dupliquer, doit rester vert Phase 6).
> Les 3 nouvelles fonctions pures (IRL, fin-bail, diagnostic) sont des slices TDD
> indépendantes consommant ce contrat → **Wave 2** parallélisable (locatif vs patrimoine,
> fichiers disjoints). L'agrégateur application + l'UI dashboard composent le tout →
> **Wave 3**. La page transversale IRL + le polish a11y ferment → **Wave 4**.
>
> Aucune migration SQLite Phase 7 (calcul à la demande, D-AL-04). Aucune mutation de
> domaine. Pattern Clock-driven strict (anti-cron). `<threat_model>` STRIDE requis dans
> chaque PLAN.md (security_enforcement ENABLED) — surfaces lecture seule, frontière de
> confiance = HTTP `GET /` + `GET /baux/indexations` (no input non trusté hors path params).

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| 07-01 | Read-model `Alerte` unifié partagé + helper `joursAvantEcheance` + refactor `AlerteCfe → Alerte` (Phase 6 reste vert) | 1 | — | DAS-02 |
| 07-02 | Slice TDD `calculerAlertesIrl` + `calculerAlertesFinBail` (BC Locatif, fenêtres J-30 et [-30,+60], filtres gel DPE F/G + exercice courant + actifDepuis) | 2 | 07-01 | DAS-02 |
| 07-03 | Slice TDD `calculerAlertesDiagnostic` (BC Patrimoine, DPE/gaz/élec, ERP exclu, 1 alerte/diagnostic actif, fenêtre [-30,+30]) | 2 | 07-01 | DAS-02 |
| 07-04 | Use case agrégateur `calculerToutesAlertes` (4 sources, tri ASC global, Clock-driven, lecture seule) + builders + BDD agrégation | 3 | 07-01, 07-02, 07-03 | DAS-02 |
| 07-05 | Slice UI dashboard `GET /` : 4 sections empilées + partial unifié `partial-bandeau-alerte.ejs` + helpers EJS + sidebar + branche `estPremierLancement` | 3 | 07-04 | DAS-01, DAS-02 |
| 07-06 | Page transversale `GET /baux/indexations` (table IRL, filtre DPE F/G) + audit a11y axe-core (`/` + `/baux/indexations`) + tests intégration | 4 | 07-05 | DAS-01, DAS-02 |

## Détail des slices verticales

### 07-01 — Contrat `Alerte` + refactor CFE *(tdd dominant)*
- **Slice livrée :** le type partagé `Alerte` (D-AL-01) existe et `calculerAlertesCfe` (Phase 6) produit déjà des `Alerte[]` au lieu d'`AlerteCfe[]` — la source CFE est consommable par le futur agrégateur, et **toute la suite Phase 6 reste verte** (régression couverte). C'est l'enabler qui débloque les 3 sources suivantes.
- **Fichiers principaux :** `src/domain/_shared/alerte.ts` (nouveau — `TypeAlerte`, `Alerte`, `joursAvantEcheance`), `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` (refactor type retour + `AlerteCfe` alias), `src/application/fiscalite/lister-alertes-cfe-actives.ts` + route `src/web/routes/biens/cfe.ts` (adaptation accès `alerte.source.extra`), `tests/unit/fiscalite/alerte-cfe-j30.test.ts` (régression), `tests/_builders/alertes.ts` (nouveau builder).
- **TDD :** RED sur la nouvelle forme `Alerte` du retour CFE → GREEN refactor → régression Phase 6 verte. Décision « refactor au niveau domaine » (recommandation Claude's Discretion CONTEXT.md) à confirmer dans le plan.
- **Discriminant `Alerte.source` :** union typée discriminée (recommandation CONTEXT.md), `urlAction: string` brut V1.

### 07-02 — Alertes IRL + Fin de bail *(tdd dominant)*
- **Slice livrée :** deux fonctions pures du BC Locatif retournent des `Alerte[]` corrects sur leurs fenêtres respectives, 100 % couvertes BDD (logique juridique IRL = couverture obligatoire). Une fois fait, l'utilisateur sera alertable sur révision IRL et fin de bail.
- **Fichiers principaux :** `src/domain/locatif/alerte-irl.ts` (nouveau), `src/domain/locatif/alerte-fin-bail.ts` (nouveau), tests unitaires fast-check associés, `tests/bdd/features/alerte-irl.feature` + `alerte-fin-bail.feature` + steps.
- **Règles testées :** IRL fenêtre J-30/J-7, filtres `actifDepuis` + gel DPE F/G (D-78/D-92) + pas d'indexation exercice courant (D-SRC-03) ; fin de bail fenêtre `[-30,+60]` (D-SRC-05) + `actifDepuis` non null, `dateFinBail = dateDebut + dureeMois`.
- **Aucun import infra** (dependency-cruiser vert). Pas de mutation `Bail`.

### 07-03 — Alertes Diagnostic *(tdd dominant)*
- **Slice livrée :** fonction pure du BC Patrimoine retourne 1 alerte par diagnostic actif expirant (DPE/gaz/élec), ERP exclu (`dateExpiration === null`). Parallèle à 07-02 (fichiers patrimoine disjoints de locatif).
- **Fichiers principaux :** `src/domain/patrimoine/alerte-diagnostic.ts` (nouveau), tests unitaires, `tests/bdd/features/alerte-diagnostic.feature` + steps.
- **Règles testées :** ERP exclu (D-77/D-SRC-03), granularité 1 alerte par diagnostic actif (D-SRC-04), fenêtre `[-30,+30]`, déjà expiré visible (miroir D-80).
- **Aucun import infra.** Pas de mutation `Bien`/`Diagnostic`.

### 07-04 — Agrégateur transversal *(tdd / service dominant)*
- **Slice livrée :** le use case application `calculerToutesAlertes` charge les repos sources (lecture seule), appelle les 4 fonctions pures, fusionne + trie ASC global par `joursRestants`, retourne `Alerte[]`. C'est la donnée que le dashboard consommera. Déterminisme vérifié par BDD.
- **Fichiers principaux :** `src/application/dashboard/calculer-toutes-alertes.ts` (nouveau), extension `tests/_builders/alertes.ts` (builders multi-source), `tests/bdd/features/alerte-agregation.feature` + steps, wiring DI dans le composition root (`src/web/server.ts` ou équivalent — injection des repos + `Clock`).
- **Pattern :** miroir exact de `lister-alertes-cfe-actives.ts` (interface `Deps` + `clock.aujourdhui()` + `Promise.all` repos). Aucune implémentation infra importée dans le use case (interfaces domaine seulement).

### 07-05 — Dashboard UI `GET /` *(execute dominant)*
- **Slice livrée :** l'utilisateur ouvre `/` et voit les 4 sections empilées par urgence (Alertes critiques / Impayés / Actions du jour / Échéances loyer à venir), top 5 + `Voir tout`, hiérarchie tri-état couleur+texte+icône (WCAG 1.4.1). Branche `estPremierLancement → /wizard/bien` préservée (KPI Activation Phase 1).
- **Fichiers principaux :** `src/web/routes/racine.ts` (réécriture render dashboard + branche premier lancement), `src/web/views/pages/dashboard/accueil.ejs` (nouveau, 4 sections inline — pas de partial générique, sobriété V1), `src/web/views/partials/partial-bandeau-alerte.ejs` (nouveau, polymorphe sur `alerte.type`, reproduit à l'identique les 3 variantes de `partial-bandeau-cfe-echeance.ejs`), helpers EJS (`formaterAlerteUrgence`, `iconeTypeAlerte`, `libelleTypeAlerte`) en `preHandler`, `src/web/views/partials/sidebar-nav.ejs` (entrée « Tableau de bord » 1ère position, `navActive='dashboard'`), `tests/bdd/features/dashboard-composition.feature` + `dashboard-empty-state.feature` + `dashboard-premier-lancement.feature` + steps.
- **Composition use case :** branche les sources existantes Phase 2 (`listerImpayes`, `calculerRelanceDisponible`, `EcheanceLoyerRepository.listerAVenir`) + `calculerToutesAlertes` (07-04). Section « Actions du jour » = relances dues + sous-ensemble IRL J-30..J-0 (redondance S1/S3 intentionnelle, D-DASH-02 §3).
- **Migration optionnelle des partials Phase 3/6 :** adapter `biens/cfe.ts` et banner IRL vers le partial unifié si les tests restent verts ; sinon conserver les deux et noter dans `07-LEARNINGS.md` (D-AL-05).

### 07-06 — Page transversale IRL + a11y *(execute dominant)*
- **Slice livrée :** depuis le dashboard, `Voir tout` sur les révisions IRL ouvre `GET /baux/indexations` (table complète des baux dont la révision est due, DPE F/G exclus avec explication pédagogique R4.3). Audit a11y axe-core zéro violation sur `/` et `/baux/indexations`.
- **Fichiers principaux :** `src/web/routes/baux/indexations.ts` (ou extension plugin baux — route `GET /baux/indexations`), `src/web/views/pages/baux/indexations.ejs` (nouveau, table + `empty-state` + partial unifié `inline=true`), `tests/bdd/features/dashboard-baux-indexations.feature` + steps, `tests/integration/dashboard/` (axe-core sur les 2 routes), tests snapshot/print éventuels.
- **Données :** `calculerAlertesIrl` (07-02) en vue complète (pas de top 5). Aucune nouvelle route au-delà de `/baux/indexations`. Aucune nouvelle migration.

## Notes de planification

- **Couverture source audit (à détailler dans chaque PLAN.md) :** GOAL ✓ (4 success criteria couverts par 07-05 dashboard + 07-01..04 notifications + 07-06 action en un clic) · REQ ✓ (DAS-01 → 07-05/07-06 ; DAS-02 → 07-01..05) · RESEARCH/PATTERNS ✓ (17 analogs mappés, modèle CFE dupliqué) · CONTEXT ✓ (D-DASH-01..04, D-SRC-01..05, D-AL-01..05, D-FB-01..04 tous assignés). **Aucun item non planifié.** Items différés V1.1 (DOC-03 notifs 10 ans, tickets cross-Bien, snooze, email mailto, workflow renouvellement bail) **explicitement hors périmètre** (CONTEXT.md `<deferred>`).
- **TDD enforcement :** 07-01 à 07-04 sont des plans `tdd` (fonctions pures à I/O défini, logique fiscale/juridique = 100 % couverture obligatoire). 07-05 et 07-06 sont `execute` dominants (UI/EJS/glue) mais incluent des `.feature` BDD outside-in pour la composition et l'a11y.
- **Sécurité (rappel pour les PLAN.md) :** chaque plan portera un `<threat_model>` STRIDE. Surfaces principalement lecture seule ; vigilance I (Information Disclosure) sur les liens externes `rel="noopener noreferrer"` (déjà hérité Phase 6), T (Tampering) sur les path params `bienId`/`bailId` des routes d'action (validation Zod aux frontières HTTP, pattern hérité). Aucune action destructive, aucune écriture, aucune nouvelle surface d'injection.
- **Parallélisme :** Wave 2 = {07-02, 07-03} en parallèle (locatif vs patrimoine, fichiers disjoints). Wave 3 = 07-04 puis 07-05 (07-05 dépend de l'agrégateur 07-04 — séquentiel, pas parallèle car 07-05 a besoin du DTO trié). Si l'on veut maximiser le parallélisme, 07-04 et 07-05 peuvent rester séquentiels (07-05 consomme 07-04).

## OUTLINE COMPLETE
