# Ledger Edit — Expandable Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le formulaire d'édition hors-tableau (révélé par CSS `:target`) par un `<tr>` expandable directement sous la ligne "validé" dans le ledger, avec signal visuel ambre clair.

**Architecture:** Le formulaire est rendu côté serveur dans un `<tr class="edit-row" hidden>` immédiatement après chaque ligne validée. JS gère uniquement le show/hide et l'état du bouton. Le POST est un submit classique sans AJAX. Les données du formulaire viennent de `ledger.rows` (qui fait déjà `SELECT *`), donc `_query_validés` / `items_validés_list` deviennent inutiles et sont supprimés.

**Tech Stack:** Jinja2, HTML/CSS, Vanilla JS, Flask, pytest

---

## Fichiers touchés

| Fichier | Action |
|---|---|
| `templates/dashboard.html` | Modifier — CSS, HTML tbody, supprimer bloc `:target`, ajouter JS |
| `dashboard.py` | Modifier — supprimer `_query_validés` et son usage |
| `tests/test_dashboard.py` | Modifier — ajouter tests HTML du nouveau markup |

---

### Task 1 : CSS — styles edit-row + supprimer review-item-hidden

**Files:**
- Modify: `templates/dashboard.html:166-167` (supprimer `.review-item-hidden`)
- Modify: `templates/dashboard.html` (ajouter styles)

- [ ] **Step 1 : Supprimer les deux lignes `.review-item-hidden`**

Localiser et supprimer exactement ces deux lignes dans le bloc `<style>` :

```css
.review-item-hidden { display: none; }
.review-item-hidden:target { display: block; }
```

- [ ] **Step 2 : Ajouter les nouveaux styles après `.btn-reset-item:hover`**

Repérer la règle `.btn-reset-item:hover, .btn-edit-item:hover { color: #111827; }` et ajouter juste après :

```css
/* Expandable edit row */
tr.editing {
  background: #FFFBEB !important;
  box-shadow: inset 3px 0 0 #F59E0B;
}
.edit-row > td { padding: 0; border-top: none; }
.edit-row-inner {
  background: #FFFBEB;
  border-left: 3px solid #F59E0B;
  padding: 16px 20px;
}
.edit-row-header {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 14px; font-size: 13px; font-weight: 500;
  color: var(--on-surface-muted);
}
.badge-editing { background: #FEF3C7; color: #92400E; }
```

- [ ] **Step 3 : Vérifier le rendu visuel manuel**

