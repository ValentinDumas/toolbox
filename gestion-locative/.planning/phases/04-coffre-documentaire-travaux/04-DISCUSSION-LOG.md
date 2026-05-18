# Phase 4 — Discussion Log

**Date:** 2026-05-18
**Mode:** Interactive (4 batches AskUserQuestion, plan mode après batch 2)
**Replaces:** Discussion auto-générée du précédent run (`04-CONTEXT.v1-auto.bak.md` conservée en backup).

L'utilisateur a explicitement demandé à arbitrer **toutes** les gray areas Phase 4 (16 au total), et non pas à valider en bloc l'auto-génération.

---

## Batch 1 — Modèle Justificatif (gray areas 1-4)

### 1. Justificatif — agrégat racine ou sous-agrégat ?

**Options présentées :**
1. Agrégat racine, nouveau BC Documents *(Recommandé)*
2. Sous-agrégat de Bien
3. Pas d'agrégat — table technique

**Choix utilisateur : Option 1.** Agrégat racine du nouveau BC `Documents`. Cycle de vie indépendant, requêtable cross-Bien/Locataire.

---

### 2. Rattachement à Bien et/ou Locataire — quel modèle ?

**Options présentées :**
1. 2 FK nullables, invariant ≥1 non-null *(Recommandé)*
2. Table de jointure N:N dès V1
3. Rattachement unique

**Choix utilisateur : Option 1.** 2 FK nullables avec invariant. N:N copro = différé V1.1+.

---

### 3. Catégorisation — comment ?

**Options présentées :**
1. Enum fixe versionné LF annuelle *(Recommandé)*
2. Enum + tags libres
3. Tags libres uniquement (folksonomy)

**Choix utilisateur : Option 1.** Enum fixe (9 valeurs), tags libres = V2.

---

### 4. Formats acceptés + taille max ?

**Options présentées :**
1. PDF + JPG + PNG, max 20 Mo *(Recommandé initialement)*
2. PDF seul, max 20 Mo
3. PDF + images étendus (HEIC/WebP), max 50 Mo

**Choix utilisateur : Option 3 étendue.** PDF + JPG + PNG + HEIC + WebP, max 50 Mo. L'utilisateur a demandé si HEIC = compliant DDD vu ma remarque "dépendance".

**Réponse Claude :** Compliant. Pattern = port `ConvertisseurImage` (interface pure côté domaine) + adapter d'infra wrappant `sharp` ou `heif-converter`. Domaine n'importe jamais la lib. Même discipline que `StockageFichierLocal` Phase 2. La "dépendance" est juste npm, isolée derrière le port.

→ Décision verrouillée : formats étendus + nouveau port `ConvertisseurImage`.

---

## Batch 2 — Stockage / Rétention / Recherche / Vue coffre (gray areas 5-8)

### 5. Stockage physique — quelle stratégie ?

**Options présentées :**
1. Extension `StockageFichierLocal` Phase 2 *(Recommandé)*
2. Nouveau port `StockageJustificatifs` dédié
3. Stockage en BLOB SQLite

**Choix utilisateur : Option 2.** Nouveau port dédié au BC Documents. Séparation stricte par bounded context. L'adapter local porte (copie) le mécanisme anti-path-traversal éprouvé Phase 2 (WR-03).

---

### 6. Rétention 10 ans — politique de suppression ?

**Options présentées :**
1. Soft-delete corbeille + hard-block purge avant 10 ans *(Recommandé)*
2. Suppression interdite tout court
3. Soft-delete uniquement, jamais de purge
4. Discrimination par type

**Choix utilisateur : Option 1.** Soft-delete réversible + hard-block sur purge avant 10 ans + message factuel.

---

### 7. Recherche — quelle techno V1 ?

**Options présentées :**
1. SQL LIKE sur métadonnées + filtres facettés *(Recommandé)*
2. SQLite FTS5 dès V1
3. Filtres facettés seuls (sans barre de recherche)

**Choix utilisateur : Option 1.** LIKE + facettes. FTS5 = V2.

---

### 8. Vue coffre — inclure les docs générés par l'app (quittances, avenants) ?

**Options présentées :**
1. Vue agrégée read-model dédiée `/coffre/generes` *(Recommandé initialement v1 auto)*
2. Vue unifiée unique (tout dans `/coffre`)
3. Pas d'inclusion des docs générés Phase 4

**L'utilisateur a demandé une recommandation entre 1 et 3 (cohérence vision produit + phases futures).**

**Recommandation Claude : Option 3.**

Raisons :
- **YAGNI + vertical-slice** — les success criteria roadmap Phase 4 ne demandent pas d'agréger les générés.
- **Sobriété (VISION.md)** — 1 endroit / 1 type de doc : quittances sous menu Quittances, avenants sous menu Bail, justificatifs sous Coffre.
- **Audit-friendly** — chaque doc reste dans sa table propre, pas de dépendance de vue.
- **Phase 7 dashboard** sera le bon endroit pour l'agrégation cross-Bien ("tous les docs de l'année 2026") — vrai besoin métier "préparer la déclaration".
- Option 1 maintenant = travail jeté quand Phase 7 fera la vraie vue agrégée.

**Choix utilisateur : Option 3 confirmé** (réponse "oui").

→ La vue `/coffre/generes` initialement proposée par l'auto-discussion est explicitement reportée Phase 7.

---

## Plan mode activé

Après batch 2, l'utilisateur a activé plan mode. Les batches 3 et 4 ont été conduits en plan mode via AskUserQuestion (autorisée car read-only), puis le plan a été écrit dans `~/.claude/plans/oui-eager-waffle.md` et approuvé avant la réécriture de CONTEXT.md.

---

## Batch 3 — Tickets Travaux (gray areas 9-12)

### 9. TicketTravaux — agrégat séparé ou sous-agrégat de Bien ?

**Options présentées :**
1. Agrégat racine, nouveau BC Travaux *(Recommandé)*
2. Sous-agrégat de Bien
3. Agrégat dans BC Documents (avec Justificatif)

**L'utilisateur penche pour Option 1 et demande confirmation alignée DDD + vision + phases futures.**

**Recommandation Claude : Option 1 confirmée.**
- DDD : cycle de vie distinct du `Bien`, ubiquitous language "Travaux" ≠ "Patrimoine".
- Vision Phase 7 : dashboard cross-Bien ("tickets en cours sur tout mon parc") = besoin d'une racine d'agrégat propre, requêtable par `BienId`, `nature`, `statut`.
- Cohérent avec le pattern "nouveau BC additif" déjà appliqué pour `Documents`.

