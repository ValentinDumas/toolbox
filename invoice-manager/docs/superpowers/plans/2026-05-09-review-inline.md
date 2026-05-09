# Révision inline dashboard — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre la révision des items `à_réviser` directement dans le dashboard Flask sans passer par `review.csv`.

**Architecture:** Deux nouvelles routes POST (`/review/<id>/save`, `/review/<id>/delete`) dans `create_app`. Une nouvelle section HTML conditionnelle dans `dashboard.html`. La logique métier réutilise le même pattern que `import_review` dans `review.py`.

**Tech Stack:** Flask, SQLite3, Jinja2, HTML forms (POST standard, pas de JS asynchrone).

---

## File map

| Fichier | Action | Changement |
|---|---|---|
| `invoice-manager/dashboard.py` | Modifier | Ajouter `query_items_a_reviser`, routes `review_save`, `review_delete`, filtre `basename`, passer `items_a_reviser_list` + `review_error` dans `index()` |
| `invoice-manager/templates/dashboard.html` | Modifier | Ajouter section "À réviser" + CSS, lien ancre sur le compteur santé |
| `invoice-manager/tests/test_dashboard.py` | Modifier | Ajouter 8 tests |

---

## Task 1 — Données + routes (TDD)

**Files:**
- Modify: `invoice-manager/dashboard.py`
- Test: `invoice-manager/tests/test_dashboard.py`

- [ ] **Step 1.1 — Écrire les tests**

Ajouter à la fin de `invoice-manager/tests/test_dashboard.py` :

```python
# ── Review inline ─────────────────────────────────────────────────────────────

def test_query_items_a_reviser_empty(mem_db):
    from dashboard import query_items_a_reviser
    assert query_items_a_reviser(mem_db) == []


def test_query_items_a_reviser_populated(mem_db):
    from dashboard import query_items_a_reviser
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="ok1", statut_révision="auto_validé", exercice_fiscal=2025)
    items = query_items_a_reviser(mem_db)
    assert len(items) == 1
    assert items[0]["id"] == "rev1"


def test_post_review_save_validates_item(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/rev1/save", data={
            "type_document": "facture_reçue",
            "montant_ht": "100.0",
            "montant_tva": "20.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "OVH SAS",
            "numéro_facture": "FR001",
            "catégorie": "hébergement",
            "notes_correction": "",
        })
    assert resp.status_code == 302
    row = mem_db.execute("SELECT statut_révision FROM invoices WHERE id='rev1'").fetchone()
    assert row["statut_révision"] == "révisé"


def test_post_review_save_updates_fields(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev2", statut_révision="à_réviser",
                    émetteur_nom="Ancien Nom", montant_ht=50.0, exercice_fiscal=2025)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        client.post("/review/rev2/save", data={
            "type_document": "facture_reçue",
            "montant_ht": "99.0",
            "montant_tva": "19.8",
            "date_document": "2025-04-01",
            "émetteur_nom": "Nouveau Nom",
            "numéro_facture": "",
            "catégorie": "",
            "notes_correction": "corrigé manuellement",
        })
    row = mem_db.execute("SELECT émetteur_nom, montant_ht, notes_correction FROM invoices WHERE id='rev2'").fetchone()
    assert row["émetteur_nom"] == "Nouveau Nom"
    assert abs(row["montant_ht"] - 99.0) < 0.01
    assert row["notes_correction"] == "corrigé manuellement"


def test_post_review_save_unknown_id(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/nonexistent/save", data={
            "type_document": "facture_reçue", "montant_ht": "10",
            "montant_tva": "2", "date_document": "", "émetteur_nom": "",
            "numéro_facture": "", "catégorie": "", "notes_correction": "",
        })
    assert resp.status_code == 302


def test_post_review_delete(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="del1", statut_révision="à_réviser", exercice_fiscal=2025)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/del1/delete")
    assert resp.status_code == 302
    row = mem_db.execute("SELECT id FROM invoices WHERE id='del1'").fetchone()
    assert row is None


def test_get_root_shows_review_section(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev3", statut_révision="à_réviser", exercice_fiscal=2025)
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="reviser"' in resp.data


def test_get_root_no_review_section(mem_db, tmp_path, monkeypatch):
    app = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="reviser"' not in resp.data
```

