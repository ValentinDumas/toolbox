# Soft Delete & Corbeille Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard invoice deletion with soft delete (deleted_at/deleted_by columns), add a confirmation modal on delete, and add a Corbeille tab to view and restore deleted items.

**Architecture:** Schema migration runs in `open_db` (extract.py) on app start. All read queries in dashboard.py gain `AND deleted_at IS NULL`. The delete route sets `deleted_at` instead of running `DELETE`. A new `/review/<id>/restore` route clears `deleted_at` and resets to `à_réviser`. The Corbeille section in the HTML template is only rendered when deleted rows exist.

**Tech Stack:** Python/Flask, SQLite, Jinja2, vanilla JS (inline in template)

---

## File Map

| File | Change |
|---|---|
| `extract.py` | Add `deleted_at`, `deleted_by` columns to `CREATE TABLE` and add `ALTER TABLE` migration in `open_db` |
| `dashboard.py` | Update 5 queries + `WHERE deleted_at IS NULL`, change delete route to soft delete, add restore route + `query_corbeille` |
| `templates/dashboard.html` | Add modal CSS + HTML + JS, wire delete button to modal, add Corbeille section |
| `tests/test_dashboard.py` | Update `test_post_review_delete`, add 4 new tests |

---

## Task 1: Schema — add columns in extract.py

**Files:**
- Modify: `extract.py`

- [ ] **Step 1: Read open_db in extract.py to find CREATE TABLE**

The function is `open_db`. Locate the `CREATE TABLE invoices` statement and the end of the function.

- [ ] **Step 2: Add deleted_at and deleted_by to CREATE TABLE**

Find the `CREATE TABLE IF NOT EXISTS invoices` block. Add before the closing `)`:

```sql
    "deleted_at"      TEXT,
    "deleted_by"      TEXT
```

- [ ] **Step 3: Add migration after table creation**

After the `conn.execute(CREATE_TABLE...)` call (or wherever `open_db` runs DDL), add:

```python
for col, typedef in [("deleted_at", "TEXT"), ("deleted_by", "TEXT")]:
    try:
        conn.execute(f'ALTER TABLE invoices ADD COLUMN "{col}" {typedef}')
        conn.commit()
    except Exception:
        pass  # column already exists
```

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```bash
cd /Users/valentinshodo/Projects/toolbox/invoice-manager
python -m pytest tests/ -x -q 2>&1 | tail -20
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add extract.py
git commit -m "feat(schema): add deleted_at, deleted_by columns — soft delete foundation"
```

---

## Task 2: Update all read queries in dashboard.py

**Files:**
- Modify: `dashboard.py`

- [ ] **Step 1: Write failing tests for soft-deleted rows being excluded from queries**

Add to `tests/test_dashboard.py`:

```python
def test_soft_deleted_excluded_from_fiscal_summary(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="alive", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 1000.0  # dead row excluded


def test_soft_deleted_excluded_from_ledger(mem_db):
    from dashboard import query_ledger
    _insert_invoice(mem_db, id="alive", type_document="facture_reçue",
                    montant_ht=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", type_document="facture_reçue",
                    montant_ht=100.0, exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    result = query_ledger(mem_db, 2025)
    assert result["total_count"] == 1
    ids = [r["id"] for r in result["rows"]]
    assert "dead" not in ids


def test_soft_deleted_excluded_from_items_a_reviser(mem_db):
    from dashboard import query_items_a_reviser
    _insert_invoice(mem_db, id="alive", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    items = query_items_a_reviser(mem_db)
    ids = [i["id"] for i in items]
    assert "alive" in ids
    assert "dead" not in ids
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest tests/test_dashboard.py::test_soft_deleted_excluded_from_fiscal_summary tests/test_dashboard.py::test_soft_deleted_excluded_from_ledger tests/test_dashboard.py::test_soft_deleted_excluded_from_items_a_reviser -v 2>&1 | tail -20
```