**Choix utilisateur : Option 1.**

---

### 10. Liaison Ticket ↔ Justificatif — quelle relation ?

**Options présentées :**
1. Table N:N `ticket_justificatifs` *(Recommandé)*
2. FK directe `Justificatif.ticketTravauxId` nullable
3. Pas de liaison structurée

**Choix utilisateur : Option 1.** N:N — un ticket = N PJ ; un justificatif peut exister sans ticket. Cascade asymétrique (suppression ticket ne purge pas justificatifs — rétention 10 ans prime).

---

### 11. Workflow création ticket — quelle UX ?

**Options présentées :**
1. Création 1 page (méta) puis panneau PJ sur fiche détail *(Recommandé)*
2. Création multi-step (méta → PJ → confirmation)
3. Tout en 1 page étendue (méta + upload inline)

**Choix utilisateur : Option 1.** 1 page méta → redirect fiche détail → panneau PJ réutilisant le flow upload Justificatif. Cohérent UX Phase 1 (Hick).

---

### 12. Champ `nature` (prep Phase 5) — inclure dès Phase 4 ?

**Options présentées :**
1. Oui, enum 'reparation'|'entretien'|'amelioration'|'autre' *(Recommandé initialement v1 auto)*
2. Non, différer Phase 5
3. Champ libre texte

**L'utilisateur penche pour Option 2 sauf si Vision et DDD désalignés.**

**Recommandation Claude : Option 2 confirmée — plus DDD-aligned et plus Vision-aligned.**

Raisons DDD :
- `nature` (reparation/entretien/amelioration) = vocabulaire **fiscal** (CGI : amortissable vs déductible courant), pas vocabulaire opérationnel travaux.
- BC `Travaux` doit porter ce qui sert à opérer un chantier (titre, dates, statut, coût). La qualification fiscale appartient à un BC `Fiscalité` distinct (Phase 5).
- Phase 5 introduira un VO `CategorisationFiscaleTravaux` dans son propre BC, référençant `TicketTravauxId`. **Aucun couplage retour** sur `tickets_travaux`.

Raisons Vision :
- Sobre + YAGNI. Re-saisie sur N=5-20 tickets V1 = négligeable, et Phase 5 propose des défauts heuristiques (libellé/montant).

**Choix utilisateur : Option 2.**

---

## Batch 4 — UI / Sécurité / Dossier locataire (gray areas 13-16)

### 13. UI upload — quelle interaction V1 ?

**Options présentées :**
1. `<input type="file">` natif, 1 fichier, `<progress>` natif *(Recommandé)*
2. Drag&drop avec fallback input file
3. Multi-upload natif (`<input multiple>`)

**Choix utilisateur : Option 1 + note "drag&drop V2 priorité HAUTE".**

→ Drag&drop + multi-upload explicitement flagués priorité haute V2 dans `<deferred>` de CONTEXT.md.

---

### 14. Visualisation des fichiers stockés — comment ?

**Options présentées :**
1. PDF/HEIC/JPG en nouvel onglet via `<a target="_blank">` *(Recommandé)*
2. Iframe PDF inline sur fiche détail
3. Aperçu thumbnail généré côté serveur

**L'utilisateur demande la recommandation alignée frontend best practices + Vision + DDD.**

**Recommandation Claude : Option 1.**
- Frontend pratique : visualiseur natif du navigateur (zoom, recherche, impression, sauvegarde gratuits). Zero JS custom.
- Vision (sobre + audit-friendly) : fichier visualisé = fichier persisté octet pour octet. Aucune transformation. Preuve juridique inchangée.
- DDD : visualisation = infra UI pure ; option 1 maintient la séparation.
- A11y (WCAG 2.1 AA) : visualiseur natif OS = a11y mature. Iframe = focus/keyboard piégeux.
- Option 3 (thumbnails serveur) = over-engineering V1. Phase 7 dashboard peut ajouter si besoin.

**Choix utilisateur : Option 1.**

---

### 15. Validation sécurité upload — magic-bytes ou MIME header seul ?

**Options présentées :**
1. Magic-bytes + MIME header croisés *(Recommandé)*
2. MIME header HTTP seul
3. Extension fichier seule

**Choix utilisateur : Option 1.** Magic-bytes côté serveur + Content-Type croisés. Magic gagne en cas de conflit. OWASP A04:2021.

---

### 16. Dossier locataire — structurer ou simple filtrage ?

**Options présentées :**
1. Simple : Justificatif rattaché à locataireId, filtrage par type *(Recommandé)*
2. Sous-agrégat `DossierLocataire` avec catégories CAF/garant/assurance
3. Pas de rattachement Locataire pour pièces privées V1

**L'utilisateur penche pour Option 1 et demande la recommandation DDD + Vision.**

**Recommandation Claude : Option 1 confirmée — plus DDD-friendly + plus Vision-aligned.**

Raisons DDD :
- Pas de cycle de vie distinct du `Locataire` (le dossier naît/meurt avec le locataire) → pas d'agrégat racine justifié.
- Pas d'invariants propres ("CNI + fiche paie obligatoires" = règle d'agence de sélection, pas du bailleur LMNP particulier). Sans invariants → pas d'agrégat.
- "Catégories CAF/garant/assurance" = taxonomie, modélisable comme valeur de `TypeJustificatif` enum, pas comme agrégat.

Raisons Vision :
- LMNP mono-user particulier ne fait pas de workflow de sélection candidat structuré. Vision = sobre.
- ROADMAP V2 mentionne "sélection candidat" hors V1 → si ça arrive, **alors** introduire un agrégat `DossierCandidat` propre. YAGNI strict V1.
- RGPD compatible : soft-delete + corbeille + purge 10 ans = mécanismes communs.

**Choix utilisateur : Option 1.**

---

## Récapitulatif des arbitrages

