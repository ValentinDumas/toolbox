# Catégories TVA — spec

## Contexte

`invoices.catégorie` est aujourd'hui une chaîne libre, dérivée par `_guess_category()` (`parsers.py`) à partir d'un dictionnaire codé en dur. La déductibilité par catégorie est elle aussi figée (`_DEDUCTIBILITY`). Conséquences :

- L'utilisateur ne peut pas étendre la taxonomie sans toucher au code.
- Les éditions inline du dashboard peuvent introduire des variantes de casse (`Transport`, `transport`, `TRANSPORT`) qui fragmentent les agrégats des feuilles *Récapitulatif* et *Déclaration*.
- Aucun fallback n'existe quand l'extraction OCR ne parvient pas à dériver `taux_tva` depuis le texte.

## Changement

### 1. Nouvelle table `category_tva_rates`

```sql
CREATE TABLE IF NOT EXISTS category_tva_rates (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    catégorie TEXT UNIQUE NOT NULL,
    taux_tva  REAL NOT NULL
);
```

- `catégorie` toujours stockée en minuscules.
- `taux_tva` exprimé en **fraction** (0..1, 4 décimales — convention v6).
- Seedée au premier passage avec les 13 catégories canoniques (`_DEFAULT_CATEGORY_TVA_RATES` dans `db.py`) au taux standard français de 20 % (10 % pour transport et repas, 0 % pour assurance).
- Le seed utilise `INSERT OR IGNORE` : les modifications utilisateur ne sont jamais écrasées.

### 2. Onglet "Catégories TVA" dans les paramètres

`/parametres?section=categories` — sur le modèle exact de l'onglet *Enseignes connues* :

- Liste des couples (catégorie, taux_tva) triés alphabétiquement.
- Formulaire d'ajout / mise à jour (UPSERT sur la clé unique).
- Suppression unitaire via la même modale de confirmation que les enseignes (wording dynamique).

Validation côté serveur (`_valider_taux_categorie`) :

- Catégorie : minuscules, lettres et tirets, max 64 caractères. Le formulaire HTML normalise à la saisie (`text-transform: lowercase`).
- Taux : float dans `[0.0, 1.0]`, virgule décimale tolérée à l'entrée.

### 3. Fallback à l'extraction

Dans `parse_invoice()` (`extract.py`) : si `_parse_amounts()` retourne `taux_tva=None` et que la catégorie devinée est présente dans `category_tva_rates`, le taux mappé est persisté sur la facture. Une valeur extraite n'est **jamais** écrasée — seul un `None` est remplacé.

Le dict est chargé une fois par run de pipeline dans `extract.py` et passé à `parse_invoice` en argument (même plumbing que `known_emitters`).

### 4. Invariant `catégorie` en minuscules

Normalisation au bord à tous les points d'écriture :

- `extract.py`         → `_guess_category(text).lower()`
- `services/revision.py` → `_parse_review_fields` applique `.lower()` sur le champ `catégorie`.
- `review.py`          → CSV import applique `.strip().lower()` avant UPDATE.
- `blueprints/parametres.py` → `_valider_taux_categorie` normalise avant validation.

Migration v7 idempotente, en complément :

```sql
UPDATE invoices SET catégorie = LOWER(catégorie)
WHERE catégorie IS NOT NULL AND catégorie != LOWER(catégorie);
```

`sous_catégorie` est **hors scope** : champ toujours `None` aujourd'hui, non surfacé dans l'UI ni dans les exports.

### 5. Sélecteur de catégorie sur les cartes du dashboard

Le champ `catégorie` des cartes de révision (`templates/dashboard.html`) est un `<select>` strict alimenté par `category_tva_rates`, sur le modèle du `<select name="type_document">` déjà en place.

- Première option `(aucune)` (valeur `""`) — permet d'effacer la catégorie d'une facture (colonne mise à `NULL`).
- Options suivantes triées alphabétiquement (`sorted(get_category_tva_rates(conn).keys())` dans `app.py:index`).
- Si la valeur courante de `row.catégorie` n'est pas dans le référentiel (donnée historique avant cette spec, ou catégorie supprimée des paramètres après coup), une option supplémentaire `« <valeur> (non enregistrée) »` est ajoutée en queue et pré-sélectionnée. La valeur est préservée tant que l'utilisateur ne la remplace pas.
- Le serveur (`services/revision.py:_validate_review_fields`) rejette toute soumission dont la catégorie n'appartient pas au référentiel : `errors["catégorie"]` côté JSON et **aucune** mutation DB.
- `_parse_review_fields` distingue désormais « champ absent du form » (= pas de mise à jour) de « chaîne vide » (= effacement explicite → `NULL`). C'est le seul champ texte effaçable depuis l'UI : `émetteur_nom`, `numéro_facture`, etc. conservent la convention « vide = ne pas toucher ».

## Hors scope

- Édition inline du taux dans la liste — l'UPSERT via le formulaire d'ajout suffit.
- Suppression en masse / réinitialisation aux valeurs par défaut.
- Application au moment de l'export (calculs déductibilité) — `_DEDUCTIBILITY` reste inchangé.

## Vérification

```bash
python3 -m pytest tests/test_db.py tests/test_parametres_validation.py -v
sqlite3 data/invoices.db "SELECT catégorie, taux_tva FROM category_tva_rates;"
sqlite3 data/invoices.db "SELECT DISTINCT catégorie FROM invoices;"  # → toutes minuscules
```

Smoke test UI : `python3 dashboard.py` → `http://localhost:7800/parametres?section=categories`.
