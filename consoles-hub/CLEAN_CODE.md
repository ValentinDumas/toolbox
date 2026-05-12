# Clean Code — Pratiques

Inspiré de Martin, *Clean Code* (2008) et *The Clean Coder* (2011).
S'applique à **tout code** de ce dépôt — Python, JS embarqué, templates Jinja, SQL.

---

## 1. Noms qui révèlent l'intention

Un nom doit répondre à : **quoi**, **pourquoi**, **comment l'utiliser**. Si le commentaire devient nécessaire pour comprendre, renomme.

```python
# ❌ Demande un commentaire pour comprendre
d = 86400  # secondes par jour

# ✅ Le nom est le commentaire
SECONDS_PER_DAY = 86400
```

- **Booléens** : `is_`, `has_`, `should_` (`is_validated`, `has_corrections`)
- **Listes** : pluriel sans suffixe (`factures`, pas `facture_list`)
- **Fonctions** : verbe en première position (`parse_amount`, `recompute_confidence`)
- **Modules** : nom du domaine, pas du pattern (`revision.py`, pas `revision_service.py`)

---

## 2. Une fonction = une chose

Une fonction fait **une seule chose**, à **un seul niveau d'abstraction**. Si tu peux extraire une sous-fonction nommée, fais-le.

```python
# ❌ 4 niveaux d'abstraction mélangés
def save_review(form, item_id):
    fields = {}
    for f in ("date", "montant"): fields[f] = form.get(f)
    if not fields["date"]: return {"error": "date"}
    conn = sqlite3.connect("data/invoices.db")
    conn.execute("UPDATE invoices SET date=? WHERE id=?", ...)
    log = json.loads(...)
    log.append(...)

# ✅ Chaque ligne est un verbe à un seul niveau
def save_review(form, item_id, conn):
    fields, errors = _parse_review_fields(form)
    if errors: return errors
    errors = _validate_review_fields(fields, current, conn, item_id)
    if errors: return errors
    confidence, warning = _recompute_confidence(fields, current)
    fields = _build_corrections_log(fields, current, now, warning)
    _persist_invoice(conn, item_id, fields)
```

**Limites pratiques :** 20 lignes pour une fonction, 4 paramètres max. Au-delà, c'est probablement deux fonctions.

---

## 3. Structures de retour cohérentes

Toujours le même type de retour pour la même fonction. Pas de `None` qui signifie tantôt "vide", tantôt "erreur".

```python
# ❌ Le None est ambigu
def find_invoice(id): return conn.execute(...).fetchone()  # None = pas trouvé ? Pas chargé ?

# ✅ Sépare absence et erreur
def find_invoice(id) -> dict | None: ...        # None = non trouvé, explicite
def parse_amount(text) -> tuple[float, str]: ... # (valeur, message_erreur)
```

---

## 4. Commentaires : pourquoi, pas quoi

Le code dit **ce qu'il fait**. Le commentaire explique **pourquoi**, ou décrit une contrainte invisible.

```python
# ❌ Paraphrase le code
# Incrémente le compteur
count += 1

# ❌ Décrit un comportement évident
# Insère dans la DB
conn.execute("INSERT INTO ...")

# ✅ Justifie une décision non évidente
# Soft-delete uniquement : le Code de commerce français impose 10 ans
# de conservation des factures (article L123-22).
conn.execute("UPDATE invoices SET deleted_at=? WHERE id=?", ...)

# ✅ Décrit une contrainte externe
# Tesseract retourne du texte brut sans normalisation — il faut
# strip les caractères de contrôle avant insertion DB.
```

---

## 5. Gestion d'erreurs : retour explicite > exception cachée

Les exceptions sont pour les **vraies anomalies** (DB corrompue, OOM). Les erreurs métier sont des **valeurs de retour**.