Expected: FAIL (queries don't filter deleted_at yet).

- [ ] **Step 3: Update query_fiscal_summary — add AND deleted_at IS NULL**

In `dashboard.py`, `query_fiscal_summary`:

```python
def query_fiscal_summary(conn: sqlite3.Connection, year: int) -> dict:
    def scalar(sql, *args):
        return conn.execute(sql, args).fetchone()[0] or 0.0

    ca_ht = scalar(
        "SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND deleted_at IS NULL",
        year, "facture_émise",
    )
    tva_collectee = scalar(
        "SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND deleted_at IS NULL",
        year, "facture_émise",
    )
    ph = ",".join("?" * len(EXPENSE_TYPES))
    tva_deductible = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0
    total_charges = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0

    return {
        "ca_ht": ca_ht,
        "tva_collectee": tva_collectee,
        "tva_deductible": tva_deductible,
        "tva_a_reverser": round(tva_collectee - tva_deductible, 2),
        "total_charges": total_charges,
    }
```

- [ ] **Step 4: Update query_ledger — add AND deleted_at IS NULL**

```python
def query_ledger(conn: sqlite3.Connection, year: int, page: int = 1, per_page: int = 50) -> dict:
    offset = (page - 1) * per_page
    rows = conn.execute(
        "SELECT * FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL ORDER BY date_document DESC LIMIT ? OFFSET ?",
        (year, per_page, offset),
    ).fetchall()
    total_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL", (year,)
    ).fetchone()[0]

    ph_in = ",".join("?" * len(INCOME_TYPES))
    ph_ex = ",".join("?" * len(EXPENSE_TYPES))
    total_credit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_in}) AND deleted_at IS NULL",
        (year, *INCOME_TYPES),
    ).fetchone()[0] or 0.0
    total_debit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_ex}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES),
    ).fetchone()[0] or 0.0

    return {
        "rows": [dict(r) for r in rows],
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total_count + per_page - 1) // per_page),
        "total_credit": total_credit,
        "total_debit": total_debit,
    }
```

- [ ] **Step 5: Update query_health, query_items_a_reviser, _query_validés**

`query_health`:
```python
items_a_reviser = conn.execute(
    "SELECT COUNT(*) FROM invoices WHERE statut_révision='à_réviser' AND deleted_at IS NULL"
).fetchone()[0]
auto_validés = conn.execute(
    "SELECT COUNT(*) FROM invoices WHERE statut_révision='auto_validé' AND deleted_at IS NULL"
).fetchone()[0]
validés_count = conn.execute(
    "SELECT COUNT(*) FROM invoices WHERE statut_révision='validé' AND deleted_at IS NULL"
).fetchone()[0]
```

`query_items_a_reviser`:
```python
rows = conn.execute(
    "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
    "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
    "confiance, fichier_source, texte_brut, statut_révision "
    "FROM invoices WHERE statut_révision IN ('à_réviser', 'auto_validé') AND deleted_at IS NULL "
    "ORDER BY CASE statut_révision WHEN 'à_réviser' THEN 0 ELSE 1 END, date_document"
).fetchall()
```

`_query_validés`:
```python
rows = conn.execute(
    "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
    "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
    "confiance, fichier_source, texte_brut, statut_révision, corrections_log "
    "FROM invoices WHERE statut_révision='validé' AND deleted_at IS NULL ORDER BY date_document DESC"
).fetchall()
```

- [ ] **Step 6: Run the three new tests + full suite**

```bash
python -m pytest tests/ -x -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add dashboard.py tests/test_dashboard.py
git commit -m "feat(dashboard): exclude soft-deleted rows from all read queries"
```

---

## Task 3: Soft delete route + query_corbeille

**Files:**
- Modify: `dashboard.py`
- Modify: `tests/test_dashboard.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/test_dashboard.py`:

```python
def test_post_review_delete_is_soft(mem_db, tmp_path, monkeypatch):
    """Delete must set deleted_at, not remove the row."""
    _insert_invoice(mem_db, id="del1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/del1/delete")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT deleted_at, deleted_by FROM invoices WHERE id='del1'").fetchone()
    check.close()
    assert row is not None, "Row must still exist after soft delete"
    assert row["deleted_at"] is not None
    assert row["deleted_by"] == "user"


def test_query_corbeille_returns_deleted_rows(mem_db):
    from dashboard import query_corbeille
    _insert_invoice(mem_db, id="alive", statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    rows = query_corbeille(mem_db)
    ids = [r["id"] for r in rows]
    assert "dead" in ids
    assert "alive" not in ids


def test_post_review_restore(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="dead1", statut_révision="validé", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/dead1/restore")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT deleted_at, statut_révision FROM invoices WHERE id='dead1'"
    ).fetchone()
    check.close()
    assert row["deleted_at"] is None
    assert row["statut_révision"] == "à_réviser"
```

- [ ] **Step 2: Run to verify they fail**

```bash
python -m pytest tests/test_dashboard.py::test_post_review_delete_is_soft tests/test_dashboard.py::test_query_corbeille_returns_deleted_rows tests/test_dashboard.py::test_post_review_restore -v 2>&1 | tail -20
```

Expected: FAIL.

- [ ] **Step 3: Update the existing test_post_review_delete**

The existing test asserts `row is None` (hard delete). Replace it:

```python
def test_post_review_delete(mem_db, tmp_path, monkeypatch):
    """Kept for backwards-compat naming — now verifies soft delete."""
    _insert_invoice(mem_db, id="del1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/del1/delete")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT deleted_at FROM invoices WHERE id='del1'").fetchone()
    check.close()
    assert row is not None
    assert row["deleted_at"] is not None
```

- [ ] **Step 4: Add query_corbeille function to dashboard.py**

Add after `_query_validés`:

```python
def query_corbeille(conn: sqlite3.Connection) -> list:
    """Retourne les items soft-deleted, les plus récents en premier."""
    rows = conn.execute(
        "SELECT id, fichier_source, émetteur_nom, montant_ttc, type_document, "
        "date_document, deleted_at "
        "FROM invoices WHERE deleted_at IS NOT NULL "
        "ORDER BY deleted_at DESC"
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 5: Update review_delete route to soft delete**

Replace the existing `review_delete` function body:

```python
@app.route("/review/<item_id>/delete", methods=["POST"])
def review_delete(item_id):
    from datetime import timezone
    now = datetime.now(timezone.utc).isoformat()
    try:
        conn = open_db(db_path)
        conn.execute(
            "UPDATE invoices SET deleted_at=?, deleted_by='user' WHERE id=?",
            (now, item_id),
        )
        conn.commit()
        conn.close()
    except sqlite3.DatabaseError:
        pass
    return redirect("/")
```

- [ ] **Step 6: Add review_restore route**

Add after `review_delete`:

```python
@app.route("/review/<item_id>/restore", methods=["POST"])
def review_restore(item_id):
    try:
        conn = open_db(db_path)
        conn.execute(
            "UPDATE invoices SET deleted_at=NULL, deleted_by=NULL, "
            "statut_révision='à_réviser', révisé_par=NULL, "
            "date_révision=NULL, validé_le=NULL WHERE id=?",
            (item_id,),
        )
        conn.commit()
        conn.close()
    except sqlite3.DatabaseError:
        pass
    return redirect("/")
```

- [ ] **Step 7: Pass corbeille_list to the template in the index route**

In the `index()` function, after `items_validés_list = _query_validés(conn)`, add:

```python
corbeille_list = query_corbeille(conn)
```

And add `corbeille_list=corbeille_list` to the `render_template(...)` call.

- [ ] **Step 8: Run new tests + full suite**

```bash
python -m pytest tests/ -x -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add dashboard.py tests/test_dashboard.py
git commit -m "feat(dashboard): soft delete route, restore route, query_corbeille"
```

---

## Task 4: HTML — confirmation modal + Corbeille section

**Files:**
- Modify: `templates/dashboard.html`

- [ ] **Step 1: Add modal CSS to the `<style>` block**

Add before the closing `</style>` tag:

```css
/* Confirmation modal */
.modal-backdrop {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 100;
  align-items: center;
  justify-content: center;
}
.modal-backdrop.open { display: flex; }
.modal {
  background: white;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px 32px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
}
.modal h2 { font-size: 17px; font-weight: 600; margin-bottom: 12px; }
.modal p  { font-size: 14px; color: var(--on-surface-muted); margin-bottom: 24px; line-height: 1.5; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
/* Corbeille */
.corbeille-section {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px dashed var(--border);
}
.btn-restore {
  background: white;
  color: var(--on-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 5px 12px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-restore:hover { background: var(--surface-variant); }
```

- [ ] **Step 2: Add modal HTML element just before `</div>` closing the `.page`**

Add before `</div>` (the last `</div>` closing `.page`):

```html
{# ── Confirmation modale suppression ─────────────────────────────────────── #}
<div class="modal-backdrop" id="delete-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <div class="modal">
    <h2 id="modal-title">Supprimer ce document ?</h2>
    <p id="modal-body">Cette action est irréversible depuis l'interface — le document sera déplacé dans la corbeille.</p>
    <div class="modal-actions">
      <button type="button" class="btn-secondary" id="modal-cancel">Annuler</button>
      <form method="post" id="modal-form" action="">
        <button type="submit" class="btn-destructive">Supprimer</button>
      </form>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Replace the inline delete form in Bloc 4 with a modal trigger button**

Find the existing delete form in the review section (around line 682):

```html
<form method="post" action="/review/{{ item.id }}/delete" style="display:inline">
  <button type="submit" class="btn-destructive">Supprimer</button>
</form>
```

Replace with:

```html
<button type="button" class="btn-destructive"
        data-delete-id="{{ item.id }}"
        data-delete-label="{{ (item.fichier_source|basename) if item.fichier_source else '—' }} · {{ item.émetteur_nom or '—' }} · {{ item.montant_ttc | fr_currency if item.montant_ttc is not none else '—' }}"
        onclick="openDeleteModal(this)">Supprimer</button>
```

- [ ] **Step 4: Add Corbeille section before the closing `</main>` tag**

Add before `</main>`:

```html
{# ── Bloc 6 : Corbeille ──────────────────────────────────────────────────── #}
{% if corbeille_list %}
<section class="corbeille-section" aria-label="Corbeille">
  <p class="section-label">Corbeille ({{ corbeille_list|length }})</p>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th scope="col">Fichier</th>
          <th scope="col">Émetteur</th>
          <th scope="col" class="text-right">Montant TTC</th>
          <th scope="col">Type</th>
          <th scope="col">Date doc.</th>
          <th scope="col" class="text-muted">Supprimé le</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        {% for item in corbeille_list %}
        <tr>
          <td class="text-muted">{{ item.fichier_source|basename if item.fichier_source else '—' }}</td>
          <td>{{ item.émetteur_nom or '—' }}</td>
          <td class="text-right amount">{{ item.montant_ttc | fr_currency if item.montant_ttc is not none else '—' }}</td>
          <td class="text-muted">{{ item.type_document or '—' }}</td>
          <td>{{ item.date_document or '—' }}</td>
          <td class="text-muted" style="font-size:12px">{{ item.deleted_at[:10] if item.deleted_at else '—' }}</td>
          <td>
            <form method="post" action="/review/{{ item.id }}/restore" style="display:inline">
              <button type="submit" class="btn-restore">Restaurer</button>
            </form>
          </td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
</section>
{% endif %}
```

- [ ] **Step 5: Add modal JS to the `<script>` block**

Add inside the existing `<script>` tag, after the keyboard navigation block:

```javascript
// Delete confirmation modal
function openDeleteModal(btn) {
  var modal = document.getElementById('delete-modal');
  var form  = document.getElementById('modal-form');
  var body  = document.getElementById('modal-body');
  form.action = '/review/' + btn.dataset.deleteId + '/delete';
  body.textContent = btn.dataset.deleteLabel;
  modal.classList.add('open');
  document.getElementById('modal-cancel').focus();
}
document.getElementById('modal-cancel').addEventListener('click', function () {
  document.getElementById('delete-modal').classList.remove('open');
});
document.getElementById('delete-modal').addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { this.classList.remove('open'); }
});
```

- [ ] **Step 6: Run full test suite**

```bash
python -m pytest tests/ -x -q 2>&1 | tail -20
```

Expected: all pass (HTML tests check for rendered section IDs, not modal JS).

- [ ] **Step 7: Commit**

```bash
git add templates/dashboard.html
git commit -m "feat(ui): delete confirmation modal + corbeille section"
```

---

## Task 5: Final wiring, README update, reload

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full test suite one final time**

```bash
python -m pytest tests/ -q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 2: Update README**

Find the section that describes the dashboard or document management workflow. Add a note about soft delete and the Corbeille tab. The exact location depends on existing README structure — read it first, then insert naturally.

Key facts to mention:
- Deleting an invoice from the dashboard moves it to the Corbeille (trash) — it is never permanently deleted from the database.
- Items in the Corbeille can be restored to `à_réviser` state via the Restaurer button.
- This complies with French accounting law (Code de commerce — obligation de conservation 10 ans).

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs(readme): document soft delete and corbeille behaviour"
```

- [ ] **Step 4: Kill any running dashboard and restart**

```bash
pkill -f "python dashboard.py" 2>/dev/null; sleep 1
python /Users/valentinshodo/Projects/toolbox/invoice-manager/dashboard.py --port 7800 &
sleep 2
echo "Dashboard running on http://localhost:7800"
```
