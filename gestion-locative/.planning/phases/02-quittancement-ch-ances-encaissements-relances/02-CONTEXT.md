# Phase 2: Quittancement — Échéances, Encaissements, Relances - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

L'utilisateur peut **piloter le cycle complet de perception du loyer sur un `Bail` existant** : émettre l'avis d'échéance PDF, encaisser (saisir un paiement avec mode), quittancer (PDF si période entièrement payée), identifier les impayés et retards, lancer des relances escaladées (amiable → ferme → mise en demeure).

**REQs couverts (5)** : ENC-01 (Quittance PDF), ENC-02 (Avis d'échéance PDF), ENC-03 (Encaissement saisie + paiement partiel), ENC-04 (calcul impayés/retards), ENC-05 (relances escaladées avec templates email).

**Bounded contexts touchés** :
- `Encaissements` (nouveau BC, agrégats `EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance`).
- `Identite` (nouveau BC ou inclusion dans `domain/_shared/`, agrégat `Bailleur` minimal — décision laissée au planner D-67).
- `Locatif` (mutation : ajout `actif_depuis` sur `Bail`, ajout `jour_echeance`).

**Strictement hors périmètre Phase 2** (rappels — ne pas attraper en scope creep) :
- IRL active / révision auto à la date anniversaire / gel DPE F/G → **Phase 3**.
- Diagnostics (DPE, gaz, élec, ERP), EDL, checklist mobilier décret 2015-981 → **Phase 3**.
- Coffre documentaire (uploader Justificatif, recherche, rétention 10 ans) → **Phase 4**.
- Tickets travaux → **Phase 4**.
- Calcul total des charges déductibles, recettes/charges agrégées, micro-BIC, amortissement, bascule LMP → **Phase 5**.
- Liasse 2031, CFE → **Phase 6**.
- Dashboard transverse + notifications J-30/J-7 (CFE, IRL, diagnostics, fin de bail) → **Phase 7**.
- Résiliation anticipée du bail (locataire qui part avant `date_debut + dureeMois`) → **V2**.
- Indemnités d'occupation post-résiliation → **V2**.
- Compensation de l'impayé sur le dépôt de garantie en fin de bail → **Phase 3** (EDL sortie) ou plus.
- Multi-bailleur, SCI, gestion déléguée → jamais (V1 mono-user).

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (PROJECT.md / ROADMAP.md / Phase 1 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md / Phase 1 §Décisions verrouillées) : LMNP location meublée longue durée uniquement, local-first SQLite, DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in 100% couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1 — `01-CONTEXT.md`) : Web local SSR (Fastify + EJS, partials), 127.0.0.1 + port fixe + lockfile, multi-OS, Pico.css, **TypeScript strict, Node 22 LTS, Fastify, EJS via `@fastify/view`, better-sqlite3 + Kysely, Vitest, @cucumber/cucumber-js, fast-check, Money bigint centimes maison, Temporal API, Zod + fastify-type-provider-zod, pdfmake, Pico.css, ESLint + Prettier + dependency-cruiser, pnpm, pino, tsx, Mise**.
- **D-44 → D-50** (Phase 1) : Standards UI/UX/A11y opposables (WCAG 2.1 AA, hiérarchie visuelle 1 dominant/écran, spacing 8 px, color, typography, forms 1 colonne label-au-dessus + validation au blur, destructive = confirmation).
- **Patterns d'implémentation Phase 1** (`01-LEARNINGS.md`) à rejouer Phase 2 : factory `X.creer()` + `InvariantViolated`, brand types pour identifiants, builders `tests/_builders/`, TDD outside-in (BDD rouge → tests unit/integration rouges → green), repository `versDomaine`/`versRow` + `transaction()`, use case multi-repos pour cross-aggregate, EJS layout split `debut`/`fin`, partials configurables via `locals`, preHandler limité aux helpers pure (pas d'accès session), Money INTEGER cents (BigInt domaine), Temporal.PlainDate ↔ TEXT ISO, JSON inline pour VOs imbriqués.

### Génération des échéances + statut Bail actif

