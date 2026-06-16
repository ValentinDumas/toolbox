# Phase 9: Finition qualité — clôture UAT & réconciliation des statuts - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Clore le reliquat qualité v1.0. Deux volets, **aucune nouvelle capacité produit** :

- **QUA-01** — Exécuter les 12 scénarios d'UAT humaine de la liasse 2031/CFE (Phase 06, `06-UAT.md`, restés `paused`/`pending`). Chaque écart constaté est traité, scénario repassé au vert.
- **QUA-02** — Réconcilier les statuts de suivi *stale* avec l'état réel du code : UAT des Phases 02/03 et sessions de debug `g1`/`g4`/`g8`, aujourd'hui encore `diagnosed`/`paused` alors que les correctifs sont livrés.

Out of scope : toute modification de comportement produit non requise par un écart UAT bloquant ; la dette technique (consolidation CFE, `calculerAlertesIrl`, transaction Kysely) appartient à la Phase 10.
</domain>

<decisions>
## Implementation Decisions

### Méthode d'exécution UAT (QUA-01)
- **D-01 : Exécution hybride.** Automatiser via Playwright tout ce qui est mécaniquement vérifiable (cold start / smoke, présence des blocs et cases avec numéro+libellé+valeur, drill-down sources, bandeaux de réconciliation/rectificatif, déclenchement des téléchargements PDF/CSV, badges et banner CFE J-30 / 3 variantes, création+édition déclaration CFE). Laisser à l'humain (bailleur) la confirmation **perceptuelle** : le PDF s'ouvre réellement et est lisible, les accents s'affichent correctement dans Excel/LibreOffice, aucune cellule CSV ne commence par `=`/`+`/`-`/`@`. Couverture maximale, temps humain minimal.

