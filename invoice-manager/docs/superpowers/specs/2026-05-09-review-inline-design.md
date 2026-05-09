# Révision inline dashboard — Spec design
**Date :** 2026-05-09
**Scope :** Phase 1E — Actions complètes : révision inline dans le dashboard
**Design system :** `docs/design-system.md` (ProLedger)

---

## Contexte

Le workflow de révision actuel oblige à passer par `review.csv` (terminal + éditeur externe). Phase 1E expose la révision directement dans le dashboard Flask, sans quitter le navigateur.

Phase suivante non couverte ici : Phase 1E+ (édition de tous les 40+ champs, actuellement renvoyée vers le CSV via "Éditer tout →").

---

## Architecture

### Nouvelles routes

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/review/<id>/save` | Valide ou corrige un item (champs essentiels) |
| `POST` | `/review/<id>/delete` | Supprime un item de la base |

### Principe

- Un formulaire HTML par item, soumission POST standard, redirect vers `/` après action — pas de JS asynchrone
- La logique de mise à jour réutilise les colonnes et le pattern de `import_review` dans `review.py` (même `statut_révision = 'révisé'`, `révisé_par = 'user'`, `date_révision = now`)
- Pas de duplication de logique métier

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `dashboard.py` | Ajouter routes `save` et `delete` + fonction `query_items_a_reviser(conn) -> list[dict]` |
| `templates/dashboard.html` | Ajouter section "À réviser" conditionnelle |

---

## UI

### Placement

Nouveau bloc entre le bloc santé et les actions, visible **uniquement si `items_a_reviser > 0`**. Le compteur du bloc santé devient un lien ancre `#reviser` vers ce bloc.

### Structure par item

Chaque item est un formulaire indépendant. En-tête : émetteur + date + badge confiance (warning si < 80 %).

**Champs essentiels (8 champs éditables) :**

| Champ | Type input | Notes |
|---|---|---|
| `type_document` | `<select>` | Options : `facture_émise`, `facture_reçue`, `reçu`, `note_de_frais`, `avoir`, `devis` |
| `montant_ht` | `<input type="number" step="0.01">` | Aligné droite, tabular-nums |
| `montant_tva` | `<input type="number" step="0.01">` | Aligné droite, tabular-nums |
| `date_document` | `<input type="date">` | |
| `émetteur_nom` | `<input type="text">` | |
| `numéro_facture` | `<input type="text">` | |
| `catégorie` | `<input type="text">` | |
| `notes_correction` | `<textarea>` | Optionnel, 2 lignes |

**Actions par item :**
- **Enregistrer** — bouton primary `#1C4ED8` — soumet `POST /review/<id>/save`
- **Supprimer** — bouton destructive `#B91C1C` — soumet `POST /review/<id>/delete`, pas de confirmation dialog
- **Éditer tout →** — lien texte — soumet `POST /open-review` (ouvre `review.csv`)

### Règles ProLedger appliquées

- En-tête item : Inter 500 13px, `#64748B`
- Badge confiance : `badge-pending` si confiance < 80 %, `badge-paid` si ≥ 80 %
- Inputs : border 1px `#E2E8F0`, focus ring 2px `#1C4ED8`, radius 6px
- Inputs montants : `text-align: right`, `font-variant-numeric: tabular-nums`
- Labels : Inter 500 12px uppercase, `#64748B`
- Bouton destructive : fond `#B91C1C`, texte blanc — utilisé sans confirmation car l'item est déjà suspect
- Pas d'animation sur les données financières
- WCAG AA sur tout le texte, WCAG AAA sur les montants

---

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| `id` inexistant dans `/review/<id>/save` | Redirect `/` sans action |
| `id` inexistant dans `/review/<id>/delete` | Redirect `/` sans action |
| Montant invalide (non numérique) | Redirect `/?review_error=<message>`, affiché dans le bloc santé |
| DB inaccessible | Page d'erreur existante (handler global) |

---

## Tests

Fichier : `tests/test_dashboard.py` — ajouts à la suite existante.

| Test | Vérification |
|---|---|
| `POST /review/<id>/save` valide | `statut_révision = 'révisé'` en base, redirect 302 |
| `POST /review/<id>/save` avec champs modifiés | champs mis à jour en base |
| `POST /review/<id>/save` id inexistant | redirect 302, pas d'erreur |
| `POST /review/<id>/delete` | ligne supprimée, redirect 302 |
| `GET /` avec items à réviser | section `id="reviser"` présente dans le HTML |
| `GET /` sans items à réviser | section `id="reviser"` absente |

---

## Roadmap post-Phase 1E

- **Phase 1E+** — Édition complète inline (40+ champs de `REVIEW_COLS`) via panneau slide-over, sans passer par le CSV