- **D-51** : `Bail.actif_depuis: PlainDate | null` (YAGNI). Champ ajouté par migration ALTER. Brouillon si `null`, actif sinon. Notion "terminé" dérivée (`date_debut + dureeMois`), pas stockée V1. La fin réelle (résiliation) sera matérialisée plus tard si besoin.
- **D-52** : Génération auto des `EcheanceLoyer` au moment de l'activation du Bail, **pour toute la durée du bail** (`dureeMois` entries). Pas de cron, pas de rolling. Coût négligeable (12-36 lignes par bail).
- **D-53** : `Bail.jour_echeance: 1..28` (ALTER, défaut 1). Plafonné à 28 pour éviter mois courts (février 28/29). Loi 89 art. 7 : "aux dates convenues" (libre).
- **D-54** : `EcheanceLoyer = { id, bail_id, periode_debut: PlainDate, periode_fin: PlainDate, jour_echeance_attendue: PlainDate, loyer_hc: Money, montant_charges: Money, mode_charges: 'forfait'|'provisions', total: Money, statut, cree_le, modifie_le, annule_le }`. **Snapshot complet** : audit-friendly, immutable une fois payée, pas de JOIN nécessaire pour la quittance.
- **D-55** : `EcheanceLoyer.statut: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee'` enum stocké, recalculé à chaque création/correction d'`Encaissement`. **"En retard" n'est PAS un statut stocké** — c'est le dérivé `statut != 'payee' && jour_echeance_attendue < today` (se résout sans action utilisateur).
- **D-56** : Période = **mois civil + prorata 1ère/dernière échéance**. La 1ère échéance est calculée prorata si `date_debut.day != 1` (formule : `loyer × (jours_occupés / jours_dans_mois)` via Money.multiplyByFraction). Idem pour la dernière échéance si la fin du bail tombe en milieu de mois. Aligne usage LMNP réel + liasse 2031 (chaque période dans un seul exercice fiscal).

### Modèle Encaissement ↔ Échéance

- **D-57** : Cardinalité **N:1** (`Encaissement.echeance_id` foreign key). Plusieurs encaissements peuvent payer une même `EcheanceLoyer` (paiement partiel ENC-03, paiement étalé). Cas "rattrapage multi-mois" → l'utilisateur saisit N encaissements distincts (1 par mois) même s'il y a un seul virement bancaire — explicite, audit-friendly.
- **D-58** : `Encaissement.mode: 'virement' | 'cheque' | 'especes' | 'prelevement' | 'autre'` enum strict. Couvre 100 % des cas LMNP. "Autre" pour exceptions rares (CB caution, mandat-cash). Permet agrégation propre Phase 5 (recettes par mode pour la liasse).
- **D-59** : Sur-paiement (encaissement > total dû) : **accepté + warning visible** ("Trop-perçu de X €, pense à ajuster la prochaine échéance"). L'`EcheanceLoyer` bascule `payee`. **Pas de report auto V1** — l'utilisateur gère manuellement (ajustement sur prochaine échéance ou suivi externe). Évite la magie cachée.
- **D-60** : Audit `Encaissement` = **soft-delete + correction par compensateur**. Suppression : `annule_le: PlainDate | null` + `raison_annulation: string`. **Modification** : interdite — pour corriger un montant, l'utilisateur saisit un Encaissement compensateur (négatif via Money.negation). L'historique reste intact, opposable au locataire et à l'administration fiscale.
- **D-61** : Date d'`Encaissement` = **permissive avec warnings**. Aucune contrainte stricte. Warnings si : `date < bail.date_debut` (ne peut pas matériellement se produire), `date > today + 90j` (suspicion erreur saisie). Reflète tous les cas LMNP réels (paiement à l'avance, régularisation oubliée d'il y a 6 mois, etc.).
- **D-62** : **Pas d'enum statut sur `Encaissement`** V1. L'existence d'un Encaissement = "encaissé" implicite. L'annulation = `annule_le`. Statut "en_attente" et "rapproche" (workflow rapprochement bancaire) reportés Phase 7+ si besoin réel.

### Quittances PDF

- **D-63** : Émission de la `Quittance` = **manuelle** (bouton "Générer quittance" visible quand `EcheanceLoyer.statut = 'payee'`) + **persistance fichier local** dans `~/Library/.../gestion-locative/documents/quittances/{annee}/`. Conforme loi 89 art. 21 ("sur demande"). PDF immutable une fois émis (audit-friendly + force probante).
- **D-64** : Numérotation des quittances = **séquentielle annuelle `AAAA-NNN`** (ex. `2026-001`, `2026-002`, ... `2027-001`). Reset chaque année. Aligne pratique comptable (numéro de pièce), Phase 6 (liasse 2031 groupée par exercice fiscal). Compteur stocké dans table `meta` (`compteur_quittance_2026 = 42`) ou table dédiée `quittance_compteur` à trancher au planner.
- **D-65** : Cohérence post-correction : si un `Encaissement` est annulé/compensé après émission d'une `Quittance` → l'`EcheanceLoyer` redevient `partiellement_payee` → **détection auto + warning visible** sur la fiche Quittance + bouton "Marquer comme annulée" (`Quittance.annulee_le` + raison). Une nouvelle quittance peut être émise plus tard (numéro suivant). **PDF originaux jamais écrasés.**
- **D-66** : Avis d'échéance (ENC-02) = **on-the-fly sans persistance, sans numérotation**. Le PDF est régénéré à chaque clic "Télécharger avis". Pas de force probante (rappel courtois). Identifié par `bail_id + periode` (nom de fichier suggéré : `avis-loyer-{periode}-bail-{id-court}.pdf`).
- **D-67** : Identité du **Bailleur** = nouvel agrégat V1 minimal (`{ id, nom_complet, adresse: Adresse }` réutilisant le VO `Adresse` de Phase 1). **Singleton mono-user** (table `bailleur` avec contrainte 1 ligne max). Saisie via page "Profil bailleur" (accessible sidebar + onboarding Phase 2 si non rempli avant 1ère quittance). **SIRET non requis V1** (ajouté Phase 5/6 par migration ALTER pour la liasse 2031). Placement domaine : nouveau BC `domain/identite/` OU `domain/_shared/` — **à trancher par le planner** (concept transverse mono-user, peut tomber dans `_shared`).

