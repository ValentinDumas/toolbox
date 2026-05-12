# Domain-Driven Design — Pratiques

Inspiré de Evans, *Domain-Driven Design* (2003) et Vernon, *Implementing DDD* (2013).
S'applique à **tout code** de ce dépôt — Python comme templates Jinja.

---

## 1. Langage ubiquitaire (Ubiquitous Language)

Le code doit parler la **même langue** que le métier. Ici, le métier est la comptabilité française.

- Termes domaine en français : `facture`, `émetteur`, `révision`, `exercice_fiscal`, `enseigne`, `corbeille`, `paramètre`
- Pas de duplication de vocabulaire : on ne mélange jamais `invoice` et `facture` dans le même module
- URLs HTTP, colonnes DB, fonctions et templates partagent le **même nom** pour le même concept

```python
# ❌ Mélange anglais/français qui crée deux vocabulaires
def save_invoice(invoice_id, fields):
    conn.execute("UPDATE invoices SET statut_révision=? WHERE id=?", ...)

# ✅ Cohérence : route française → fonction française → colonne française
@bp_factures.route("/factures/<item_id>", methods=["PATCH"])
def facture_save(item_id):
    conn.execute("UPDATE invoices SET statut_révision=? WHERE id=?", ...)
```

**Règle d'or :** si tu hésites sur un nom, demande comment ton comptable l'appellerait.

---

## 2. Bounded contexts (contextes bornés)

Chaque blueprint = un contexte borné. Un contexte possède son agrégat, ses règles, son vocabulaire.

| Contexte borné | Blueprint | Agrégat principal | Vocabulaire |
|---|---|---|---|
| Facturation | `blueprints/factures.py` | `Facture` | `montant_ht`, `émetteur`, `statut_révision` |
| Identité | `blueprints/profils.py` | `Profil` | `siren`, `fiscal_profile`, `cadence` |
| Paramétrage | `blueprints/parametres.py` | `Paramètre` | `enseigne`, `ocr_backend`, `seuil_confiance` |
| Ingestion | `blueprints/pipeline.py` | `DocumentEntrant` | `fichier_source`, `extraction`, `dépôt` |

**Règle :** un blueprint **n'importe jamais** un autre blueprint. La communication passe par les modules partagés (`db.py`, `queries.py`, `context_helpers.py`).

```python
# ❌ Couplage entre contextes — rend les changements impossibles à localiser
from blueprints.factures import facture_save  # NON

# ✅ Communication via le domaine partagé
from queries import query_fiscal_summary
from context_helpers import active_db
```

---

## 3. Agrégat = unité de cohérence transactionnelle

L'agrégat `Facture` regroupe tous les champs (`montant_ht`, `tva`, `émetteur_nom`, `statut_révision`, `corrections_log`…) modifiés ensemble dans une transaction.

- **Une seule racine d'agrégat par opération** — modifie `Facture`, pas `corrections_log` directement
- Les invariants métier vivent dans le service, pas dans la route ni dans la DB
- Toute mutation passe par le service domaine

```python
# ❌ Logique métier dans la route — duplication garantie
@bp.route("/factures/<id>", methods=["PATCH"])
def facture_save(id):
    fields = request.form.to_dict()
    if not fields.get("date_document"):
        return jsonify({"error": "date requise"}), 400
    fields["statut_révision"] = "validé"
    conn.execute("UPDATE invoices SET ... WHERE id=?", ...)

# ✅ Route fine, service épais
@bp.route("/factures/<id>", methods=["PATCH"])
def facture_save(id):
    fields, errors = _parse_review_fields(request.form)
    if errors: return jsonify({"ok": False, "errors": errors})
    errors = _validate_review_fields(fields, current, conn, id)
    if errors: return jsonify({"ok": False, "errors": errors})
    fields = _build_corrections_log(fields, current, now, warning)
    _persist_invoice(conn, id, fields)
```

---

## 4. Services de domaine (services/)

Un service de domaine porte une **logique métier qui n'appartient à aucune entité unique**. Ici :

- `services/revision.py` : workflow de révision (parse → valide → recalcule confiance → loggue → persiste)

Les services sont **purs** : ils prennent des données et des connexions DB, et retournent des données. Pas de Flask, pas de session, pas de redirect.

```python
# ❌ Service couplé à Flask
def _validate_review_fields(form: "Request.form"):
    if not form.get("date_document"): flash("date requise")

# ✅ Service indépendant
def _validate_review_fields(fields: dict, current: dict, conn, item_id) -> dict:
    """Retourne un dict d'erreurs ({} si valide)."""
```

---

## 5. Repository pattern (queries.py)

Les lectures du domaine sont regroupées dans `queries.py`. Chaque fonction prend une connexion SQLite et retourne des structures domaine (dict, list).

- **Lecture seule** dans `queries.py` (jamais d'`UPDATE`/`INSERT`/`DELETE`)
- Les écritures passent par les services (`services/revision.py`) ou par la route (CRUD simple)
- Les fonctions ont des noms métier : `query_fiscal_summary`, pas `get_invoices_for_year_filtered`

---

## 6. Anti-corruption layer (ACL)

Quand on consomme des données externes (formulaire HTTP, fichier CSV, OCR), on **traduit** dans le langage du domaine **dès l'entrée**.

```python
# Couche d'anti-corruption : la forme HTTP → modèle domaine
def _parse_review_fields(form) -> tuple[dict, dict]:
    """Convertit un payload HTTP (strings) en champs domaine (floats, ISO dates, statuts).
    Retourne (champs_domaine, erreurs_de_conversion)."""
```

Le reste du code ne voit jamais que des données domaine propres.

---

## 7. Invariants explicites dans les constantes

Les seuils, statuts, types de documents sont **nommés dans `constants.py`**, jamais en dur dans le code.

```python
# ❌ Magie
if confidence < 0.8: ...
if statut == "à_réviser": ...

# ✅ Langage métier explicite
from constants import CONFIDENCE_THRESHOLD, STATUT_A_REVISER
if confidence < CONFIDENCE_THRESHOLD: ...
if statut == STATUT_A_REVISER: ...
```

---

## 8. Tests = spécification exécutable du domaine

Les noms de tests décrivent **une règle métier** :

```python
# ❌ Test technique
def test_update_returns_200(): ...

# ✅ Test domaine
def test_post_review_save_validated_low_confidence_demotes(): ...
def test_recompute_confidence_no_warning_when_a_reviser(): ...
def test_fiscal_summary_charges_excludes_a_reviser(): ...
```

Un test = une assertion comptable. Le titre se lit comme une phrase du métier.

---

## 9. REST aligné sur le domaine

Les URLs reflètent les agrégats et leurs transitions d'état :

```
PATCH  /factures/<id>                   ← mise à jour partielle
DELETE /factures/<id>                   ← soft-delete
POST   /factures/<id>/valider           ← transition d'état métier
POST   /factures/<id>/restaurer         ← transition d'état métier
POST   /factures/reinitialiser-revisions ← opération en masse, scope = agrégat Facture
```

**Pas** : `/saveInvoice`, `/api/v1/invoiceController`, `/doValidation`.
