# Phase 7: Dashboard & Notifications d'échéances - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-11
**Phase:** 7-dashboard-notifications-d-ch-ances
**Areas discussed:** Composition dashboard + page racine, Périmètre des sources d'alerte V1, Modèle domaine alerte + canal + persistance, Workflow fin de bail

---

## Composition dashboard + page racine

### Q1 — URL et entrée principale du dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| `/` devient le dashboard | Remplacer le redirect de `racine.ts` (`/` → `/biens` ou `/wizard/bien`) par le rendering direct. Premier lancement → wizard. | ✓ |
| `/dashboard` dédié, `/` redirige | Nouvelle URL + hop. | |
| `/dashboard` dédié, `/` reste sur `/biens` | Sidebar item parmi d'autres. | |

**User's choice:** `/` devient le dashboard (recommandé).
**Notes:** Préserve le KPI Activation Phase 1 (premier lancement → wizard).

### Q2 — Sections du dashboard et ordre vertical

| Option | Description | Selected |
|--------|-------------|----------|
| Alertes critiques → Impayés → Actions du jour → Échéances loyer | Hiérarchie d'urgence top-down. | ✓ |
| Actions du jour en haut, le reste en dessous | Tout aplati dans une section unique. | |
| Sections par BC (Patrimoine / Locatif / Encaissements / Fiscalité) | Regroupement DDD — cache la hiérarchie d'urgence (viole success-criteria #2). | |

**User's choice:** Alertes critiques → Impayés → Actions du jour → Échéances loyer.
**Notes:** Aligné explicitement avec le success-criteria #2 ROADMAP (hiérarchie d'urgence visible sans drill-down).

### Q3 — Hiérarchie d'urgence visible (success-criteria #2)

| Option | Description | Selected |
|--------|-------------|----------|
| Code couleur tri-état + tri ASC par joursRestants | Réutilise les 3 variantes existantes `partial-bandeau-cfe-echeance.ejs` (destructive / warning-fort / warning). WCAG : libellé textuel obligatoire. | ✓ |
| Badges d'urgence sans coloration de fond | Plus sobre, badge textuel uniquement. | |
| Trois sous-sections par section (En retard / À venir / À jour) | Plus de pages, mais cases vides possibles. | |

**User's choice:** Code couleur tri-état + tri ASC par joursRestants.
**Notes:** Cohérence visuelle directe avec le banner CFE Phase 6 déjà déployé.

### Q4 — Volume affiché par section

| Option | Description | Selected |
|--------|-------------|----------|
| Top 5 par section + lien 'Voir tout' | Dashboard reste lisible si parc grandit. Liens vers `/impayes`, `/echeances`, etc. | ✓ |
| Exhaustif si < 20, sinon Top 5 | Adaptatif mais conditionnel. | |
| Toujours exhaustif | Risque page très longue. | |

**User's choice:** Top 5 par section + lien `Voir tout` vers la page dédiée existante.

---

## Périmètre des sources d'alerte V1

### Q1 — Périmètre V1 des sources d'alerte J-30/J-7

| Option | Description | Selected |
|--------|-------------|----------|
| Stricte ROADMAP DAS-02 | 4 sources : CFE + IRL + DPE/gaz/élec + fin de bail. Reste = V1.1. | ✓ |
| ROADMAP + justificatifs proches de 10 ans (DOC-03) | Ajoute purge légale. | |
| Périmètre maximal (+ tickets travaux cross-Bien) | Risque alourdir Phase 7. | |

**User's choice:** Stricte ROADMAP DAS-02.
**Notes:** Conforme sobriété V1 + déférés Phase 4 explicites.

### Q2 — Fenêtre J-30/J-7

| Option | Description | Selected |
|--------|-------------|----------|
| Fenêtre unique J-30 + J-7 fixée toutes sources | Aligné `alerte-cfe-j30.ts` FENETRE_ALERTE_JOURS = 30. Lisible, ROADMAP à la lettre. | ✓ |
| Fenêtres différentes par source | DPE J-90, fin de bail J-180, etc. — plus métier mais 4 constantes. | |
| Configurable par bailleur | Trop tôt V1. | |

