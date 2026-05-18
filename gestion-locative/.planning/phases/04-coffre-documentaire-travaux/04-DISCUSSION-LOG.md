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