| # | Gray area | Décision | Auto-discussion v1 conservée ? |
|---|---|---|---|
| 1 | Justificatif BC | Agrégat racine BC Documents | ✓ |
| 2 | Rattachement | 2 FK nullables + invariant | ✓ |
| 3 | Catégorisation | Enum fixe versionné | ✓ |
| 4 | Formats + taille | PDF/JPG/PNG/HEIC/WebP, 50 Mo + port `ConvertisseurImage` | ✗ étendu (v1 = 20 Mo PDF/JPG/PNG) |
| 5 | Stockage | **Nouveau port `StockageJustificatifs` dédié** | ✗ (v1 = extension `StockageFichierLocal`) |
| 6 | Rétention 10 ans | Soft-delete + hard-block | ✓ |
| 7 | Recherche | LIKE + facettes | ✓ |
| 8 | Vue coffre | **Pas d'inclusion docs générés Phase 4** (différé Phase 7) | ✗ (v1 = `/coffre/generes` inclus) |
| 9 | TicketTravaux BC | Agrégat racine BC Travaux | ✓ |
| 10 | Liaison | Table N:N | ✓ |
| 11 | Workflow ticket | 1 page + panneau PJ | ✓ |
| 12 | Champ `nature` | **Différé Phase 5 via VO `CategorisationFiscaleTravaux` dans BC Fiscalité** | ✗ (v1 = inclus dès Phase 4) |
| 13 | UI upload | Input file natif + `<progress>` (drag&drop V2 priorité HAUTE) | ✓ + note priorité |
| 14 | Visualisation | Nouvel onglet `<a target="_blank">` | ✓ |
| 15 | Sécurité upload | Magic-bytes + MIME croisés | ✓ |
| 16 | Dossier locataire | Simple filtrage par type | ✓ |

**4 changements substantiels vs v1 auto** : décisions 4, 5, 8, 12.

---

*Discussion conduite par Claude (Opus 4.7) avec Valentin Dumas le 2026-05-18.*
*Backup v1 auto : `04-CONTEXT.v1-auto.bak.md`.*
*Plan d'exécution : `~/.claude/plans/oui-eager-waffle.md`.*

---

# Phase 4 — UI Discussion (restart 2026-05-18)

**Mode :** Interactive (6 batches AskUserQuestion sur ~22 gray areas UI).
**Plan d'exécution :** `~/.claude/plans/restart-to-plan-ui-adaptive-honey.md`.
**Backup v1 :** `04-UI-SPEC.v1-auto.bak.md` (UI-SPEC généré par `gsd-ui-researcher` sans arbitrage utilisateur).

Le UI-SPEC v1 a inféré ~25 décisions UI à partir de CONTEXT.md (D-111, D-114, D-116→D-120) + inventory `app.css`/`Pico.css`. L'utilisateur a explicitement demandé à arbitrer chaque gray area UI plutôt que valider en bloc l'auto-génération (pattern identique aux batches CONTEXT 1-4).

Gray areas hors périmètre (déjà tranchées CONTEXT.md) : upload natif `<input file>` + `<progress>` (D-116), visualisation `<a target="_blank">` PDF/`<img>` JPG (D-117), magic-bytes server (D-118), 4 empty states + copy clé (D-119), `/coffre` page principale + sidebar entry high level (D-111), workflow ticket méta + PJ (D-114), fiche Locataire Documents filtré (D-120).

---

## Batch UI-1 — Design tokens & badges (gray areas UI 1-4)

### UI-1.1 — Spacing scale Phase 4

**Options présentées :**
1. 7 tokens `4/8/16/24/32/48/64` + exception touch 44px *(Recommandé — cohérence Phase 1 D-42)*
2. 5 tokens compactes `4/8/16/24/32`
3. Pico classless pur (aucun token explicite)

**Choix utilisateur : Option 1.** Confirmation des 7 tokens de l'échelle 8-pt + touch target 44x44px (WCAG 2.5.5). Identique à Phase 1.

---

### UI-1.2 — Typography

**Options présentées :**
1. 4 tailles `14/16/20/28` + poids `400/600/700` *(Recommandé)*
2. 3 tailles `14/16/24` + `400/600`
3. 5 tailles avec tabular monospace 18 pour montants

**Choix utilisateur : Option 1.** Pico v2 defaults préservés : label 14 / body 16 / h2 section 20 / h1 page 28. Poids 400 body, 600 section, 700 page title. Zero override CSS, cohérent `app.css .error-msg 0.875rem`.

---

### UI-1.3 — Color palette : tokens CSS ou hex inline ?

**Options présentées :**
1. Tokens CSS dans `:root` *(Recommandé)*
2. Hex inline dans partials (pattern actuel)
3. Hybride — tokens 5 sémantiques + hex variations DPE

**L'utilisateur a demandé une recommandation alignée UI/UX/A11y best practices, avec un petit refactoring inclus si Option 1.**

**Recommandation Claude : Option 1 confirmée — best-aligned UI/UX/A11y.**

Raisons :
- **DRY (Single Source of Truth)** — 1 endroit pour la palette au lieu de 6+ duplications inline (banniere-success/warning, error-msg, sidebar active, DPE badge, futurs badge-statut-ticket).
- **A11y audit** — contrast ratios vérifiables à 1 endroit. Si on monte `#d97706` (contraste 3.13:1 sur fond blanc), on n'oublie pas un partial.
- **Alignement Pico v2** — Pico utilise déjà des CSS custom properties (`--pico-*`). Notre couche `--couleur-*` s'inscrit dans la même grammaire.
- **Dark mode futur** — override `:root[data-theme="dark"]` suffira sans toucher les partials.
- **Maintenance** — refresh palette = 1 commit, pas chasse aux hex.