### Relances

- **D-68** : **3 niveaux d'escalade** : `1=amiable` (J+10), `2=relance_ferme` (J+30), `3=mise_en_demeure` (J+60). Aligne pratique pré-judiciaire française. Le commandement de payer (huissier) est explicitement hors-périmètre (PROJECT.md §Out of Scope "contentieux et procédures judiciaires"). Seuils J+X stockés en constante de domaine (modifiables par PR si nouvelle pratique).
- **D-69** : Canal **hybride** :
  - Niveaux 1-2 : **mailto natif** (URI `mailto:locataire@x.com?subject=...&body=...` ouvre Mail.app/Outlook/Thunderbird avec brouillon pré-rempli, l'utilisateur clique "Envoyer" depuis son client → copie auto dans son client mail). Pas de SMTP V1 (sur-équipement, sécurité du mot de passe en .env).
  - Niveau 3 (mise en demeure) : **PDF imprimable** (LR/AR par poste légalement requis). L'utilisateur télécharge → imprime → poste.
- **D-70** : Templates fixes V1 dans **fichiers EJS** : `templates/relances/01-amiable.ejs`, `02-ferme.ejs`, `03-mise-en-demeure.ejs`. Variables interpolées : `{prenom_locataire}`, `{nom_locataire}`, `{adresse_locataire}`, `{periode_impayee}` (ex. "mai 2026"), `{montant_du}`, `{date_echeance_initiale}`, `{nom_bailleur}`, `{adresse_bailleur}`. Mise à jour juridique = édition fichier + commit + `git pull`. Override utilisateur dans `~/.../gestion-locative/templates/relance-N.ejs` reporté V1.x.
- **D-71** : **Suggestion contextuelle** (pas d'envoi auto). Pour chaque `EcheanceLoyer` impayée, l'app calcule le bouton disponible : `1` si `today >= jour_echeance_attendue + 10 jours`, `2` si `1` envoyé ET `today >= jour_echeance_attendue + 30j`, `3` si `2` envoyé ET `today >= jour_echeance_attendue + 60j`. Bouton apparaît sur fiche échéance + page Impayés. **Chaînage strict** : impossible de sauter direct au niveau 3.
- **Modèle `Relance`** : `{ id, echeance_id, niveau: 1|2|3, canal: 'email'|'pdf', envoyee_le: PlainDate, contenu_snapshot: TEXT (JSON) }`. **`envoyee_le` set à la création** (1 clic = envoyée déclarée par user, soft-delete possible si erreur via `annule_le`). Snapshot du contenu pour audit (le template peut évoluer, on garde ce qui a été émis).

### Edge cases supplémentaires (validés post-areas)

- **D-72** : **Activation rétroactive permissive**. Un Bail peut être activé avec `actif_depuis < today` (rattrapage admin LMNP fréquent). Génération rétroactive automatique des `EcheanceLoyer` depuis `date_debut`, toutes en `en_attente` jusqu'à saisie d'`Encaissement` correspondant. **Warning** si `date_debut < today - 2 ans` ("Activation > 2 ans en arrière, vérifie les exercices fiscaux concernés").
- **D-73** : **Modification d'un Bail actif** = confirmation explicite (modal). Message : *"X échéances futures non payées seront supprimées et régénérées avec le nouveau montant. Y échéances déjà encaissées resteront inchangées (audit). Confirmer ?"*. **Régénération uniquement** des `EcheanceLoyer` `en_attente` ou `partiellement_payee` postérieures à `today`. Les passées et payées restent intactes (immutables, opposables).
- **D-74** : **Suppression d'un Bail avec activité = refusée**. Si le Bail a au moins 1 `EcheanceLoyer`, `Encaissement`, ou `Quittance` lié → le bouton "Supprimer" est désactivé avec message : *"Ce bail a {n_ech} échéances, {n_enc} encaissements et {n_qui} quittances. Supprimer détruirait l'historique opposable. Tu peux désactiver le bail (`actif_depuis = null`) — l'historique reste consultable."* + bouton "Désactiver". Cohérent avec D-60 (soft-delete) et la rétention 10 ans (Phase 4).

### Décisions différées au `gsd-plan-phase 2`

- **DP-07** : Placement de l'agrégat `Bailleur` (nouveau BC `domain/identite/` vs `domain/_shared/identite.ts`). Concept singleton mono-user — `_shared` est défensable. Recommandation pré-discussion : `domain/identite/` car le concept restera utile aux Phases 5/6 (SIRET, statut juridique, micro vs réel).
- **DP-08** : Storage du compteur de numérotation des quittances (table `meta` cle/valeur vs table dédiée `quittance_compteur`). Recommandation : table `meta` (`cle = 'compteur_quittance_2026', valeur = '42'`) en cohérence avec le pattern Phase 1.
- **DP-09** : Format exact du nom de fichier des PDF (suggestion : `quittance-{numero}-{periode}-{nom-locataire-slug}.pdf`).
- **DP-10** : Mécanisme de calcul `Money × fraction` pour le prorata 1ère/dernière échéance (étendre l'API `Money` Phase 1 avec `multiplyByFraction(jours_pris, jours_total)` retournant un Money avec arrondi banker's). Tests fast-check à prévoir (commutativité jours×loyer, somme des prorata = loyer, etc.).
- **DP-11** : Détection robuste du jour de génération des prorata (gestion de février 28/29 vs `jour_echeance` 1..28 — implicite mais à expliciter).
- **DP-12** : Mécanisme de "scheduling" du chaînage des relances (J+10, J+30, J+60) — pure calcul à la demande dans la requête (pas de cron) ; à confirmer dans le planner.
- **DP-13** : Format CSS / layout pdfmake exact pour Quittance et Mise en demeure (à préciser au `gsd-ui-phase 2`).

### Claude's Discretion (à trancher par le planner / executor)

- Convention de nommage exact des routes Fastify (`/echeances`, `/encaissements`, `/quittances`, `/relances`, `/bailleur`).
- Structure des partials EJS spécifiques Phase 2 (`partial-paiement-form`, `partial-relance-action-bouton`, etc.).
- Helpers de format additionnels (`formatPeriode(plainDate) → "mai 2026"`).
- Choix précis des libellés et placeholders d'inputs.
- Migrations SQLite : nombre et découpage (recommandation : `0002_phase2_init.sql` couvre toutes les tables Phase 2 + ALTER bail pour `actif_depuis` et `jour_echeance`, OU plusieurs migrations atomiques par plan — à trancher selon le découpage des plans).
- Encoding de sortie `mailto:` (gestion correcte des accents UTF-8, line breaks `%0D%0A`).
- Politique d'arrondi exacte du prorata (recommandation : arrondi banker's sur le résultat final en centimes — pas d'accumulation d'erreurs).

### Folded Todos

*(aucun — todo.match-phase a retourné `todo_count: 0`)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-ui-researcher`, `gsd-executor`) MUST read these before planning or implementing.**

### Domaine produit / projet

- `.planning/PROJECT.md` — contraintes verrouillées, bounded contexts (Encaissements explicitement listé), key decisions, principes directeurs, hors-périmètre.
- `.planning/REQUIREMENTS.md` — REQs ENC-01 → ENC-05 (V1) + traceability par phase.
- `.planning/ROADMAP.md` §Phase 2 — goal, success criteria, dépendances (Phase 1).
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD : cible, périmètre MVP.

### Phase 1 (artefacts à respecter)

- `.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md` — décisions verrouillées D-01 → D-50 (stack technique, statut Bail futur, périmètre entités, standards UI/UX/A11y).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` — patterns établis (factory + InvariantViolated, brand types, builders, repository transaction, EJS layout split, preHandler pure, Money cents, Temporal roundtrip, Cautionnement JSON inline) + surprises (Fastify 5 logger, Cucumber `/`, EJS include + JS template literal, ZodEffects break composition, Intl U+00A0).

### Domaine fiscal / juridique LMNP

- `LMNP.md` — base de connaissances fiscale (utile pour anticiper les futures phases mais structure les bounded contexts dès Phase 2 — recettes encaissées Phase 2 alimenteront FIS-03 Phase 5).
- `LOCATION_MEUBLEE_REGLES.md` — règles juridiques :
  - §4.3 (mode forfait vs provisions) — modélisation du `mode_charges` sur `EcheanceLoyer`.
  - §5 (dépôt de garantie) — non touché Phase 2 mais le principe de séparation s'applique.
  - **§9.1 (mentions obligatoires bail)** — bailleur identifié → motive l'agrégat `Bailleur` (D-67).
  - **§11 (documents à conserver)** — quittance, avis, relances → cohérence avec D-63 stockage local.
- **Loi 89-462 art. 7** — paiement aux dates convenues (motive D-53 `jour_echeance` libre 1..28).
- **Loi 89-462 art. 21** — quittance gratuite sur demande, mentions obligatoires (motive D-63 émission manuelle + D-65 immutabilité).
- **Loi 89-462 art. 22** — cautionnement (déjà géré Phase 1 D-33, pas re-touché Phase 2).
- **CGI art. 289** — règles de facturation (numérotation séquentielle continue → pratique adaptée pour les quittances de loyer même si non strictement obligatoires, motive D-64).
- **Code monétaire et financier (CMF) L112-6, R112-5** — limite paiement espèces (1000 €/mois pour les particuliers payant un loyer) — motive l'enum `mode = especes` D-58.

### Pratiques d'ingénierie (opposables)

- `DDD.md` — bounded contexts, agrégats, ports & adapters, ubiquitous language français, tactical patterns (entité, VO, agrégat, repository, domain service, **domain event** — utile pour `EcheanceLoyer.payee` qui pourrait propager un événement plus tard, mais YAGNI V1), anti-patterns. Le BC `Encaissements` est listé explicitement dans PROJECT.md §Context.
- `BDD_PRACTICES.md` — outside-in, pyramide tests, **cas obligatoires §8** (à appliquer à la logique métier Phase 2 : prorata 1ère/dernière échéance, paiement partiel, sur-paiement, soft-delete + compensateur, suggestion relance par seuil), data builders, port `Clock` (déterminisme indispensable pour les seuils J+10/J+30/J+60 — réutiliser le port Clock de Phase 1).
- `SOFTWARE_CRAFTSMANSHIP.md` — SOLID, Clean Code, KISS/DRY/YAGNI, code review checklist, **gates CI bloquants §8** : 0 warning, ≥80 % coverage, 100 % logique métier, cyclomatic < 10, suite unitaire < 30 s. Les 4 nouveaux agrégats Phase 2 doivent passer 100 % couverture.

### Pratiques UI / UX / Accessibilité (opposables)

- `UI_DESIGN.md` — Gestalt, hiérarchie visuelle (1 dominant/écran : la table impayés), color (rouge=retard, ambre=partiel, vert=payé), typography, spacing 8 px, **feedback states (la fiche échéance change visuellement selon statut)**, **data tables (page Impayés et page Échéances doivent suivre les standards Phase 1 D-41)**.
- `UX_DESIGN.md` — Hick / Fitts / Miller / Jakob / Doherty laws, flow & navigation (sidebar gauche fixe Phase 1 — ajout d'une section "Encaissements" ou équivalent), forms (saisie Encaissement = 1 colonne, label au-dessus, validation au blur), **error handling** (cas du sur-paiement = warning non bloquant), **empty states** (page Impayés vide = "Tous les loyers sont à jour 🎉"), affordance, cognitive load, trust & transparency.
- `ACCESSIBILITY.md` — WCAG 2.1 AA : POUR principles, contrast 4.5:1, keyboard nav (les actions de relance = boutons accessibles tabulables), semantic HTML, ARIA (sparingly — `aria-live` pour le warning sur-paiement), **forms (saisie Encaissement)**, **tables (page Impayés et historique des Encaissements/Quittances respectent UI_DESIGN §Data Tables)**, motion respecting `prefers-reduced-motion`, testing checklist.
- `BEHAVIOR.md` — code of conduct par session : posture sceptique, speed levers (parallel calls, allowlist, no trivial agents, tight prompts, cache discipline). Gain particulier Phase 2 : 4 agrégats peuvent être implémentés en parallèle wave (EcheanceLoyer + Encaissement + Quittance + Relance) après que l'extension du Bail (`actif_depuis` + `jour_echeance`) soit landed.

### Risques & contraintes

- `RISKS.md` — registre des risques pertinents Phase 2 :
  - **R1.1** (surveillance fiscale annuelle) — les seuils J+X et la numérotation annuelle doivent être versionnés et revus janvier post-LF.
  - **R2.1** (alertes échéances) — la suggestion contextuelle de relance D-71 est une mitigation directe.
  - **R3.1** (backup) — les PDF stockés (D-63) doivent être inclus dans le périmètre du backup futur (Phase BAK).
  - **R4.3** (pédagogie fiscale) — l'UI doit afficher le statut de l'échéance et le motif du warning sur-paiement de manière compréhensible.
- `CLAUDE.md` — règles non négociables projet (top priority V1 LMNP meublé, principes directeurs **audit-friendly + sobre**, hors périmètre).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phase 1)

- **`src/domain/_shared/money.ts`** — VO Money en BigInt centimes. À étendre Phase 2 : `Money.zero()`, `Money.fromCentimes(BigInt)`, `Money.toCentimes()`, `superieurA`, `lte`, `multiplier`. **Étendre avec** `Money.multiplyByFraction(num, den)` ou `Money.prorata(joursPris, joursTotal)` pour le calcul des 1ère/dernière échéances (D-56). Tests fast-check obligatoires.
- **`src/domain/_shared/adresse.ts`** — VO Adresse `{ rue, code_postal, ville }`. À réutiliser tel quel pour `Bailleur.adresse` (D-67).
- **`src/domain/_shared/identifiants.ts`** — Brand types (`BienId`, `LotId`, `LocataireId`, `BailId`). À étendre avec `EcheanceLoyerId`, `EncaissementId`, `QuittanceId`, `RelanceId`, `BailleurId` + leur générateur `nouveauXxxId()`.
- **`src/domain/_shared/erreurs.ts`** — `InvariantViolated`. Réutilisé tel quel.
- **`src/domain/locatif/bail.ts`** — Agrégat `Bail` (Phase 1 D-35). À étendre avec `actif_depuis: PlainDate | null`, `jour_echeance: number` (1..28), méthode `activer(date_activation: PlainDate, jour_echeance: number)` qui retourne un nouveau `Bail` activé (copy-on-write Phase 1 pattern).
- **`src/domain/locatif/bail-repository.ts`** — port. À étendre avec méthodes pour requêter les baux actifs.
- **`src/infrastructure/repositories/bail-repository-sqlite.ts`** — adapter Kysely. À adapter pour les nouvelles colonnes (migration ALTER `bail`).
- **`src/infrastructure/db/database.ts`** — `ConnexionDb = { db: Kysely<DB>, sqlite: BetterSqlite3.Database }` (Phase 1 LEARNING : Kysely n'expose pas de SQL brut multi-statements, conserver le driver pour les migrations).
- **`src/web/views/partials/`** — 8 partials Phase 1 : `form-field`, `data-table`, `confirm-dialog`, `sidebar-nav`, `breadcrumbs`, `empty-state`, `banniere-success`, `wizard-layout`. **Réutiliser** sans réécrire pour les pages `/echeances`, `/encaissements`, `/quittances`, `/relances`. Étendre `sidebar-nav` avec les nouveaux liens.
- **`src/helpers/format-date.ts`, `format-money.ts`** — déjà injectés via preHandler dans `reply.locals`. Réutilisés tel quel. Ajouter `format-periode.ts` (`PlainDate → "mai 2026"`) à un endroit cohérent.

### Established Patterns (Phase 1)

- **Hexagonal strict** : `domain/encaissements/`, `domain/identite/` (ou `domain/_shared/`) sans aucun import technique. Vérifié par dependency-cruiser.
- **Factory + InvariantViolated** : chaque nouveau agrégat (EcheanceLoyer, Encaissement, Quittance, Relance, Bailleur) expose `X.creer(props)` qui valide les invariants.
- **Brand types** : nouveaux identifiants suivent le pattern `EcheanceLoyerId = string & { readonly __brand: 'EcheanceLoyerId' }`.
- **Builders** : `unEcheanceLoyerValide`, `unEncaissementValide`, `uneQuittanceValide`, `uneRelanceValide`, `unBailleurValide` dans `tests/_builders/`.
- **TDD outside-in** : chaque plan exécution démarre par `test(NN-NN): ... rouge`.
- **Repository pattern** : `versDomaine(row)` + `versRow(entity)` + `transaction()` quand multi-table.
- **Use case multi-repos** : pour la création d'un Encaissement, le use case prend `BailRepository` + `EcheanceLoyerRepository` + `EncaissementRepository` et vérifie les invariants cross-aggregate (l'EcheanceLoyer existe et n'est pas annulée, le Bail est actif, etc.).
- **Migration ALTER** : ajout de colonnes par fichier `0002_phase2_*.sql` exécuté via `sqlite.exec()` (pas Kysely brut).
- **Money roundtrip SQLite** : `Number(money.toCentimes())` écriture, `Money.fromCentimes(BigInt(row.x))` lecture.
- **Temporal.PlainDate roundtrip** : `.toString()` (TEXT ISO) écriture, `Temporal.PlainDate.from(row.x)` lecture.
- **Layout EJS split** : `layout-debut.ejs` + `layout-fin.ejs` pour toutes les nouvelles pages. Réutiliser tel quel (NE PAS retomber dans le piège `<%- include %>` depuis template literal).
- **preHandler pure** : seuls les helpers de format (`formatDate`, `formatMoney`, ajouter `formatPeriode`) injectés. **Toute donnée stateful (session, flash)** reste gérée route par route (Phase 1 LESSON pré-requis).
- **Schema Zod** : `bail-schemas.ts`-style, `fastify-type-provider-zod` + `z.string().email()` côté HTTP. Pour les checkboxes multiples (ex. relances groupées), réutiliser le pattern `z.union([z.string().uuid(), z.array(z.string().uuid())]).transform(...)` (Phase 1 LEARNING `lotIds`).
- **`ZodEffects` ne supporte pas `.omit()`** — pour des sous-schemas dérivés, **recréer explicitement** (Phase 1 LEARNING `wizardBailSchema`).

### Integration Points

- **`Bail` Phase 1** : extension par migration ALTER (`actif_depuis`, `jour_echeance`). Risque : impact sur les tests Phase 1 si on régénère les types Kysely. À gérer dans le 1er plan d'extension.
- **Wizard Phase 1** : la page wizard `/wizard` est terminée (D-39). Phase 2 NE doit PAS rouvrir le wizard. La page "Profil bailleur" est une étape de configuration séparée (sidebar ou page dédiée), pas un wizard.
- **Sidebar Phase 1** (`partials/sidebar-nav.ejs`) : ajouter section "Encaissements" avec sous-liens (Échéances / Encaissements / Quittances / Impayés / Relances) + lien direct "Profil bailleur".
- **PDF (pdfmake D-19)** : Phase 1 n'a pas écrit de code pdfmake (D-36 reportait le PDF du Bail à Phase 1.5). Phase 2 introduit pdfmake. Adapter `infrastructure/pdf/` à créer (port domaine `PdfRenderer` + adapter pdfmake).
- **Templates EJS relances** : nouveau dossier `templates/relances/` (hors `views/` car ce sont des contenus textuels, pas des pages HTML rendues). À discuter avec le planner.

### Conséquence pour le researcher

→ Le `gsd-phase-researcher` doit **prospecter** :
- Patterns pdfmake idiomatiques pour TS (definitions JSON, polices, layout français A4).
- Bonnes pratiques de génération mailto: en Node (URL encoding, gestion line breaks `%0D%0A`, limites longueur sur Windows/macOS).
- Patterns de soft-delete + compensation en SQL (vue ou fonction calcul d'agrégat des encaissements actifs).
- Approche pour le Singleton domain (Bailleur unique mono-user) : enforcement DB (CHECK + UNIQUE), enforcement use case, ou les deux.
- Modélisation BigInt pour fractions / prorata (pas de Decimal en TS, choix entre rational, scaled integer, Money × Money / divisor).
- Cucumber world avec `Clock` injection (rappel — déjà introduit Phase 1 si présent ; sinon ajouter).
- Layout pdfmake pour mise en demeure (mentions juridiques précises : référence du bail, montant détaillé, mise en demeure formelle, délai 8 jours).

</code_context>

<specifics>
## Specific Ideas

- **Mailto natif explicitement choisi** plutôt que SMTP — alignement local-first, sécurité (pas de credential stocké), traçabilité (copie auto dans le client mail user).
- **Numérotation `AAAA-NNN`** explicitement choisie sur le pattern comptable (pièce de l'année NNN). Pas par bail, pas globale continue.
- **Templates EJS** explicitement fichiers (pas strings TS embarquées) — facilite la mise à jour juridique sans recompile.
- **Prorata 1ère/dernière échéance** explicitement adopté — réflète l'usage LMNP réel (la plupart des baux démarrent en milieu de mois).
- **Soft-delete + compensateur** strict pour Encaissement — engagement audit-friendly maximum, jamais d'UPDATE/DELETE destructif.
- **Bailleur agrégat** (et pas table meta) — cohérent avec les patterns Phase 1, ouvre la porte à l'évolution Phase 5/6 (SIRET, statut, régime).
- **Suggestion contextuelle de relance** explicitement choisie (pas envoi auto) — aligne vision "logiciel qui aide" + audit "user en contrôle".

</specifics>

<deferred>
## Deferred Ideas

### À ajouter dans la roadmap (action requise après ce discuss-phase)

*(aucune phase à insérer V1)*

### À reconsidérer dans des phases ultérieures

- **Phase 3 (Conformité du bail)** : indexation IRL active à la date anniversaire — régénération propre des `EcheanceLoyer` futures non payées (réutilise le mécanisme D-73). Gel loyer Climat DPE F/G refuse l'indexation à la hausse (warning + non régénération).
- **Phase 4 (Coffre documentaire)** : intégration des PDF de quittances déjà persistés Phase 2 dans le coffre documentaire avec rétention 10 ans — pas de migration de fichiers, juste indexation.
- **Phase 5 (Fiscalité — agrégation recettes)** : agrégation des `Encaissement` par exercice fiscal pour FIS-03 (recettes du régime réel). Aucune duplication de données — les Encaissement Phase 2 sont la source de vérité.
- **Phase 5 (Fiscalité — micro-BIC)** : seuil 83 600 € calculé sur la somme des `Encaissement` actifs (non annulés) sur l'année. Bascule détectée + warning.
- **Phase 6 (Liasse 2031)** : champ SIRET ajouté sur `Bailleur` par migration ALTER. Quittances + recettes alimentent les annexes 2033.
- **Phase 7 (Dashboard transverse)** : intégration des impayés Phase 2 dans le dashboard global + notifications J-30/J-7 avant `jour_echeance_attendue` (proactif) en plus des relances post-impayé Phase 2.

### À reconsidérer en V1.1+

- **Override utilisateur des templates** de relance via `~/.../gestion-locative/templates/relance-N.ejs` (sans UI d'édition).
- **Export CSV des Encaissements / Quittances** par année fiscale (utile pré-déclaration).
- **Workflow de rapprochement bancaire** (matching auto par montant + date avec import OFX/CSV) — V2+.
- **SMTP optionnel** pour l'envoi de relances (à activer via env var) — si l'utilisateur en exprime le besoin.
- **Statut Encaissement complet** (`en_attente`, `rapproche`) — si workflow rapprochement bancaire est ajouté.
- **Report auto du sur-paiement** sur prochaine échéance — V1.x si l'utilisateur en signale le besoin réel.
- **Indemnité d'occupation** post-résiliation (régime juridique différent du loyer) — V2.

### À reconsidérer en V2

- **Résiliation anticipée** par le locataire (congé) — recalcul de la dernière échéance prorata + arrêt de la génération.
- **Bail mobilité / étudiant** (types de baux distincts du classique) — types et durées différentes.
- **Multi-bailleur / SCI familiale** — conflit avec `Bailleur` singleton actuel.
- **Compensation impayé sur dépôt de garantie** (fin de bail) — couplage avec EDL sortie Phase 3.
- **Procédure de commandement de payer / huissier** — explicitement hors-périmètre projet (PROJECT.md §Out of Scope).

### À trancher au `gsd-plan-phase 2`

- Placement domaine de l'agrégat `Bailleur` (`identite/` vs `_shared/`).
- Storage du compteur de numérotation des quittances (`meta` cle/valeur vs table dédiée).
- Découpage migrations SQLite (`0002_*.sql` unique vs N migrations atomiques par plan).
- Format exact du nom de fichier des PDF de quittances.
- Mécanisme de calcul `Money × fraction` pour le prorata (extension API Money).
- Politique d'arrondi du prorata (recommandation : banker's, sur le résultat final centimes).
- Gestion encoding UTF-8 dans les URI mailto: (line breaks `%0D%0A`, accents).
- Helpers de format additionnels (`formatPeriode(plainDate) → "mai 2026"`, `formatNumeroQuittance(2026, 42) → "2026-042"`).
- Convention exacte des routes Fastify (`/echeances`, `/encaissements`, `/quittances`, `/relances`, `/bailleur`).

### Reviewed Todos (not folded)

*(aucun todo pré-existant — `gsd-sdk query todo.match-phase 2` a retourné `todo_count: 0`)*

### Note critique pré-réception

L'utilisateur a explicitement demandé en début de discussion : *"j'aimerais en priorité discuter le fait de pouvoir importer mes tickets / factures afin de connaitre mon total de charges deductible et le calcul complet pour savoir combien d'impôts estimés pour ma lmnp"*. Cette demande est **hors-périmètre Phase 2** par le slicing MVP actuel, et **déjà couverte par la roadmap** :
- Import tickets/factures = `DOC-01/02/03` → **Phase 4** (Coffre documentaire).
- Total charges déductibles = `FIS-03` → **Phase 5** (Fiscalité régime réel).
- Calcul micro-BIC / amortissement = `FIS-02/04` → **Phase 5**.
- Brouillon liasse 2031 = `FIS-05` → **Phase 6**.

Décision retenue (cf. AskUserQuestion "Comment veux-tu gérer cette priorité ?") : **garder Phase 2 telle quelle** (option "Garder Phase 2"). Les Phases 4, 5, 6 répondront à cette demande dans l'ordre du slicing MVP. Si l'utilisateur change d'avis, la voie propre est `/gsd-phase` pour réorganiser la roadmap.

</deferred>

---

*Phase: 2-quittancement-echeances-encaissements-relances*
*Context gathered: 2026-05-14*
