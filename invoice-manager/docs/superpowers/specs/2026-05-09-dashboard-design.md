# Dashboard local — Spec design
**Date :** 2026-05-09
**Scope :** Phase 1C — Dashboard web local (actions basiques)
**Design system :** `docs/design-system.md` (ProLedger)

---

## Contexte

`invoice-manager` est un pipeline offline-first de gestion de factures. Le dashboard expose les données SQLite dans un navigateur local sans remplacer le terminal — il le complète.

Phase suivante non couverte ici : Phase 1D (watcher automatique) et Phase 1E (actions complètes — révision inline dans le dashboard).

---

## Architecture

### Nouveaux fichiers

```
invoice-manager/
  dashboard.py              ← serveur Flask, point d'entrée unique
  templates/
    dashboard.html          ← Jinja2, tout-en-un (HTML + CSS inline)
  tests/
    test_dashboard.py       ← client de test Flask
```

### Routes

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/` | Rendu dashboard (lecture SQLite + config) |
| GET | `/?year=YYYY` | Même vue filtrée sur l'année |
| POST | `/run` | Déclenche `run.py` en subprocess, redirige vers `/` |
| POST | `/open-review` | Ouvre `review.csv` via `open` (macOS) / `xdg-open` (Linux) |

### Démarrage

```bash
python dashboard.py                              # config.toml dans le dossier courant
python dashboard.py --config ~/compta/config.toml
python dashboard.py --port 7800                  # port par défaut : 7800
```

### Dépendances

- `flask` — seule dépendance nouvelle
- SQLite lu directement depuis `dashboard.py` (pas de couche ORM)
- Inter via Google Fonts (self-hosted dans `templates/` pour usage offline)

---

## UI — 3 blocs (de haut en bas)

Design system appliqué strictement depuis `docs/design-system.md`.

### Bloc 1 — Synthèse fiscale

Grid de KPI cards. Une card par indicateur :

| Card | Calcul |
|---|---|
| CA HT | Somme montant HT des factures émises (type = `émise`) |
| TVA collectée | Somme TVA des factures émises |
| TVA déductible | Somme TVA des factures reçues (type = `reçue`) |
| TVA à reverser | TVA collectée − TVA déductible |
| Total charges | Somme HT des factures reçues |

**Règles visuelles :**
- Card : fond blanc, 1px border `#E2E8F0`, radius 6px, pas de shadow
- Valeur : Inter 700 28px, `font-variant-numeric: tabular-nums lining-nums`
- Label : Inter 500 12px uppercase, `#64748B`
- Montants positifs : `#059669` ; négatifs : parenthèses `(500,00 €)` en `#DC2626`
- Zéro affiché `0,00 €`, jamais vide
- Format français : espace comme séparateur de milliers, virgule décimale, symbole `€` suffixé

Filtre année (dropdown `<select>`) en haut à droite, alimente `?year=YYYY`. Défaut : année fiscale courante.

### Bloc 2 — Ledger

Table paginée, 50 lignes/page.

**Colonnes :**

| Colonne | Alignement | Notes |
|---|---|---|
| Date | gauche | Format `DD/MM/YYYY` |
| Fournisseur / Client | gauche | |
| Débit HT | droite | Factures reçues uniquement, `#DC2626` si > 0 |
| Crédit HT | droite | Factures émises uniquement, `#059669` si > 0 |
| TVA | droite | tabular-nums |
| Statut révision | centre | Badge (voir ci-dessous) |
| Type | centre | `émise` / `reçue` |

Débit et crédit sont deux colonnes distinctes — jamais une seule colonne avec inversion de signe.

**Règles table :**
- Zebra striping : `#F8FAFC` / `#F1F5F9`
- Header sticky au scroll, Inter 500 13px uppercase, `#475569`
- Row hover : `#F1F5F9`, pas de changement de border
- Grand total visible en pied de table même paginé
- Navigation clavier : Tab, Enter, Escape

**Status badges :**

| Statut SQLite | Variante badge | BG | Texte |
|---|---|---|---|
| `validé` | Paid | `#DCFCE7` | `#166534` |
| `à_réviser` | Pending | `#FEF3C7` | `#92400E` |
| `erreur` | Overdue | `#FEE2E2` | `#991B1B` |
| `brouillon` | Draft | `#F1F5F9` | `#475569` |

### Bloc 3 — Vue de santé

3 indicateurs avec compteur + label texte (couleur jamais seule cue) :

| Indicateur | Source | Vert | Orange | Rouge |
|---|---|---|---|---|
| Fichiers en attente | `input/` — count fichiers | 0 | — | > 0 |
| Items à réviser | SQLite `statut_révision = 'à_réviser'` | 0 | > 0 | — |
| Fichiers en erreur | `errors/` — count fichiers | 0 | — | > 0 |

### Actions (bas de page)

- **Bouton primary** — "Lancer le pipeline" : `POST /run`, spinner (vanilla JS) pendant l'exécution, redirect `/` à la fin. Un seul bouton primary par vue.
- **Bouton secondary** — "Ouvrir review.csv" : `POST /open-review`, visible uniquement si items à réviser > 0.

Pas d'animation sur les données financières (motion = état pending → confusion).

---

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| SQLite absente | Page d'erreur avec message + commande `python run.py` |
| SQLite corrompue | Idem |
| `config.toml` introuvable | Message explicite au démarrage, pas de crash silencieux |
| `POST /run` échoue | stderr capturé et affiché dans le bloc santé, pas de modal |

Pas de retry automatique. L'utilisateur relit et relance.

---

## Tests

Fichier : `tests/test_dashboard.py` — client de test Flask (`app.test_client()`).

| Test | Vérification |
|---|---|
| `GET /` avec DB vide | 200, pas de crash |
| `GET /` avec DB peuplée | Totaux corrects dans le HTML rendu |
| `GET /?year=2024` | Filtre appliqué, données cohérentes |
| `POST /run` | Subprocess `run.py` appelé |
| `POST /open-review` (0 items) | Redirect vers `/` sans appel subprocess (vérifié via mock) |

DB de test : SQLite en mémoire (`:memory:`), fixtures depuis `tests/conftest.py`.

---

## Accessibilité

- Sémantique HTML native : `<main>`, `<section>`, `<table>`, `aria-label`
- WCAG AA (4.5:1) sur tout le texte, WCAG AAA (7:1) sur les montants
- Pas de couleur comme seul indicateur (label texte toujours présent)
- Navigation clavier complète sur la table
- CSS Grid pour les KPI cards, table scrollable horizontalement sur mobile

---

## Roadmap post-Phase 1C

- **Phase 1D** — Watcher automatique : surveille `input/` en continu, déclenche le pipeline à l'arrivée d'un fichier (thread `watchdog` dans `dashboard.py`)
- **Phase 1E** — Actions complètes : révision inline dans le dashboard (corriger un item sans passer par `review.csv`)