**Petit refactoring inclus (acté par l'utilisateur) :**
- Déclarer dans `:root` de `src/web/styles/app.css` :
  ```css
  :root {
    --couleur-accent: #1d4ed8;
    --couleur-accent-bg: #dbeafe;     /* pour pill active step wizard */
    --couleur-warning: #d97706;
    --couleur-warning-bg: #fef3c7;
    --couleur-destructive: #dc2626;
    --couleur-destructive-bg: #fee2e2;
    --couleur-success: #16a34a;
    --couleur-success-bg: #d1fae5;
    --couleur-neutre: #6b7280;
    --couleur-neutre-bg: #f3f4f6;
  }
  ```
- Remplacer dans `app.css` les hex hardcodés actuels (`.banniere-warning`, `.banniere-success`, `.error-msg`, `nav[aria-current]`, `ol li[aria-current="step"]`) par `var(--couleur-...)`.
- Conserver `partial-badge-dpe.ejs` avec ses hex inline (échelle A→G = 7 nuances non-réutilisables, hors palette sémantique — cohérent option Hybride locale).
- Nouveau `partial-badge-statut-ticket.ejs` utilisera `var(--couleur-...)` pour ses 4 statuts mappés sur la palette sémantique.

**Choix utilisateur : Option 1 + refactoring.**

→ Décision verrouillée : tokens CSS `:root` + refactoring app.css extraction des hex sémantiques. DPE badge garde son pattern inline (variations 7 nuances spécifiques).

---

### UI-1.4 — Badge statut TicketTravaux

**Options présentées :**
1. Nouveau `partial-badge-statut-ticket.ejs` (clone DPE pattern) *(Recommandé)*
2. Generic `partial-badge.ejs` paramétré
3. Texte simple sans badge

**Choix utilisateur : Option 1.** Créer `partial-badge-statut-ticket.ejs` qui reproduit la structure inline-styled `<span>` + `aria-label` de `partial-badge-dpe.ejs`. Cohérence visuelle cross-domain (DPE / Ticket = même look pill). Mapping statut → couleur sémantique (cf. UI-1.3) :

| Statut | Couleur sémantique | CSS var |
|---|---|---|
| `ouvert` | accent (bleu) | `var(--couleur-accent)` + `var(--couleur-accent-bg)` |
| `en_cours` | warning (ambre) | `var(--couleur-warning)` + `var(--couleur-warning-bg)` |
| `clos` | success (vert) | `var(--couleur-success)` + `var(--couleur-success-bg)` |
| `annule` | neutre (gris) | `var(--couleur-neutre)` + `var(--couleur-neutre-bg)` |

`aria-label="Statut : {libellé long}"` (ex: "Statut : en cours" — verbatim à confirmer Batch UI-6 copywriting).

---

## Batch UI-2 — Sidebar & navigation Phase 4 (gray areas UI 5-7)

### UI-2.1 — Position de 'Coffre documentaire' dans la sidebar

**Options présentées :**
1. Après Baux, avant Encaissements *(Recommandé)*
2. Après Encaissements
3. Racine séparée en fin avec `<hr>`

**L'utilisateur a demandé une recommandation alignée UI/UX/A11y + Vision (entre 1 ou 2).**

**Recommandation Claude : Option 1 confirmée — best-aligned workflow + Vision.**

Raisons :
- **Workflow logique** — Patrimoine (Biens) → Personnes (Locataires) → Contrats (Baux) → **Preuves (Coffre)** → Opérations (Encaissements) → Settings (Profil). Ordre du cycle de vie : monter un bien, signer un bail, classer les preuves, encaisser.
- **Jakob's law** — les utilisateurs s'attendent à voir les ressources groupées par étape de cycle de vie. Coffre = transverse aux étapes amont (bien/locataire/bail), placé juste après les "setup" et avant les "actions financières".
- **Vision audit-friendly** — le coffre est central à la raison d'être de l'app (preuve 10 ans). Le placer en milieu de sidebar élève son importance perçue. Option 2 le reléguerait en queue = inférence "moins prioritaire".
- **Cognitive load** — Encaissements a un dropdown (5 sub-entries quotidiennes). Coffre en amont = on consulte/classe avant d'agir financièrement.
- **UI_DESIGN** — pas d'impact sur la dominance écran.
- **A11y** — aucun impact (semantic HTML conservée).

**Choix utilisateur : Option 1.** Sidebar finale :

```
1. Biens
2. Locataires
3. Baux
4. Coffre documentaire        ← NOUVEAU
5. Encaissements (dropdown)
   - Toutes les échéances
   - Encaissements
   - Quittances
   - Impayés
   - Relances
6. Profil bailleur
```

`navActive` value : `'coffre'`.

---

### UI-2.2 — Libellé sidebar

**Options présentées :**
1. "Coffre documentaire" *(Recommandé)*
2. "Coffre"
3. "Documents"

**Choix utilisateur : Option 1.** "Coffre documentaire" — explicite, audit-friendly (mot "coffre" porte la connotation sécurité/preuve = vision), portée claire (différenciation possible de futurs "coffres" — non prévu V1 mais robuste).

---

### UI-2.3 — Sub-entries Coffre

**Options présentées :**
1. Entrée simple + lien corbeille depuis `/coffre` *(Recommandé)*
2. Dropdown : Coffre / Corbeille (pattern Encaissements)
3. Dropdown étendu : Coffre / Corbeille / Ajouter un document

**Choix utilisateur : Option 1.** Sidebar plate : 1 entrée "Coffre documentaire" → `/coffre`. Lien "Corbeille (N)" affiché dans le header de la page `/coffre` (au-dessus de la table, à côté du CTA "Ajouter un document"). N = nombre de justificatifs soft-deleted.

Justifications (cohérentes recommandation Claude) :
- **Hick's law** — moins de choix sidebar = moins de décision cognitive.
- **Encaissements dropdown ≠ généralisation** — les 5 sub-entries Encaissements sont **toutes** quotidiennes. Corbeille = action peu fréquente, ne mérite pas une entrée sidebar permanente.
- **UX best practice** — sidebar entries = **destinations principales**, pas actions secondaires. La corbeille est une action de gestion (restauration/purge) accessible depuis `/coffre`.
- **Empty state** — si pas de docs en corbeille, le lien header sera masqué (ou indiqué "(0)") — cohérent D-119 empty states.

---

## Batch UI-3 — /coffre liste : layout, columns, filtres (gray areas UI 8-11)

### UI-3.1 — Colonnes table justificatifs sur `/coffre`

**Options présentées :**
1. `date | type | titre | bien | locataire | montant | actions` *(Recommandé — pattern projet)*
2. `titre | type | date | bien | locataire | montant | actions` (scannabilité titre)
3. 5 colonnes condensé : `titre | type | date | rattachement | actions` (montant déplacé fiche détail)

**Choix utilisateur : Option 1.** 7 colonnes, ordre `date | type | titre | bien | locataire | montant | actions`. Cohérent pattern projet observé (quittances, encaissements, échéances commencent toutes par date). Audit-friendly (tri chronologique immédiat). Bien/locataire affichés = `—` si pas applicable (cohérent invariant D-103 : au moins l'un des deux non-null).

---

### UI-3.2 — Layout des filtres sur `/coffre`

**Options présentées :**
1. Barre haute compacte inline + lien "Effacer les filtres" *(Recommandé)*
2. Section `<details>` repliable
3. Sidebar gauche dédiée (panel fixe)

**Choix utilisateur : Option 1 + Option 3 reportée V1.1+.** Bloc filtres au-dessus de la table : `[search] [bien▾] [locataire▾] [année▾] [type▾] [bouton Filtrer]` + lien "Effacer les filtres" affiché conditionnellement (seulement si filtres actifs). Visibles immédiatement (Doherty). Aligne avec `<form method="GET">` + Pico classless.

→ **V1.1+ deferred** : passage à sidebar gauche dédiée si le volume de filtres augmente (ex : ajout filtres "fournisseur", "mois", "tag").

---

### UI-3.3 — URL params naming sur `/coffre`

**Options présentées :**
1. camelCase single-word : `?q=&bien=&locataire=&annee=&type=&page=` *(Recommandé — cohérent `echeanceId`, `bail`, `statut` du projet)*
2. Verbeux : `?search=&bien=&locataire=&annee=&type=&page=`
3. Avec suffixe Id : `?q=&bienId=&locataireId=&annee=&type=&page=`

**Choix utilisateur : Option 2.** URL params verbeux : `?search=&bien=&locataire=&annee=&type=&page=`. Le `search` explicite > `q` conventionnel (Vision sobre : moins d'abstraction implicite, l'utilisateur lit l'URL et comprend immédiatement).

→ Décision verrouillée : utiliser `search` au lieu de `q` dans tous les formulaires du coffre. Pas d'incohérence projet (les autres listings n'ont pas de search libre — c'est nouveau Phase 4).

---

### UI-3.4 — Visibilité des row actions

**Options présentées :**
1. Pattern `.row-actions` existant (hidden + show on `tr:hover/focus-within`) *(Recommandé initialement — réutilisation Phase 1-2)*
2. Visibles permanentes (boutons textuels persistants)
3. Menu kebab (⋮) déroulant

**L'utilisateur penche Option 2 + demande recommandation Claude sur le passage cross-cutting des `.row-actions` existants (Phase 1-2 sur quittances/encaissements) à always-visible si A11y plus compliant.**

**Recommandation Claude : Option 2 confirmée — strictement plus A11y-compliant.**

Analyse WCAG 2.1 AA :
- **WCAG 2.4.4 Link Purpose (in Context)** — un lien doit être identifiable dans son contexte sans interaction préalable. Pattern hidden = lien non identifiable tant qu'il n'est pas révélé.
- **WCAG 3.3.2 Labels or Instructions** — labels visibles et opérables. Pattern hidden = label non visible par défaut.
- **WCAG 2.5.5 Target Size (AAA)** — cibles ≥ 44px. Pattern hidden : la cible existe mais non visible = elle peut être théoriquement de bonne taille mais le contraste visuel zero la rend non identifiable.
- **Touch devices** — pas de hover possible. `tr:focus-within` fonctionne au clavier mais l'utilisateur touch doit "tap" ailleurs pour focus, ce qui n'est pas intuitif (Pattern UX cassé sur mobile).
- **Cognitive impairments** — discoverability réduite si actions hidden. Utilisateur ne sait pas qu'elles existent.
- **Doherty Principle** — feedback < 400ms idéal. Hidden = feedback retardé jusqu'à hover/focus.

Trade-off acté :
- **Visual clutter** — atténué par couleur sobre (`var(--pico-muted-color)`), boutons texte (pas d'icônes lourdes), alignement à droite, padding compact. Cf. patch léger `data-table.ejs`.

**Refactor cross-cutting (acté utilisateur)** :
- **Scope minime — pas une refonte massive** : `.row-actions` est centralisé dans `src/web/views/partials/data-table.ejs` (1 partial) + `public/styles/app.css` lignes 19-25 (7 lignes CSS).
- **Action concrète** :
  - Supprimer `public/styles/app.css` lignes 19-25 (`.row-actions { visibility: hidden }` + reveals).
  - Optionnellement ajouter style atténuation visuelle dans `data-table.ejs` partial : `<td class="row-actions" style="color: var(--pico-muted-color); text-align: right;">…</td>`.
- **Impact pages** : toutes les listings utilisant `data-table.ejs` (quittances, encaissements, échéances, baux, biens, locataires, impayés, relances) verront leurs row actions devenir visibles. Cohérence UX cross-projet conservée.
- **Pas de régression fonctionnelle** : les actions étaient déjà accessibles via Tab/clavier ; elles deviennent juste visibles immédiatement.

**Choix utilisateur : Option 2 confirmée.**

→ Décision verrouillée : (a) row actions always-visible dans Phase 4 ; (b) refactor cross-cutting de `data-table.ejs` + `app.css` lignes 19-25 dans la même session.

---

## Batch UI-4 — Upload form & fiche justificatif (gray areas UI 12-15)

### UI-4.1 — Ordre des champs du formulaire upload

**Options présentées :**
1. `fichier → titre → date → type → bien → locataire → montant → notes` *(Recommandé)*
2. `fichier → type → titre → date → bien → locataire → montant → notes`
3. `fichier → titre → type → date → montant → bien → locataire → notes`

**Choix utilisateur : Option 1.** Action centrale (fichier) en premier. Puis méta descriptive (titre, date, type). Puis rattachement (bien, locataire). Puis financier (montant). Puis libre (notes). Hick's law : groupes logiques minimisent la charge cognitive.

Hint formats accepté placé **directement sous le label "Fichier"** (cohérent A11y `aria-describedby` D-116) : *"PDF, JPG, PNG, HEIC, WebP — max 50 Mo"*.

---

### UI-4.2 — Matérialisation de l'invariant ≥1 bien/locataire

**Options présentées :**
1. Radio mutex `Rattacher à …` + dropdowns conditionnels *(Recommandé)*
2. 2 dropdowns indépendants + validation server uniquement
3. Tabs (3 onglets)

**Choix utilisateur : Option 1.** Pattern :

```html
<fieldset>
  <legend>Rattacher à</legend>
  <label><input type="radio" name="rattachement" value="bien"> Un Bien</label>
  <label><input type="radio" name="rattachement" value="locataire"> Un Locataire</label>
  <label><input type="radio" name="rattachement" value="bien_et_locataire"> Un Bien et un Locataire</label>
</fieldset>

<div class="field-rattachement-bien">
  <label for="bien">Bien</label>
  <select id="bien" name="bien">…</select>
</div>

<div class="field-rattachement-locataire">
  <label for="locataire">Locataire</label>
  <select id="locataire" name="locataire">…</select>
</div>
```

**Implémentation conditional show :**
- **Préféré V1** : CSS-only via `:has()` selector (browser support 2026 ≥ 89 % Baseline) ou sibling combinator. Aucun JS custom.
- **Fallback gracieux** : si CSS non supporté ou désactivé, les 2 dropdowns sont visibles. L'invariant tient toujours via validation serveur (D-103). Pas de regression fonctionnelle.

**Implémentation détaillée (à valider par l'executor)** :
```css
fieldset + .field-rattachement-bien,
fieldset + .field-rattachement-locataire {
  display: none;
}
fieldset:has(input[value="bien"]:checked) + .field-rattachement-bien { display: block; }
fieldset:has(input[value="locataire"]:checked) + .field-rattachement-bien + .field-rattachement-locataire { display: block; }
/* etc. — DP raffinement laissé au plan-phase */
```

**Doherty + prévention > correction** : 0 erreur possible à la soumission. Plus de friction (1 question), mais l'utilisateur est guidé pas à pas.

---

### UI-4.3 — Layout fiche `/justificatifs/:id`

**Options présentées :**
1. Méta haut + preview pleine largeur dessous (1 colonne) *(Recommandé)*
2. Preview à gauche + méta + actions à droite (2 colonnes)
3. Preview pleine largeur + méta dessous (1 colonne)

**Choix utilisateur : Option 1.** Layout 1 colonne :

```
[breadcrumbs]
[H1 titre du justificatif]
[Section Méta]
  Type | Date | Bien | Locataire | Montant | Notes
[Actions inline] : Télécharger | Modifier | Mettre en corbeille
[Preview pleine largeur]
  Si PDF/HEIC/WebP : <a target="_blank">Ouvrir le fichier (Nouvel onglet)</a>
  Si JPG/PNG : <img src="…/fichier" alt="{titre}">
```

Raisons :
- **Mobile-friendly natif** — 1 colonne ne nécessite pas de media queries.
- **Pico classless aligne** — pas besoin de CSS Grid/Flex custom.
- **A11y** — ordre de lecture linéaire prévisible (Screen reader friendly).
- **Action discovery** — actions immédiatement visibles sous la méta (avant que l'utilisateur scrolle dans la preview).

---

### UI-4.4 — Actions sur la fiche justificatif

**Options présentées :**
1. Boutons inline visibles *(Recommandé)*
2. Menu kebab (⋮)
3. Sidebar actions panel droite

**Choix utilisateur : Option 1.** Actions affichées en boutons texte alignés horizontalement sous la section méta :

```html
<div class="actions" style="display: flex; gap: 8px; margin-top: 16px;">
  <a href="/justificatifs/:id/fichier" download role="button">Télécharger</a>
  <a href="/justificatifs/:id/modifier" role="button" class="secondary">Modifier</a>
  <form method="POST" action="/justificatifs/:id/corbeille" style="display: inline;">
    <button type="submit" style="color: var(--couleur-destructive); border-color: var(--couleur-destructive);">
      Mettre en corbeille
    </button>
  </form>
</div>
```

Cohérent UI-3.11 (always-visible). Destructive stylé avec `var(--couleur-destructive)` (acté UI-1.3). A11y maximum (discoverability).

Note implémentation : le bouton "Mettre en corbeille" déclenche `confirm-dialog.ejs` (pattern Phase 1 D-46) avant POST.

---

## Batch UI-5 — Corbeille, Tickets, Fiches augmentées (gray areas UI 16-19)

### UI-5.1 — Affichage de la rétention en corbeille

**Options présentées :**
1. Bouton 'Purger' désactivé + colonne 'Date purge possible' *(Recommandé)*
2. Pas de bouton avant date + `.banniere-warning` inline
3. Badge passif 'Conservation 10 ans' + check serveur

**Choix utilisateur : Option 1.** Table `/coffre/corbeille` :

| date corbeille | type | titre | bien | locataire | date purge possible | actions |
|---|---|---|---|---|---|---|
| 2026-01-15 | facture | Réparation chauffe-eau | App. Rue de Paris | — | 2036-01-15 | `[Restaurer]` `[Purger]` (disabled jusqu'à 2036-01-15) |

**Détails A11y :**
- Bouton "Purger" `disabled` + `aria-disabled="true"` si `today < date_purge_possible`.
- `title="Disponible le {date}"` pour info au hover (et exposé screen reader via `aria-describedby` vers la cellule date).
- Bouton conserve la taille WCAG 2.5.5 même désactivé (cibles ≥ 44px).
- Audit-friendly : la date de purge possible est **visible directement en colonne** (pas masquée derrière un tooltip uniquement). L'utilisateur calcule son calendrier de purge en un coup d'œil.

**Cohérent D-109** : domain `Justificatif.peutEtrePurge(today)` reste la source de vérité. UI affiche conditionnement, serveur ré-valide au POST.

---

### UI-5.2 — Colonnes table tickets sur `/biens/:id/travaux`

**Options présentées :**
1. `titre | statut | date-ouverture | date-cloture | cout-estime | cout-reel | actions` *(Recommandé)*
2. `date-ouverture | titre | statut | date-cloture | cout-estime | cout-reel | actions`
3. 5 colonnes condensé (dates et coûts fusionnés)

**Choix utilisateur : Option 1.** 7 colonnes. Titre en premier (différence d'avec justificatifs `date-first`) — rationale : un ticket = sujet de chantier, l'utilisateur scanne par sujet ("le chauffe-eau ?"), pas par date. Date de clôture / coût réel = `—` si statut ∈ {ouvert, en_cours, annule}.

Badge statut (acté UI-1.4) inline dans la colonne `statut` — composant `partial-badge-statut-ticket.ejs`.

---

### UI-5.3 — Layout fiche ticket `/travaux/:id`

**Options présentées :**
1. Méta → Pièces jointes → Clôture inline (si statut ouvert/en_cours) *(Recommandé)*
2. Méta → PJ → Historique notes timestampées → Clôture (scope creep)
3. Tabs (anti-pattern A11y/Pico)

**Choix utilisateur : Option 1.** 3 sections empilées 1 colonne :

```
[breadcrumbs]
[H1 titre du ticket]
[H2 Méta]
  Description | Date ouverture | Date clôture (— si null) | Coût estimé | Coût réel (— si null)
  Badge statut (composant UI-1.4)
  [Actions inline] : Modifier | Annuler le ticket (destructive)
[H2 Pièces jointes]
  Table des justificatifs liés (réutilise data-table.ejs)
  [Bouton "Ajouter une PJ" inline] → réutilise flow upload Phase 4 (D-114)
[H2 Clôture]  ← rendu seulement si statut ∈ {ouvert, en_cours}
  Formulaire inline :
    [Date clôture] [Coût réel TTC] [Bouton "Clore le ticket"]
```

**Section "Historique" déférée** : noté V2 dans `<deferred>` CONTEXT.md. Pas de modèle `NoteTicket` ajouté V1 (scope creep).

**Cohérent UI-4.3** : layout 1 colonne, mobile-friendly, A11y ordre de lecture linéaire.

---

### UI-5.4 — Sections ajoutées aux fiches existantes Bien et Locataire

**Options présentées :**
1. Bien : Documents (5 derniers + lien) + Travaux (tickets ouverts + lien + CTA) ; Locataire : Documents filtrée par type (5 derniers + lien) *(Recommandé)*
2. Tout listé sans pagination
3. Pas de section embedded, lien externe uniquement

**Choix utilisateur : Option 1.** Spécifications :

**Fiche Bien (`pages/biens/detail.ejs`)** — ajouter :

```
[Section existante : Adresse, type, surface, etc.]

[H2 Documents]
  Aperçu : 5 derniers Justificatif s rattachés à ce Bien (réutilise data-table.ejs réduit, colonnes : date | type | titre | montant)
  Lien : "Voir tous les documents de ce Bien (N)" → /coffre?bien=:id
  Empty state : "Aucun document rattaché à ce Bien." (cohérent D-119)

[H2 Travaux]
  Aperçu : tickets statut ∈ {ouvert, en_cours} (max 5 — Miller ±2)
  Lien : "Voir tous les tickets (N)" → /biens/:id/travaux
  CTA : "Nouveau ticket" → /travaux/nouveau?bienId=:id
  Empty state : "Aucun ticket pour ce Bien. Le premier ticket sert souvent à tracer la mise en service du logement." (D-119)
```

**Fiche Locataire (`pages/locataires/detail.ejs`)** — ajouter :

```
[Section existante : Identité, contact, etc.]

[H2 Documents]
  Dropdown filtre inline : <select name="type">Tous | piece_locataire | releve_bancaire | attestation | autre</select>
  Aperçu : 5 derniers Justificatif s rattachés à ce Locataire (filtré par type sélectionné — submit GET sur la même page)
  Lien : "Voir tous les documents de ce Locataire (N)" → /coffre?locataire=:id
  Empty state : "Aucun document rattaché à ce Locataire."
```

**D-120 confirmé** : simple filtrage par type, pas de sous-agrégat `DossierLocataire`.

---

## Batch UI-6 — Copywriting verbatim & A11y (gray areas UI 20-22)

### UI-6.1 — Verbatim des CTAs primaires

**Options présentées :**
1. Verbatim proposés *(Recommandé)*
2. Variante formelle ("Téléverser", "Clôturer")
3. Variante concise ("Ajouter", "Nouveau")

**Choix utilisateur : Option 1.** CTAs verrouillés :

| Action | Verbatim | Lieu |
|---|---|---|
| Upload nouveau document | "Ajouter un document" | `/coffre` header + `/coffre/upload` submit |
| Nouveau ticket travaux | "Nouveau ticket" | Fiche Bien CTA + `/biens/:id/travaux` header |
| Soumettre upload | "Téléverser le document" *(submit form `/coffre/upload`)* | Bouton submit final |
| Restaurer depuis corbeille | "Restaurer" | Row actions `/coffre/corbeille` |
| Clore le ticket | "Clore le ticket" | Section Clôture sur `/travaux/:id` |
| Purger définitivement | "Purger définitivement" | Row actions `/coffre/corbeille` (conditional) |
| Soft-delete justificatif | "Mettre en corbeille" | Row actions `/coffre`, fiche justificatif |
| Confirmer purge | "Purger définitivement" | Bouton dans `confirm-dialog.ejs` |
| Confirmer mise en corbeille | "Mettre en corbeille" | Bouton dans `confirm-dialog.ejs` |
| Ajouter PJ ticket | "Ajouter une pièce jointe" | Section PJ sur `/travaux/:id` |

**Note 'Téléverser' vs 'Ajouter'** : "Ajouter un document" est le CTA primaire pour ouvrir le flow upload (= destination `/coffre/upload`). Le bouton submit final du form lui-même peut être "Téléverser le document" (action explicite) — à confirmer ou ajuster en plan-phase si redondant.

→ Verbatim factuel + verbe + nom. "Mettre en corbeille" préféré à "Supprimer" (cohérent D-109 réversible + audit-friendly).

---

### UI-6.2 — Verbatim des messages d'erreur

**Options présentées :**
1. Factuel non paternaliste *(Recommandé — R4.3 RISKS)*
2. Variante explicative ("Votre fichier...")
3. Variante système (codes erreur)

**Choix utilisateur : Option 1.** Messages verrouillés :

| Contexte | Verbatim |
|---|---|
| Upload format rejeté | "Format non accepté. Formats autorisés : PDF, JPG, PNG, HEIC, WebP." |
| Upload taille dépassée (413) | "Fichier trop volumineux. La taille maximale est 50 Mo." |
| Champ titre vide | "Le titre est obligatoire." |
| Date document absente | "La date du document est obligatoire." |
| Invariant ≥1 bien/locataire violé | "Le document doit être rattaché à un bien ou à un locataire." |
| Type non sélectionné | "Le type de document est obligatoire." |
| Ticket : titre vide | "Le titre du ticket est obligatoire." |
| Ticket : description vide | "La description est obligatoire." |
| Ticket : date ouverture future | "La date d'ouverture ne peut pas être dans le futur." |
| Ticket : clôture sans coût réel | "Le coût réel TTC est obligatoire pour clore le ticket." |
| Justificatif corrompu (magic-bytes mismatch) | "Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité." |
| Tentative purge avant 10 ans | "Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date." (D-109) |
| Bien introuvable | "Bien introuvable." |
| Locataire introuvable | "Locataire introuvable." |
| Justificatif introuvable | "Document introuvable." |
| TicketTravaux introuvable | "Ticket introuvable." |

**Banners de succès** :
| Contexte | Verbatim |
|---|---|
| Upload réussi | "Document ajouté." |
| Mise en corbeille | "Document déplacé vers la corbeille." |
| Restauration | "Document restauré." |
| Purge | "Document supprimé définitivement." |
| Ticket créé | "Ticket créé." |
| Ticket clôturé | "Ticket clôturé." |
| PJ ajoutée à ticket | "Pièce jointe ajoutée au ticket." |

**Banner warning rétention (inline corbeille)** :
> "Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date."

(D-109 verbatim conservé.)

Ton : factuel, sujet-verbe-complément, court. Vision = utilisateur autonome non technicien.

---

### UI-6.3 — Patterns A11y spécifiques Phase 4

**Options présentées :**
1. `rel='noopener'` + `.sr-only` "(nouvel onglet)" ; `progress` `aria-label` + `aria-live` wrapper ; badges `aria-label` complet *(Recommandé)*
2. Minimaliste (pas de `.sr-only` hint, pas de wrapper aria-live)
3. Verbose (over-ARIA marking)

**Choix utilisateur : Option 1.** Patterns A11y verrouillés Phase 4 :

**(a) Liens `<a target="_blank">`** (visualisation PDF/HEIC/WebP — D-117) :
```html
<a href="/justificatifs/:id/fichier" target="_blank" rel="noopener noreferrer">
  Ouvrir le fichier
  <span class="sr-only">(s'ouvre dans un nouvel onglet)</span>
</a>
```
- `rel="noopener noreferrer"` : sécurité (pas d'accès `window.opener` parent).
- `.sr-only` : annonce explicite pour screen readers (WCAG 2.4.4 + 3.2.2 Predictable).

**(b) `<progress>` upload** (D-116) :
```html
<div aria-live="polite" data-uploading-wrapper>
  <progress aria-label="Téléversement en cours" max="100" value="<%= valeur %>">
    <%= valeur %>%
  </progress>
</div>
```
- `aria-live="polite"` sur le wrapper : annonce non-intrusive du progrès (vs "assertive" qui interromprait).
- `aria-label` sur `<progress>` : étiquette explicite (le `<progress>` natif n'a pas de label intrinsèque).
- Texte fallback dans `<progress>` : pour user agents non supportés.

**(c) Badges statut (TicketTravaux + futures)** :
```html
<span aria-label="Statut : en cours" style="background: var(--couleur-warning-bg); color: var(--couleur-warning); padding: 2px 6px; border-radius: 4px;">
  en cours
</span>
```
- `aria-label` complet : exposition screen reader du contexte ("Statut : en cours").
- Texte visible dans `<span>` : jamais color-only (WCAG 1.4.1).
- Couleurs : tokens UI-1.3 `var(--couleur-*)`.

**(d) `<input type="file">` accessible** (D-116) :
```html
<label for="fichier">Fichier</label>
<input id="fichier" name="fichier" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" required aria-describedby="fichier-hint">
<p id="fichier-hint">PDF, JPG, PNG, HEIC, WebP — max 50 Mo</p>
```
- `<label for>` + `id` : association explicite.
- `aria-describedby` : pointe vers le hint (formats + taille).
- Pas de `placeholder` seul (anti-pattern WCAG 1.3.1).

**(e) `confirm-dialog.ejs` réutilisé** (pattern Phase 1) : déjà `autofocus` sur le bouton Cancel + ESC pour fermer.

---

## Récapitulatif arbitrages UI (Phase 4 restart 2026-05-18)

| # | Gray area UI | Décision | Recommandé Claude ? |
|---|---|---|---|
| UI-1.1 | Spacing scale | 7 tokens `4/8/16/24/32/48/64` + touch 44px | ✓ |
| UI-1.2 | Typography | 4 tailles `14/16/20/28` + 3 poids `400/600/700` | ✓ |
| UI-1.3 | Color palette | **Tokens CSS `:root`** + refactor `app.css` (DPE garde hex inline) | ✓ + scope ajout refactor |
| UI-1.4 | Badge statut Ticket | Nouveau `partial-badge-statut-ticket.ejs` (clone DPE pattern) | ✓ |
| UI-2.1 | Position sidebar | **Après Baux, avant Encaissements** | ✓ |
| UI-2.2 | Libellé sidebar | "Coffre documentaire" | ✓ |
| UI-2.3 | Sub-entries | Entrée plate + lien corbeille dans header `/coffre` | ✓ |
| UI-3.1 | Colonnes table justificatifs | `date | type | titre | bien | locataire | montant | actions` | ✓ |
| UI-3.2 | Layout filtres | Barre haute compacte + lien "Effacer les filtres" (Sidebar V1.1+) | ✓ |
| UI-3.3 | URL params | **Verbeux** `?search=...` (au lieu de `?q=...`) | ✗ user override |
| UI-3.4 | Row actions visibility | **Always-visible** + refactor cross-cutting `data-table.ejs` + `app.css` | ✗ user override + scope ajout |
| UI-4.1 | Ordre champs upload | `fichier → titre → date → type → bien → locataire → montant → notes` | ✓ |
| UI-4.2 | Invariant ≥1 bien/locataire | Radio mutex + dropdowns conditionnels (CSS-only `:has()`) | ✓ |
| UI-4.3 | Layout fiche justificatif | Méta haut + preview pleine largeur dessous (1 col) | ✓ |
| UI-4.4 | Actions fiche | Boutons inline visibles | ✓ |
| UI-5.1 | Rétention corbeille | Bouton 'Purger' désactivé + colonne 'Date purge possible' | ✓ |
| UI-5.2 | Colonnes table tickets | `titre | statut | dates | coûts | actions` (titre-first) | ✓ |
| UI-5.3 | Layout fiche ticket | Méta → PJ → Clôture inline (3 sections empilées) | ✓ |
| UI-5.4 | Sections fiches augmentées | Bien : Documents + Travaux (5 derniers preview + liens + CTA) ; Locataire : Documents filtrée par type | ✓ |
| UI-6.1 | Verbatim CTAs | Verbatim proposés | ✓ |
| UI-6.2 | Verbatim erreurs | Factuel non paternaliste | ✓ |
| UI-6.3 | A11y patterns | `rel=noopener` + `.sr-only` + `aria-live` + `aria-label` badges | ✓ |

**3 décisions hors recommandation initiale Claude :**
- UI-3.3 — User préfère `search` verbeux à `q` conventionnel (vision sobre / explicite).
- UI-3.4 — User préfère always-visible + extension du refactor aux pages existantes (A11y compliance > esthétique).
- UI-1.3 — Recommandation Claude finale alignée user après reformulation : tokens CSS + refactor inclus.

**22 gray areas UI arbitrées en 6 batches.** Discussion conduite avec checkpoint plan mode entre chaque batch.

---

*UI Discussion conduite par Claude (Opus 4.7) avec Valentin Dumas le 2026-05-18.*
*Backup UI-SPEC v1 auto : `04-UI-SPEC.v1-auto.bak.md`.*
*Plan d'exécution : `~/.claude/plans/restart-to-plan-ui-adaptive-honey.md`.*