**User's choice:** Fenêtre unique J-30 + J-7 fixée pour toutes les sources.

### Q3 — Statuts qui suppriment une alerte

| Option | Description | Selected |
|--------|-------------|----------|
| Filtres par source alignés aux invariants existants | CFE statut, IRL pas d'exercice courant + DPE non F/G, diagnostic dans la fenêtre, bail.actifDepuis non null. | ✓ |
| Toutes les alertes, l'utilisateur tri | Bruit. | |
| Filtres + flag 'déjà vue' persistant | Mélange filtres et acknowledgement (traité en zone 3). | |

**User's choice:** Filtres par source alignés aux invariants existants.
**Notes:** Pas de nouvelle table — les filtres consomment des invariants déjà persistés Phases 2-6.

### Q4 — Granularité de l'alerte 'diagnostic'

| Option | Description | Selected |
|--------|-------------|----------|
| 1 alerte par diagnostic par Bien (recommandé) | Jusqu'à 3 alertes distinctes par Bien (DPE/gaz/élec). Précis pour l'action. ERP exclu (validité illimitée). | ✓ |
| 1 alerte par Bien si ≥ 1 diagnostic expire | Compacte mais perd info type/date. | |
| 1 alerte par type tous Biens | Mauvais pour mono-Bien (cas V1 le plus courant). | |

**User's choice:** Une alerte par diagnostic par Bien.

---

## Modèle domaine alerte + canal + persistance

### Q1 — Modèle domaine de l'alerte

| Option | Description | Selected |
|--------|-------------|----------|
| Read-model unifié `Alerte` avec discriminant `type` | Interface partagée `_shared/alerte.ts`. 4 fonctions pures + agrégateur application. Partial banner unique. | ✓ |
| DTOs spécialisés par source | 4 types distincts (AlerteCfe, AlerteIrl, AlerteDiagnostic, AlerteFinBail) — duplication couche web. | |
| Une seule fonction monolithe | Viole la séparation par BC. | |

**User's choice:** Read-model unifié `Alerte` avec discriminant `type`.

### Q2 — Localisation des fonctions `calculerAlertes*` dans le domaine

| Option | Description | Selected |
|--------|-------------|----------|
| Chaque fonction dans son BC + interface Alerte partagée | Conforme DDD strict. Use case agrégateur dans `application/dashboard/`. | ✓ |
| Module `domain/alertes/` transverse | Casse l'attribution BC. | |
| Application layer uniquement | Viole `domaine pur` (alerte-cfe-j30.ts déjà dans domaine). | |

**User's choice:** Chaque fonction dans son BC + interface Alerte partagée.

### Q3 — Canal de notification V1

| Option | Description | Selected |
|--------|-------------|----------|
| Banner UI sur dashboard uniquement | Sobre, local-first, pas d'intégration externe. Conforme D-CFE6.5 Phase 6. | ✓ |
| Banner UI + lien mailto auto-rappel | Pattern Phase 2 relances. Plus interactif. | |
| Banner UI + cron email | Viole local-first + pattern Clock-driven. | |

**User's choice:** Banner UI sur dashboard uniquement.

### Q4 — Acknowledgement / dismiss / snooze

| Option | Description | Selected |
|--------|-------------|----------|
| Pas de dismiss : alerte vit tant que la condition métier est vraie | Source unique de vérité = invariant. Zéro état utilisateur, audit-friendly. | ✓ |
| Dismiss persistant | Table acquittement, logique de ré-ouverture, risque user cache et oublie. | |
| Snooze (reporter à J-7) | Solution intermédiaire complexe pour V1. | |

**User's choice:** Pas de dismiss.

---

## Workflow fin de bail

**Note méta** : à l'issue de la zone 3, l'utilisateur a répondu *"applique toutes tes recommandations pour les questions suivantes"*. Les 4 décisions ci-dessous reflètent les recommandations Claude, validées implicitement par cette directive.