### Réconciliation des statuts (QUA-02)
- **D-02 : Réconciliation pure, pas de bug-fixing.** Vérification code faite pendant la discussion : les **4 défauts diagnostiqués sont déjà corrigés** dans le code courant (voir Code Insights). Le volet QUA-02 consiste donc à mettre à jour les statuts, pas à livrer des correctifs.
- **D-03 : Preuve = re-test live ciblé + référence code.** Pour passer chaque statut de `diagnosed` à `resolved` : (1) rejouer dans l'app le scénario concret de l'issue (saisie invalide → erreur inline 4xx ; clic relance → mail s'ouvre ; CTA conditionnel ; pas de bannière dupliquée ; Bien créable sans Locataire/Bail), **et** (2) citer le commit / `file:line` du fix. Double preuve comportement + trace code. On ne rejoue **pas** intégralement les UAT 02/03 (redondant) — uniquement les issues concernées.

### Traitement des écarts découverts pendant l'UAT liasse
- **D-04 : Tri par gravité.** Défaut **bloquant** (chiffre fiscal faux, case manquante, export cassé/corrompu, crash) → corrigé dans la Phase 9, scénario repassé au vert. Défaut **cosmétique non-bloquant** (CSS, libellé) → consigné en backlog, scénario marqué *pass-with-note*. Garde la phase focalisée sur la justesse fiscale, pas l'esthétique.

### Consignation / traçabilité
- **D-05 : Mise à jour en place + rapport consolidé.** Mettre à jour les fichiers d'origine (`06-UAT.md`, `02-UAT.md`, `03-UAT.md`, `.planning/debug/g1|g4|g8-*.md`) pour qu'ils reflètent l'état réel, **et** produire un rapport Phase 9 consolidé qui pointe vers eux (état des 12 scénarios + table de réconciliation des statuts stale avec preuve). Cohérent avec le principe « audit-friendly » du projet.

### Claude's Discretion
- D-05 (lieu de consignation) tranché par Claude par défaut, validé implicitement faute d'objection. Format exact du rapport consolidé laissé au planner/exécutant.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UAT à exécuter / réconcilier
- `.planning/phases/06-liasse-2031-cfe/06-UAT.md` — les 12 scénarios liasse 2031/CFE (statut `paused`, tous `pending`). Source de QUA-01.
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md` — statut `diagnosed`, 4 issues à réconcilier.
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UAT.md` — PASS avec 1 résidu humain (annonce lecteur d'écran).
- `.planning/phases/04-coffre-documentaire-travaux/04-HUMAN-UAT.md` — déjà `resolved` (témoin de l'état cible).

### Sessions de debug à clore
- `.planning/debug/g1-validation-500-json.md` — validation 500 JSON (statut `diagnosed`).
- `.planning/debug/g4-banniere-flash-dupliquee.md` — bannière dupliquée / CTA vide (statut `diagnosed`).
- `.planning/debug/g8-relance-mailto-pas-ouvert.md` — relance mailto (statut `diagnosed`).

### Exigences
- `.planning/REQUIREMENTS.md` — QUA-01, QUA-02 (libellés exacts).
- `.planning/ROADMAP.md` §Phase 9 — critères de succès (4 conditions vraies).
</canonical_refs>

<code_context>
## Existing Code Insights

### Correctifs déjà livrés (vérifiés pendant la discussion — base de la réconciliation QUA-02)
- **g1 (validation 500 → erreurs inline)** : CORRIGÉ. `src/main.ts:238-248` (global `setErrorHandler`) + `src/web/routes/wizard.ts:100-119,169-191,289-321` (try/catch sur les 3 étapes wizard, re-render avec `erreurs`).
- **g4 (bannière dupliquée / CTA vide)** : CORRIGÉ. Includes `banniere-success` redondants supprimés, bannière centralisée `layout-debut.ejs:29` ; CTA rendu conditionnellement.
- **g8 (relance mailto)** : CORRIGÉ. `src/web/routes/relances.ts:116-125` (page intermédiaire) + `src/web/views/pages/relances/ouverture-mail.ejs:23` (auto-trigger JS + lien fallback).
- **scope_change (Locataire/Bail optionnels)** : CORRIGÉ. `src/web/routes/wizard.ts:121-126` + boutons « Terminer — ajouter locataire et bail plus tard » (`wizard/bien.ejs:108`, `wizard/locataire.ejs:80`).

### Reusable Assets
- Skill `qa-pass` / Playwright MCP : pilote l'UI pour la partie automatisable de l'UAT hybride.
- `/gsd-verify-work 6` : canal de consignation des résultats humains pour les scénarios perceptuels.

### Integration Points
- App server-rendered (Fastify + Kysely + SQLite), `pnpm dev`. Migration `0023_phase6_declaration_cfe.sql` (scénario 1 cold start). Routes `/fiscalite`, `/fiscalite/declarations/:id/liasse`, fiche bien (section CFE).
</code_context>

<specifics>
## Specific Ideas

- Plusieurs scénarios liasse sont irréductiblement humains : « le PDF s'ouvre correctement et est lisible » (sc. 8), « les accents s'affichent correctement dans Excel/LibreOffice » (sc. 9). Ne pas les automatiser en faux-positif — c'est précisément le périmètre humain de D-01.
- Le critère #2 du roadmap (« 0 scénario en attente ») est respecté via D-04 : un cosmétique non-bloquant clôt en *pass-with-note*, pas en `pending`.
</specifics>

<deferred>
## Deferred Ideas

- Corrections cosmétiques (CSS « bizarre » signalé en Phase 02, libellés) découvertes pendant l'UAT et jugées non-bloquantes → backlog, hors Phase 9.
- Dette technique (partials CFE en double, unification `calculerAlertesIrl`, transaction Kysely enveloppante) → **Phase 10** (DET-01/02/03), explicitement hors de cette phase.

None — la discussion est restée dans le périmètre de clôture qualité.
</deferred>

---

*Phase: 9-finition-qualit-cl-ture-uat-r-conciliation-des-statuts*
*Context gathered: 2026-06-16*