```python
# ❌ Exception pour un cas métier prévisible
def validate_siren(s):
    if len(s) != 9: raise ValueError("SIREN invalide")

# ✅ Retour explicite
def validate_siren(s) -> str | None:
    """Retourne un message d'erreur ou None si valide."""
    if len(s) != 9: return "SIREN doit faire 9 chiffres"
    return None
```

**Règle :** si le code appelant doit catch l'exception 100% du temps, c'est qu'il fallait un retour.

---

## 6. Pas de code mort

Tout code non utilisé est supprimé. Pas commenté, pas "au cas où", pas en `if False:`.

- Les imports inutilisés : supprimés
- Les paramètres `# noqa` : justifiés par un commentaire, sinon supprimés
- Les helpers privés (`_foo`) sans appelant : supprimés
- Les commentaires `# TODO` sans ticket : transformés en issue GitHub ou supprimés

Git garde l'historique. Pas besoin de garder le passé dans le présent.

---

## 7. DRY appliqué avec discernement

Trois lignes similaires ≠ obligation d'abstraire. La fausse réutilisation crée plus de dette que la duplication.

```python
# ❌ Abstraction prématurée pour 2 cas
def execute_with_year_filter(conn, sql, year, *args, expected_type):
    if expected_type == "scalar": return conn.execute(sql, (year, *args)).fetchone()[0]
    elif expected_type == "rows": return conn.execute(sql, (year, *args)).fetchall()

# ✅ Deux fonctions directes
def total_charges_for_year(conn, year): return conn.execute(...).fetchone()[0]
def ledger_rows_for_year(conn, year): return conn.execute(...).fetchall()
```

**Règle de 3 :** abstrais à la **troisième** duplication, pas avant.

---

## 8. Single Responsibility Principle (SRP)

Une classe / un module a **une seule raison de changer**.

| Module | Raison de changer |
|---|---|
| `queries.py` | Le schéma SQL change |
| `services/revision.py` | Les règles de validation métier changent |
| `blueprints/factures.py` | L'API REST des factures change |
| `context_helpers.py` | La gestion de session Flask change |

Si un module change pour deux raisons indépendantes (ex. : DB + UI), c'est qu'il faut le scinder.

---

## 9. Booléens nommés, pas en argument positionnel

```python
# ❌ Que veut dire True ?
export_ledger(2025, True, False)

# ✅ Argument nommé
export_ledger(year=2025, include_corbeille=True, force_overwrite=False)
```

Mieux : pour deux booléens contradictoires, préfère un enum.

---

## 10. Tests : Arrange / Act / Assert visible

```python
# ✅ Les trois sections sautent aux yeux
def test_recompute_confidence_low_warns_when_validated():
    # Arrange
    fields = {"date_document": "2025-03-01"}
    current = {"statut_révision": STATUT_VALIDE, "montant_ttc": None}

    # Act
    confidence, warning = _recompute_confidence(fields, current)

    # Assert
    assert confidence < CONFIDENCE_THRESHOLD
    assert "À réviser" in warning
```

**Un test = un comportement = une assertion principale.** Si tu écris 5 `assert`, c'est souvent 5 tests.

---

## 11. Niveau d'indentation max : 3

Au-delà de 3 niveaux, extrais ou inverse la condition (early return).

```python
# ❌ 4 niveaux
def process(items):
    for item in items:
        if item.valid:
            if item.amount > 0:
                if item.type == "facture":
                    ...

# ✅ Early continue
def process(items):
    for item in items:
        if not item.valid: continue
        if item.amount <= 0: continue
        if item.type != "facture": continue
        ...
```

---

## 12. Code review = clean code

Avant de pousser, relis comme un reviewer extérieur :
- Est-ce que **chaque ligne** est traçable à la demande utilisateur ?
- Est-ce que je **comprendrais** ce code dans 6 mois sans contexte ?
- Est-ce que les **noms** disent tout ce qu'il faut savoir ?
- Est-ce qu'un **test** échouerait clairement si je cassais ça ?