Lancer `python run.py` (ou le script de dev), ouvrir le dashboard, vérifier qu'aucune régression CSS n'est visible (aucun formulaire ne devrait encore apparaître — le JS n'est pas encore là).

- [ ] **Step 4 : Commit**

```bash
git add templates/dashboard.html
git commit -m "style: edit-row expandable — remplace review-item-hidden CSS"
```

---

### Task 2 : HTML — remplacer le bouton ✎ validé + insérer edit-row inline

**Files:**
- Modify: `templates/dashboard.html:638-664` (boucle `{% for row in ledger.rows %}`)

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `tests/test_dashboard.py`, ajouter après `test_ledger_totals` :

```python
def test_ledger_validé_edit_row_markup(mem_db, tmp_path, monkeypatch):
    """L'item validé doit rendre un <tr class='edit-row'> inline et un <button aria-controls>."""
    _insert_invoice(mem_db, id="v1", statut_révision="validé",
                    type_document="facture_reçue", montant_ht=200.0,
                    montant_tva=40.0, exercice_fiscal=2025,
                    date_document="2025-06-01", émetteur_nom="ACME")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode()
    assert 'aria-controls="edit-row-v1"' in html
    assert 'id="edit-row-v1"' in html
    assert 'class="edit-row"' in html
    assert 'href="#review-v1"' not in html
    assert 'review-item-hidden' not in html
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pytest tests/test_dashboard.py::test_ledger_validé_edit_row_markup -v
```

Attendu : FAIL — `aria-controls="edit-row-v1"` not in html

- [ ] **Step 3 : Modifier le bloc `{% if s == 'validé' %}` dans la boucle**

Localiser (environ ligne 638) :

```jinja
{% if s == 'validé' %}
  {% set has_corrections = row.corrections_log and row.corrections_log != '[]' %}
  <span class="badge badge-paid">Validé {{ '✎' if has_corrections else '✓' }}</span>
  <a href="#review-{{ row.id }}" class="btn-edit-item" title="Modifier (tracé)">✎</a>
```

Remplacer par :

```jinja
{% if s == 'validé' %}
  {% set has_corrections = row.corrections_log and row.corrections_log != '[]' %}
  <span class="badge badge-paid">Validé {{ '✎' if has_corrections else '✓' }}</span>
  <button type="button" class="btn-edit-item"
          aria-expanded="false" aria-controls="edit-row-{{ row.id }}"
          title="Modifier">✎</button>
```

- [ ] **Step 4 : Ajouter le `<tr class="edit-row">` après le `</tr>` de la ligne validée**

La boucle `{% for row in ledger.rows %}` se termine par `</tr>` puis `{% else %}`. Modifier pour insérer le edit-row après le `</tr>` pour les lignes validées.

Remplacer le `</tr>` qui ferme la ligne (il n'y a qu'un seul `</tr>` dans la boucle, à la ligne ~664) par :

```jinja
                </tr>
                {% if row.statut_révision == 'validé' %}
                {% set edit_party = row.émetteur_nom if row.type_document in expense_types else row.destinataire_nom %}
                <tr class="edit-row" id="edit-row-{{ row.id }}" hidden>
                  <td colspan="8">
                    <div class="edit-row-inner">
                      <div class="edit-row-header">
                        <span>Correction — {{ edit_party or '—' }} — {{ row.date_document or '—' }}</span>
                        <span class="badge badge-editing">En cours d'édition</span>
                      </div>
                      <form method="post" action="/review/{{ row.id }}/save">
                        <input type="hidden" name="year" value="{{ year }}">
                        <div class="review-fields">
                          <div>
                            <label class="review-label" for="type-v-{{ row.id }}">Type</label>
                            <select class="review-select" id="type-v-{{ row.id }}" name="type_document">
                              {% for dt in doc_types %}
                              <option value="{{ dt }}" {{ 'selected' if row.type_document == dt }}>{{ dt }}</option>
                              {% endfor %}
                            </select>
                          </div>
                          <div>
                            <label class="review-label" for="ht-v-{{ row.id }}">Montant HT</label>
                            <input class="review-input review-input-amount" type="number" step="0.01"
                                   id="ht-v-{{ row.id }}" name="montant_ht"
                                   value="{{ row.montant_ht if row.montant_ht is not none else '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="tva-v-{{ row.id }}">TVA</label>
                            <input class="review-input review-input-amount" type="number" step="0.01"
                                   id="tva-v-{{ row.id }}" name="montant_tva"
                                   value="{{ row.montant_tva if row.montant_tva is not none else '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="ttc-v-{{ row.id }}">TTC</label>
                            <input class="review-input review-input-amount" type="number" step="0.01"
                                   id="ttc-v-{{ row.id }}" name="montant_ttc"
                                   value="{{ row.montant_ttc if row.montant_ttc is not none else '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="date-v-{{ row.id }}">Date</label>
                            <input class="review-input" type="date" required
                                   id="date-v-{{ row.id }}" name="date_document"
                                   value="{{ row.date_document or '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="emetteur-v-{{ row.id }}">Émetteur</label>
                            <input class="review-input" type="text"
                                   id="emetteur-v-{{ row.id }}" name="émetteur_nom"
                                   value="{{ row.émetteur_nom or '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="num-v-{{ row.id }}">N° facture</label>
                            <input class="review-input" type="text"
                                   id="num-v-{{ row.id }}" name="numéro_facture"
                                   value="{{ row.numéro_facture or '' }}">
                          </div>
                          <div>
                            <label class="review-label" for="cat-v-{{ row.id }}">Catégorie</label>
                            <input class="review-input" type="text"
                                   id="cat-v-{{ row.id }}" name="catégorie"
                                   value="{{ row.catégorie or '' }}">
                          </div>
                          <div class="review-field-full">
                            <label class="review-label" for="notes-v-{{ row.id }}">Notes</label>
                            <textarea class="review-textarea" id="notes-v-{{ row.id }}" name="notes_correction"
                                      rows="2">{{ row.notes_correction or '' }}</textarea>
                          </div>
                        </div>
                        <div class="review-actions">
                          <button type="submit" class="btn-save">Enregistrer la correction</button>
                          <button type="button" class="btn-cancel-edit">Annuler</button>
                        </div>
                      </form>
                    </div>
                  </td>
                </tr>
                {% endif %}
```

- [ ] **Step 5 : Lancer le test**

```bash
pytest tests/test_dashboard.py::test_ledger_validé_edit_row_markup -v
```

Attendu : PASS

- [ ] **Step 6 : Lancer la suite complète**

```bash
pytest tests/test_dashboard.py -v
```

Attendu : tous PASS

- [ ] **Step 7 : Commit**

```bash
git add templates/dashboard.html tests/test_dashboard.py
git commit -m "feat(ledger): edit-row expandable inline pour items validés"
```

---

### Task 3 : HTML — supprimer le bloc `items_validés_list` hors-tableau

**Files:**
- Modify: `templates/dashboard.html:694-767` (bloc `{% for item in items_validés_list %}`)

- [ ] **Step 1 : Écrire le test qui vérifie l'absence de l'ancien bloc**

Ajouter dans `tests/test_dashboard.py` :

```python
def test_ledger_no_legacy_validés_block(mem_db, tmp_path, monkeypatch):
    """Le bloc review-item-hidden hors-tableau ne doit plus exister."""
    _insert_invoice(mem_db, id="v2", statut_révision="validé",
                    type_document="facture_reçue", montant_ht=100.0,
                    exercice_fiscal=2025, date_document="2025-07-01")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode()
    assert 'review-item-hidden' not in html
    assert 'Validé — correction tracée' not in html
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
pytest tests/test_dashboard.py::test_ledger_no_legacy_validés_block -v
```

Attendu : FAIL — `review-item-hidden` still in html

- [ ] **Step 3 : Supprimer le bloc dans le template**

Localiser et supprimer entièrement ce bloc (environ lignes 694-767) :

```jinja
        {# Correction de docs validés — ancres depuis le ledger #}
        {% for item in items_validés_list %}
        <div class="review-item review-item-hidden" id="review-{{ item.id }}">
          ...
        </div>
        {% endfor %}
```

Supprimer depuis la ligne `{# Correction de docs validés...` jusqu'au `{% endfor %}` inclus.

- [ ] **Step 4 : Lancer les deux tests**

```bash
pytest tests/test_dashboard.py::test_ledger_no_legacy_validés_block tests/test_dashboard.py::test_ledger_validé_edit_row_markup -v
```

Attendu : PASS PASS

- [ ] **Step 5 : Lancer la suite complète**

```bash
pytest tests/test_dashboard.py -v
```

Attendu : tous PASS

- [ ] **Step 6 : Commit**

```bash
git add templates/dashboard.html tests/test_dashboard.py
git commit -m "refactor(ledger): supprimer bloc review-item-hidden hors-tableau"
```

---

### Task 4 : Python — supprimer `_query_validés` et `items_validés_list`

**Files:**
- Modify: `dashboard.py:130-140` (fonction `_query_validés`)
- Modify: `dashboard.py:201` (appel dans la route)
- Modify: `dashboard.py:218` (paramètre render_template)

- [ ] **Step 1 : Supprimer la fonction `_query_validés`**

Localiser et supprimer les lignes 130-140 :

```python
def _query_validés(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items validés pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source, texte_brut, statut_révision, corrections_log "
        "FROM invoices WHERE statut_révision='validé' AND deleted_at IS NULL "
        "AND exercice_fiscal=? ORDER BY date_document ASC",
        (year,),
    ).fetchall()
    return [dict(r) for r in rows]
```

- [ ] **Step 2 : Supprimer l'appel dans la route index**

Localiser et supprimer la ligne :

```python
items_validés_list = _query_validés(conn, year)
```

- [ ] **Step 3 : Supprimer le paramètre dans render_template**

Localiser et supprimer la ligne :

```python
items_validés_list=items_validés_list,
```

- [ ] **Step 4 : Lancer les tests**

```bash
pytest tests/test_dashboard.py -v
```

Attendu : tous PASS (le template ne référence plus `items_validés_list`)

- [ ] **Step 5 : Commit**

```bash
git add dashboard.py
git commit -m "refactor: supprimer _query_validés — données viennent de query_ledger"
```

---

### Task 5 : JavaScript — toggle expandable row

**Files:**
- Modify: `templates/dashboard.html` (ajouter `<script>` avant `</body>`)

- [ ] **Step 1 : Ajouter le script avant `</body>`**

Repérer la balise `</body>` et insérer juste avant :

```html
<script>
(function () {
  function closeAll() {
    document.querySelectorAll('.edit-row:not([hidden])').forEach(function (editRow) {
      editRow.hidden = true;
      var src = editRow.previousElementSibling;
      if (src) {
        src.classList.remove('editing');
        var btn = src.querySelector('.btn-edit-item[aria-controls]');
        if (btn) { btn.textContent = '✎'; btn.setAttribute('aria-expanded', 'false'); }
      }
    });
  }

  document.querySelectorAll('.btn-edit-item[aria-controls]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var editRow = document.getElementById(btn.getAttribute('aria-controls'));
      var src = btn.closest('tr');
      var isOpen = !editRow.hidden;
      closeAll();
      if (!isOpen) {
        editRow.hidden = false;
        src.classList.add('editing');
        btn.textContent = '✕';
        btn.setAttribute('aria-expanded', 'true');
        var first = editRow.querySelector('select, input, textarea');
        if (first) first.focus();
        editRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  document.querySelectorAll('.btn-cancel-edit').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var editRow = btn.closest('.edit-row');
      var src = editRow.previousElementSibling;
      editRow.hidden = true;
      if (src) {
        src.classList.remove('editing');
        var editBtn = src.querySelector('.btn-edit-item[aria-controls]');
        if (editBtn) { editBtn.textContent = '✎'; editBtn.setAttribute('aria-expanded', 'false'); }
      }
    });
  });
}());
</script>
```

- [ ] **Step 2 : Test manuel — vérifier le comportement complet**

Lancer le serveur et tester :
1. Ouvrir l'onglet Ledger avec au moins un item "validé"
2. Cliquer `✎` → la ligne source passe en ambre, le formulaire apparaît dessous, le bouton affiche `✕`
3. Cliquer `✕` → le formulaire se referme, la ligne revient normale
4. Cliquer `✎` sur une ligne, puis `✎` sur une autre → la première se referme automatiquement
5. Cliquer "Annuler" dans le formulaire → idem que `✕`
6. Cliquer "Enregistrer" → POST vers `/review/{id}/save`, rechargement de page

- [ ] **Step 3 : Commit**

```bash
git add templates/dashboard.html
git commit -m "feat(ledger): JS toggle expandable edit-row avec signal ambre"
```

---

## Self-review

**Spec coverage :**
- ✅ `<button aria-expanded aria-controls>` remplace `<a href="#review-">` — Task 2
- ✅ `<tr class="edit-row" hidden>` inséré inline — Task 2
- ✅ Exclusivité (un seul ouvert) — Task 5 `closeAll()`
- ✅ Icône `✎` → `✕` + `aria-expanded` — Task 5
- ✅ `scrollIntoView` — Task 5
- ✅ Focus premier champ à l'ouverture — Task 5
- ✅ Bouton "Annuler" `type="button"` — Task 2
- ✅ Signal visuel ambre (ligne source + edit-row) — Task 1 CSS
- ✅ Suppression bloc `:target` CSS — Task 1
- ✅ Suppression `{% for item in items_validés_list %}` — Task 3
- ✅ Suppression `_query_validés` — Task 4
- ✅ `auto_validé` non touché — hors périmètre confirmé (aucune tâche ne le modifie)

**Placeholders :** aucun TBD, tout le code est écrit.

**Type consistency :** `edit-row`, `btn-edit-item`, `btn-cancel-edit`, `editing` utilisés de manière cohérente entre CSS (Task 1), HTML (Task 2), et JS (Task 5).