- [ ] **Step 1.2 — Vérifier que les tests échouent**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py::test_query_items_a_reviser_empty -v 2>&1 | tail -5
```
Attendu : `ImportError: cannot import name 'query_items_a_reviser' from 'dashboard'`

- [ ] **Step 1.3 — Ajouter `query_items_a_reviser` dans `dashboard.py`**

Ajouter après `query_health` (avant `_fr_currency`) :

```python
def query_items_a_reviser(conn: sqlite3.Connection) -> list:
    """Retourne les items en attente de révision avec les champs essentiels."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source "
        "FROM invoices WHERE statut_révision='à_réviser' ORDER BY date_document"
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 1.4 — Ajouter les routes dans `create_app`**

Ajouter après la route `/open-review` (avant `return app`) :

```python
    @app.route("/review/<item_id>/save", methods=["POST"])
    def review_save(item_id):
        from datetime import timezone
        now = datetime.now(timezone.utc).isoformat()
        try:
            conn = open_db(db_path)
            if not conn.execute("SELECT id FROM invoices WHERE id=?", (item_id,)).fetchone():
                conn.close()
                return redirect("/")

            fields = {}
            for field in ("type_document", "émetteur_nom", "numéro_facture",
                          "catégorie", "date_document", "notes_correction"):
                val = request.form.get(field, "").strip()
                if val:
                    fields[field] = val

            for field in ("montant_ht", "montant_tva"):
                val = request.form.get(field, "").strip()
                if val:
                    try:
                        fields[field] = float(val.replace(",", "."))
                    except ValueError:
                        conn.close()
                        return redirect(f"/?review_error={quote('Montant invalide : ' + val)}")

            fields["statut_révision"] = "révisé"
            fields["révisé_par"] = "user"
            fields["date_révision"] = now

            set_clause = ", ".join(f'"{k}" = ?' for k in fields)
            conn.execute(
                f"UPDATE invoices SET {set_clause} WHERE id = ?",
                list(fields.values()) + [item_id],
            )
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")

    @app.route("/review/<item_id>/delete", methods=["POST"])
    def review_delete(item_id):
        try:
            conn = open_db(db_path)
            conn.execute("DELETE FROM invoices WHERE id = ?", (item_id,))
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError:
            pass
        return redirect("/")
```

- [ ] **Step 1.5 — Mettre à jour `index()` pour passer les données review**

Remplacer dans `index()` :

```python
        try:
            conn = open_db(db_path)
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, cfg)
            years = [r[0] for r in conn.execute(
                "SELECT DISTINCT exercice_fiscal FROM invoices ORDER BY exercice_fiscal DESC"
            ).fetchall()] or [datetime.now().year]
            conn.close()
        except sqlite3.DatabaseError as exc:
            return render_template_string(_ERROR_TMPL, message=str(exc), hint="python run.py"), 500

        return render_template(
            "dashboard.html",
            year=year,
            years=years,
            summary=summary,
            ledger=ledger,
            health=health,
            run_error=run_error,
            expense_types=EXPENSE_TYPES,
        )
```

Par :

```python
        run_error = request.args.get("run_error")
        review_error = request.args.get("review_error")
        try:
            conn = open_db(db_path)
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, cfg)
            items_a_reviser_list = query_items_a_reviser(conn)
            years = [r[0] for r in conn.execute(
                "SELECT DISTINCT exercice_fiscal FROM invoices ORDER BY exercice_fiscal DESC"
            ).fetchall()] or [datetime.now().year]
            conn.close()
        except sqlite3.DatabaseError as exc:
            return render_template_string(_ERROR_TMPL, message=str(exc), hint="python run.py"), 500

        return render_template(
            "dashboard.html",
            year=year,
            years=years,
            summary=summary,
            ledger=ledger,
            health=health,
            items_a_reviser_list=items_a_reviser_list,
            run_error=run_error,
            review_error=review_error,
            expense_types=EXPENSE_TYPES,
            doc_types=("facture_émise", "facture_reçue", "reçu", "note_de_frais", "avoir", "devis"),
        )
```

Also, also add `basename` filter after `app.jinja_env.filters["fr_currency"] = _fr_currency`:

```python
    import os
    app.jinja_env.filters["basename"] = lambda p: os.path.basename(p) if p else ""
```

- [ ] **Step 1.6 — Lancer les tests**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py -v 2>&1 | tail -15
```
Attendu : `21 passed`

- [ ] **Step 1.7 — Commit**

```bash
git add invoice-manager/dashboard.py invoice-manager/tests/test_dashboard.py
git commit -m "feat(dashboard): add inline review routes and data query"
```

---

## Task 2 — Template : section révision

**Files:**
- Modify: `invoice-manager/templates/dashboard.html`

> Pas de test automatisé pour le rendu visuel — les tests `test_get_root_shows_review_section` et `test_get_root_no_review_section` suffisent.

- [ ] **Step 2.1 — Ajouter le CSS de la section révision**

Dans `dashboard.html`, ajouter dans le bloc `<style>`, juste avant `/* Responsive */` :

```css
    /* Review inline */
    .review-item {
      background: white;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 20px 24px;
      margin-bottom: 16px;
    }
    .review-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .review-party { font-weight: 500; font-size: 14px; }
    .review-date  { font-size: 13px; color: var(--on-surface-muted); }
    .review-source { font-size: 12px; color: var(--on-surface-muted); margin-left: auto; }
    .review-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .form-field--wide { grid-column: span 2; }
    .form-field--full { grid-column: 1 / -1; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field label {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--on-surface-muted);
    }
    .form-field input,
    .form-field select,
    .form-field textarea {
      font-family: inherit;
      font-size: 14px;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 7px 10px;
      background: white;
      color: var(--on-surface);
    }
    .form-field input:focus,
    .form-field select:focus,
    .form-field textarea:focus {
      outline: 2px solid var(--primary);
      outline-offset: 1px;
    }
    .form-field input[type="number"] { text-align: right; font-variant-numeric: tabular-nums; }
    .form-field textarea { resize: vertical; }
    .review-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .review-item-footer {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .btn-destructive {
      background: var(--error);
      color: white;
      border: none;
      border-radius: var(--radius);
      padding: 8px 16px;
      font-family: inherit;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .btn-destructive:hover { background: #991B1B; }
    .btn-destructive:focus { outline: 2px solid var(--error); outline-offset: 2px; }
    .btn-link {
      background: none;
      border: none;
      color: var(--primary);
      font-family: inherit;
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }
    .btn-link:focus { outline: 2px solid var(--primary); outline-offset: 2px; }
    .review-error-banner {
      background: #FEE2E2;
      border: 1px solid #FECACA;
      border-radius: var(--radius);
      padding: 10px 14px;
      font-size: 13px;
      color: var(--error);
      margin-bottom: 16px;
    }
```

- [ ] **Step 2.2 — Mettre à jour le compteur santé "items à réviser" en lien ancre**

Dans le bloc santé, remplacer :

```html
          <div class="health-card">
            <div class="health-dot {{ 'dot-warning' if health.items_a_reviser > 0 else 'dot-ok' }}"
                 aria-hidden="true"></div>
            <div class="health-info">
              <div class="health-count">{{ health.items_a_reviser }}</div>
              <div class="health-label">Item{{ 's' if health.items_a_reviser != 1 }} à réviser</div>
              {% if health.items_a_reviser > 0 %}
              <div class="health-sublabel">Action requise</div>
              {% endif %}
            </div>
          </div>
```

Par :

```html
          <div class="health-card">
            <div class="health-dot {{ 'dot-warning' if health.items_a_reviser > 0 else 'dot-ok' }}"
                 aria-hidden="true"></div>
            <div class="health-info">
              <div class="health-count">{{ health.items_a_reviser }}</div>
              <div class="health-label">Item{{ 's' if health.items_a_reviser != 1 }} à réviser</div>
              {% if health.items_a_reviser > 0 %}
              <div class="health-sublabel"><a href="#reviser" style="color:var(--warning)">Réviser maintenant</a></div>
              {% endif %}
            </div>
          </div>
```

- [ ] **Step 2.3 — Ajouter la section révision dans `<main>`**

Ajouter **entre le bloc santé et la balise `</main>`** :

```html
      {# ── Bloc 4 : Révision inline ─────────────────────────────────────── #}
      {% if items_a_reviser_list %}
      <section id="reviser" aria-label="Items à réviser">
        <p class="section-label">À réviser — {{ items_a_reviser_list|length }} item{{ 's' if items_a_reviser_list|length != 1 }}</p>

        {% if review_error %}
        <div class="review-error-banner" role="alert">{{ review_error }}</div>
        {% endif %}

        {% for item in items_a_reviser_list %}
        <div class="review-item">
          <div class="review-item-header">
            <span class="review-party">{{ item.émetteur_nom or '—' }}</span>
            <span class="review-date">{{ item.date_document or '—' }}</span>
            {% if item.confiance is not none %}
              {% if item.confiance < 0.8 %}
                <span class="badge badge-pending">{{ "%.0f%%"|format(item.confiance * 100) }} confiance</span>
              {% else %}
                <span class="badge badge-paid">{{ "%.0f%%"|format(item.confiance * 100) }} confiance</span>
              {% endif %}
            {% endif %}
            {% if item.fichier_source %}
            <span class="review-source">{{ item.fichier_source | basename }}</span>
            {% endif %}
          </div>

          <form method="post" action="/review/{{ item.id }}/save" class="review-form">
            <div class="review-grid">
              <div class="form-field">
                <label for="type-{{ item.id }}">Type</label>
                <select id="type-{{ item.id }}" name="type_document">
                  {% for t in doc_types %}
                  <option value="{{ t }}"{% if t == item.type_document %} selected{% endif %}>{{ t }}</option>
                  {% endfor %}
                </select>
              </div>
              <div class="form-field">
                <label for="ht-{{ item.id }}">Montant HT</label>
                <input id="ht-{{ item.id }}" type="number" step="0.01" name="montant_ht"
                       value="{{ item.montant_ht or '' }}"
                       aria-label="Montant hors taxes">
              </div>
              <div class="form-field">
                <label for="tva-{{ item.id }}">TVA</label>
                <input id="tva-{{ item.id }}" type="number" step="0.01" name="montant_tva"
                       value="{{ item.montant_tva or '' }}"
                       aria-label="Montant TVA">
              </div>
              <div class="form-field">
                <label for="date-{{ item.id }}">Date</label>
                <input id="date-{{ item.id }}" type="date" name="date_document"
                       value="{{ item.date_document or '' }}">
              </div>
              <div class="form-field form-field--wide">
                <label for="emetteur-{{ item.id }}">Émetteur</label>
                <input id="emetteur-{{ item.id }}" type="text" name="émetteur_nom"
                       value="{{ item.émetteur_nom or '' }}">
              </div>
              <div class="form-field">
                <label for="num-{{ item.id }}">N° facture</label>
                <input id="num-{{ item.id }}" type="text" name="numéro_facture"
                       value="{{ item.numéro_facture or '' }}">
              </div>
              <div class="form-field">
                <label for="cat-{{ item.id }}">Catégorie</label>
                <input id="cat-{{ item.id }}" type="text" name="catégorie"
                       value="{{ item.catégorie or '' }}">
              </div>
              <div class="form-field form-field--full">
                <label for="notes-{{ item.id }}">Notes (optionnel)</label>
                <textarea id="notes-{{ item.id }}" name="notes_correction"
                          rows="2">{{ item.notes_correction or '' }}</textarea>
              </div>
            </div>
            <div class="review-actions">
              <button type="submit" class="btn-primary"
                      aria-label="Enregistrer les corrections pour {{ item.émetteur_nom or item.id }}">
                Enregistrer
              </button>
            </div>
          </form>

          <div class="review-item-footer">
            <form method="post" action="/review/{{ item.id }}/delete">
              <button type="submit" class="btn-destructive"
                      aria-label="Supprimer l'entrée {{ item.émetteur_nom or item.id }}">
                Supprimer
              </button>
            </form>
            <form method="post" action="/open-review">
              <button type="submit" class="btn-link" aria-label="Ouvrir review.csv pour édition complète">
                Éditer tout →
              </button>
            </form>
          </div>
        </div>
        {% endfor %}
      </section>
      {% endif %}
```

- [ ] **Step 2.4 — Lancer la suite de tests**

```bash
cd invoice-manager && python -m pytest tests/test_dashboard.py -v 2>&1 | tail -10
```
Attendu : `21 passed`

- [ ] **Step 2.5 — Commit**

```bash
git add invoice-manager/templates/dashboard.html
git commit -m "feat(dashboard): add inline review section with ProLedger styling"
```

---

## Task 3 — README + roadmap + commit final

**Files:**
- Modify: `invoice-manager/README.md`

- [ ] **Step 3.1 — Mettre à jour la roadmap**

Dans `invoice-manager/README.md`, remplacer :

```
- **Phase 1E** — Actions complètes : révision inline dans le dashboard (sans passer par `review.csv`)
```

Par :

```
- **Phase 1E** — ✅ Révision inline dans le dashboard (sans passer par `review.csv`)
- **Phase 1E+** — Édition complète inline (40+ champs via panneau slide-over)
```

- [ ] **Step 3.2 — Mettre à jour la section Dashboard du README**

Dans la liste des actions disponibles, remplacer :

```
Actions disponibles : lancer le pipeline, ouvrir `review.csv` (visible uniquement si des items sont à réviser).
```

Par :

```
Actions disponibles : lancer le pipeline, révision inline des items incertains (corriger/valider/supprimer sans quitter le navigateur), ouvrir `review.csv` pour les éditions complexes.
```

- [ ] **Step 3.3 — Lancer la suite complète**

```bash
cd invoice-manager && python -m pytest tests/ -v 2>&1 | tail -10
```
Attendu : `21 passed` (les échecs pré-existants de `test_review.py` ne sont pas de notre ressort).

- [ ] **Step 3.4 — Commit final**

```bash
git add invoice-manager/README.md invoice-manager/dashboard.py invoice-manager/templates/dashboard.html invoice-manager/tests/test_dashboard.py
git commit -m "feat(invoice-manager): Phase 1E inline review in dashboard

- Section 'À réviser' conditionnelle avec formulaire par item
- Routes POST /review/<id>/save et /review/<id>/delete
- 8 champs éditables (type, montants, date, émetteur, catégorie, notes)
- Lien ancre depuis le bloc santé vers la section révision
- 8 nouveaux tests
- README et roadmap mis à jour"
git push
```
