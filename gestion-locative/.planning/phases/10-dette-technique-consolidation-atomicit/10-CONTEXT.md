# Phase 10: Dette technique — consolidation & atomicité - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Éponger 3 dettes techniques connues de v1.0, **sous la couverture de test existante restée verte**, **sans aucun changement de comportement observable** (affichage, chiffres, flux). On clarifie *comment* refactorer ce qui est déjà scopé — aucune nouvelle capacité produit.

- **DET-01** — Consolider les 2 partiels CFE en double en un seul partiel réutilisable, sans régression d'affichage.
- **DET-02** — Unifier les 2 patterns d'enrichissement `calculerAlertesIrl` en un seul chemin, couvert par les scénarios existants.
- **DET-03** — Poser la transaction Kysely enveloppante (D-94) sur les écritures multi-tables, garantissant l'atomicité (rollback sur échec partiel).

Out of scope : toute amélioration fonctionnelle ou esthétique non requise par la consolidation (y compris l'amélioration WCAG du bandeau CFE — cf. Deferred) ; la sécurisation/chiffrement des données (Phase 11).
</domain>

<decisions>
## Implementation Decisions

### DET-01 — Consolidation des partiels CFE
- **D-10-01 : Partiel unique neutre, rendu strictement identique par surface.** Extraire le markup partagé dans UN seul partiel réutilisable. Le rendu doit rester **identique sur chaque surface** : bandeau CFE de `/fiscalite` et `/biens/detail` **sans icône** (comme aujourd'hui via `partial-bandeau-cfe-echeance`), bandeau polymorphe de `/baux/indexations` **avec son icône + ARIA** (comme aujourd'hui via `partial-bandeau-alerte`). Le partiel unifié sera donc **paramétré** (ex. flag d'icône/inline) pour préserver les deux rendus existants. Aucun changement DOM observable. Respecte le critère #1 « affichage identique avant/après » à la lettre.

### DET-02 — Unification `calculerAlertesIrl`
- **D-10-02 : Enrichissement DANS la fonction (chemin unique).** `routes/baux.ts` construit la `Map<BailId, string>` des noms de locataires et la passe en 5e argument à `calculerAlertesIrl`, comme le fait déjà `application/dashboard/calculer-toutes-alertes.ts`. La boucle d'enrichissement post-hoc et le dict séparé `locatairesParBail` sont supprimés ; la vue baux lit `alerte.source.extra.nomLocataire`. Respecte le principe « domaine pur » du projet. Le changement de plomberie route + template doit rester **sans effet observable** (mêmes noms affichés, même rendu).

### DET-03 — Transaction Kysely enveloppante
- **D-10-03 : Envelopper les deux sites jumeaux.** Poser `db.transaction().execute(...)` sur `application/locatif/appliquer-indexation-irl.ts` (cible nommée par D-94) **et** sur `application/locatif/modifier-bail-actif.ts` (même pattern bail + suppression/batch echeance hors transaction, même risque d'état incohérent). DET-03 vise les écritures multi-tables au pluriel ; les deux sites partagent la faille, on les corrige ensemble pour la cohérence et une atomicité réelle partout. Suivre le pattern établi (`bail-repository-sqlite.ts`, `cloturer-exercice.ts`, `activer-fiscalite-bien.ts`).
- **D-10-04 : Transaction sur les écritures DB seules ; write PDF/fichier hors transaction.** Le bloc transactionnel couvre uniquement les écritures en base. La génération PDF + écriture fichier reste **hors** transaction : un rollback DB ne peut pas annuler un fichier disque, et un I/O lent ne doit pas tenir la transaction ouverte. Conforme à la compensation déjà documentée (commentaire `void db; // réservé pour transaction future`).

### Stratégie de preuve (non-régression + atomicité)
- **D-10-05 : Un test d'injection d'échec par site enveloppé (2 scénarios).** Pour chaque site (`appliquer-indexation-irl`, `modifier-bail-actif`) : forcer l'échec de la 2e écriture DB (ex. insert echeance qui throw) et asserter le **rollback complet** (bail inchangé, aucune suppression d'echeance orpheline, aucune ligne `bail_indexations` partielle). Couvre les deux sites distinctement — conforme au critère #3 « atomicité vérifiée par scénario ».
- **D-10-06 : Snapshot de rendu EJS avant/après pour les partiels touchés.** Capturer le HTML rendu des partiels/vues impactés (partiel CFE unifié sur ses 2 surfaces, vue baux) avant refactor, asserter l'égalité après. Preuve mécanique du « affichage identique » (critère #1), au-delà de la couverture intégration existante.

### Claude's Discretion
- Forme exacte du paramétrage du partiel CFE unifié (flag booléen vs variante) laissée au planner/exécutant, tant que les deux rendus actuels sont strictement préservés (D-10-01).
- Mécanique d'injection d'échec dans les tests d'atomicité (repo fake qui throw, spy, etc.) laissée à l'exécutant (D-10-05).
- Outillage de snapshot de rendu (helper de rendu EJS + assertion d'égalité) laissé à l'exécutant (D-10-06).

### Point ouvert pour le planner
- **Critère #4 « suite < 30 s ».** Le scout estime la suite complète à plusieurs minutes (200+ fichiers Vitest + 45 features BDD). Le « < 30 s » vise vraisemblablement les tests **unitaires**, pas la suite entière. Le planner doit clarifier le périmètre exact mesuré par ce critère avant de s'engager dessus (mesurer `pnpm test:unit` vs `pnpm test`).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Exigences & cadrage
- `.planning/REQUIREMENTS.md` — DET-01, DET-02, DET-03 (libellés exacts).
- `.planning/ROADMAP.md` §Phase 10 — 4 critères de succès (consolidation CFE sans régression, chemin IRL unique, transaction Kysely + rollback, suite verte < 30 s).
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md` §99-127 — **décision D-94** (transaction Kysely enveloppante pour `AppliquerIndexationIRL`, déviation acceptée à corriger ici).
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — note d'acceptation de la déviation D-94 (contexte historique du report).

### DET-01 — Partiels CFE
- `src/web/views/partials/partial-bandeau-cfe-echeance.ejs` — bandeau CFE actuel (sans icône), inclus depuis `pages/fiscalite/index.ejs` et `pages/biens/detail.ejs`.
- `src/web/views/partials/partial-bandeau-alerte.ejs` — bandeau polymorphe (avec icône + helpers WCAG), utilisé sur `/baux/indexations`.

### DET-02 — `calculerAlertesIrl`
- `src/domain/locatif/alerte-irl.ts` §80-118 — définition `calculerAlertesIrl` (5e arg optionnel `nomLocataireParBail`).
- `src/web/routes/baux.ts` §144-186 — appelant à aligner (boucle post-hoc à supprimer).
- `src/application/dashboard/calculer-toutes-alertes.ts` §52-100 — appelant de référence (pattern cible : map passée en 5e arg).

### DET-03 — Transaction
- `src/application/locatif/appliquer-indexation-irl.ts` §83-213 — cible D-94 (bail + echeance delete/batch + bail_indexations).
- `src/application/locatif/modifier-bail-actif.ts` §97-134 — site jumeau (bail + echeance delete/batch).
- `src/infrastructure/repositories/bail-repository-sqlite.ts` §22-74 — pattern transaction établi.
- `src/application/fiscalite/cloturer-exercice.ts` §199-207 — pattern `db.transaction().execute(async (trx) => …)`.
- `src/application/fiscalite/activer-fiscalite-bien.ts` §161-168 — autre exemple du pattern.

### Pratiques opposables
- `practices/BDD_PRACTICES.md` — cycle outside-in, 100 % couverture logique, scénario par exception (s'applique au test d'atomicité D-10-05).
- `CLAUDE.md` §Règles non négociables — domaine pur (ports & adapters), pas de code métier sans test (cadre D-10-02 et D-10-05).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 5e argument `nomLocataireParBail` de `calculerAlertesIrl` **déjà implémenté** — DET-02 n'ajoute pas de capacité, il rebranche `routes/baux.ts` dessus.
- Pattern transaction `db.transaction().execute(async (trx) => …)` **déjà établi** dans 3+ use cases (`cloturer-exercice`, `activer-fiscalite-bien`, `bail-repository-sqlite`) — DET-03 réplique ce pattern, pas d'invention.
- `db` est déjà passé en argument aux deux use cases cibles (`void db; // réservé pour transaction future`) — l'enveloppe peut être posée sans changer les signatures.

### Established Patterns
- App server-rendered (Fastify + Kysely + SQLite), vues EJS, tests Vitest (`pnpm test`, `test:unit`, `test:integration`) + BDD Cucumber (`test:bdd`).
- Domaine pur sans import technique ; enrichissement métier via maps injectées (cohérent avec D-10-02).

### Integration Points
- DET-01 touche le rendu de 3 vues (`fiscalite/index`, `biens/detail`, `baux/indexations`) — surface du snapshot D-10-06.
- DET-02 touche `routes/baux.ts` + la vue baux qui lit aujourd'hui `locatairesParBail` (à rebrancher sur `source.extra.nomLocataire`).
- DET-03 : tables `bail`, `echeance_loyer`, `bail_indexations` écrites dans les deux use cases locatifs.
</code_context>

<specifics>
## Specific Ideas

- Tension explicite à respecter : le partiel polymorphe a gagné une icône + des helpers ARIA que le bandeau CFE n'a pas. Le critère #1 (« affichage identique ») **interdit** de faire hériter silencieusement cette icône au bandeau CFE. Le partiel unifié doit donc préserver les deux rendus, pas les harmoniser.
- DET-03 est une correction de **faille d'atomicité réelle** : aujourd'hui, si la suppression d'echeances réussit puis l'insertion échoue, on obtient un état incohérent (echeances orphelines supprimées, bail/indexation partiels). Le test d'injection D-10-05 doit reproduire précisément ce cas.
</specifics>

<deferred>
## Deferred Ideas

- **Amélioration WCAG du bandeau CFE** (icône + ARIA, comme le bandeau polymorphe) : bénéfique mais constitue un changement d'affichage observable, donc **hors Phase 10** (qui exige rendu identique). À reproposer comme amélioration accessibilité explicite dans une phase UI/A11y dédiée.

None — la discussion est restée dans le périmètre de consolidation/atomicité.
</deferred>

---

*Phase: 10-dette-technique-consolidation-atomicit*
*Context gathered: 2026-06-16*