### Q1 — Workflow renouvellement / clôture (recommandation appliquée)

| Option | Description | Selected |
|--------|-------------|----------|
| Alerte seulement, pas de workflow renouvellement | Scope creep évité. Pas de mutation du domaine `Bail`. | ✓ |
| Workflow minimal `renouveler / clôturer` | Ajoute `Bail.cloture`, mutation domaine, scope creep. | |

**User's choice (recommandation appliquée):** Alerte seulement, pas de workflow renouvellement.

### Q2 — Action target de l'alerte fin de bail (recommandation appliquée)

| Option | Description | Selected |
|--------|-------------|----------|
| `/baux/:id` (fiche Bail existante) | Phase 1 existant. L'utilisateur peut créer un nouveau Bail successeur depuis la fiche. | ✓ |
| Nouvelle page workflow renouvellement | Scope creep. | |

**User's choice (recommandation appliquée):** `/baux/:id` (fiche Bail existante Phase 1).

### Q3 — Fenêtre alerte fin de bail (recommandation appliquée)

| Option | Description | Selected |
|--------|-------------|----------|
| Fenêtre `[-30, +60]` miroir CFE | Au-delà de J+60 l'alerte disparaît. Cohérent CFE pattern. | ✓ |
| Fenêtre `[-30, +∞]` | Alerte indéfinie — bruit. | |

**User's choice (recommandation appliquée):** Fenêtre `[-30, +60]` miroir CFE.

### Q4 — Notion "bail successeur" / "bail clôturé" (recommandation appliquée)

| Option | Description | Selected |
|--------|-------------|----------|
| Différé V1.1 | Conforme MVP vertical slice. | ✓ |
| Implémenté V1 (Bail.successeur + Bail.cloture) | Scope creep majeur. | |

**User's choice (recommandation appliquée):** Différé V1.1.

---

## Claude's Discretion

L'utilisateur a explicitement délégué la zone "Workflow fin de bail" : *"applique toutes tes recommandations pour les questions suivantes"*. Les 4 décisions G4 reflètent les recommandations Claude.

Par ailleurs, plusieurs points sont laissés à la discrétion researcher / planner / executor (cf. `<decisions>` § Claude's Discretion dans CONTEXT.md) :

- Refactor `AlerteCfe → Alerte` au niveau domaine vs mapping application.
- Type exact de `Alerte.urlAction` (string brut vs route typée).
- Ancrage diagnostic spécifique (ancre HTML vs nouvelle route).
- Page transversale `/baux/indexations` (D-90 Phase 3 deferred) — création Phase 7 ou fallback liens directs.
- Helpers EJS (`formaterAlerteUrgence`, `iconeTypeAlerte`, `urlActionAlerte`).
- Mise en page CSS dashboard (relève UI-SPEC).
- Forme exacte du DTO `Alerte.source` (union typée discriminée vs interface générique).
- Fenêtre "mois courant + 1 mois" pour Échéances loyer à venir (sémantique précise).
- Entrée sidebar dédiée "Tableau de bord" (vs accès via logo).

## Deferred Ideas

### V1.1
- Notifications J-30/J-7 sur Justificatifs proches de 10 ans (DOC-03) — Phase 4 deferred.
- Dashboard tickets travaux cross-Bien — Phase 4 D-114 deferred.
- Vue agrégée documents générés cross-Bien — Phase 4 D-110 / D-111 deferred.
- Workflow renouvellement / clôture de bail.
- Concept "bail successeur".
- Snooze / dismiss persistant.
- Canal email mailto.
- Fenêtres J-X paramétrables par bailleur.
- SIM-01 / SIM-02 (simulateurs).

### V2
- Notifications push système OS natives.
- Service worker / background polling.
- Intégration iCal / .ics vers calendriers tiers.
- Cron + SMTP email.

### Hors planification
- Multi-bailleur dashboard agrégé (jamais — viole single-user).
- Tableau de bord comparatif inter-bailleur (jamais).
