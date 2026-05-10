# Onglet Erreurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un 4ème onglet "Erreurs (N)" dans le dashboard listant les fichiers du dossier `errors/` avec prévisualisation, retry (remet dans input/ + relance extraction) et suppression.

**Architecture:** Pattern identique à l'onglet Corbeille — helper Python qui lit le dossier disque, passé au template via la route `/`, rendu en onglet avec les routes `/errors/<filename>/retry` (JSON + background thread) et `/errors/<filename>/delete` (form POST + redirect). La modale de confirmation existante est réutilisée telle quelle.

**Tech Stack:** Flask, Jinja2, SQLite, Python 3.11, pytest

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `dashboard.py` | + `query_error_files()`, + route `/errors/<filename>/retry`, + route `/errors/<filename>/delete`, + `errors_list` dans `index()` |
| `templates/dashboard.html` | + tab "Erreurs", + `#panel-erreurs`, + `'erreurs'` dans TABS, + `retryErrorFile()`, + `openErrorDeleteModal()` |
| `tests/test_dashboard.py` | + 6 nouveaux tests |

---

## Task 1 : Helper `query_error_files` + tests

**Fichiers :**
- Modify: `dashboard.py` (après `query_health`, ligne ~126)
- Modify: `tests/test_dashboard.py`

- [ ] **Écrire le test en premier**

Ajouter à la fin de la section `# ── Data queries` dans `tests/test_dashboard.py` :

```python
def test_query_error_files_empty(tmp_path):
    from dashboard import query_error_files
    paths = {"errors": tmp_path / "nonexistent"}
    assert query_error_files(paths) == []


def test_query_error_files_lists_files(tmp_path):
    from dashboard import query_error_files
    errors_dir = tmp_path / "errors"
    errors_dir.mkdir()
    (errors_dir / "broken.pdf").write_bytes(b"x" * 2048)
    (errors_dir / ".hidden").touch()          # doit être exclu
    paths = {"errors": errors_dir}
    result = query_error_files(paths)
    assert len(result) == 1
    assert result[0]["name"] == "broken.pdf"
    assert result[0]["size_kb"] == 2.0
    assert "mtime" in result[0]
```

- [ ] **Lancer les tests pour vérifier qu'ils échouent**

```bash
python3 -m pytest tests/test_dashboard.py::test_query_error_files_empty tests/test_dashboard.py::test_query_error_files_lists_files -v
```
Attendu : `FAILED` avec `ImportError: cannot import name 'query_error_files'`

- [ ] **Implémenter `query_error_files` dans `dashboard.py`**

Ajouter après la fonction `query_health` (ligne ~126) :

```python
def query_error_files(paths: dict) -> list[dict]:
    errors_dir = paths["errors"]
    if not errors_dir.exists():
        return []
    files = []
    for f in sorted(errors_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size_kb": round(stat.st_size / 1024, 1),
                "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
            })
    return files
```

- [ ] **Lancer les tests pour vérifier qu'ils passent**

```bash
python3 -m pytest tests/test_dashboard.py::test_query_error_files_empty tests/test_dashboard.py::test_query_error_files_lists_files -v
```
Attendu : `PASSED PASSED`

- [ ] **Commit**

```bash
git add dashboard.py tests/test_dashboard.py
git commit -m "feat: add query_error_files helper"
```

---

## Task 2 : Route `/errors/<filename>/retry` + tests

**Fichiers :**
- Modify: `dashboard.py` (après la route `/upload`)
- Modify: `tests/test_dashboard.py`

- [ ] **Écrire les tests**

Ajouter dans `tests/test_dashboard.py` après la section Flask routes existante :

```python
def test_errors_retry_moves_file(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    errors_dir  = profile_dir / "errors"
    input_dir   = profile_dir / "input"
    f = errors_dir / "broken.pdf"
    f.write_bytes(b"fake pdf")

    from unittest.mock import MagicMock
    import dashboard as _dash
    monkeypatch.setattr(_dash.threading, "Thread", MagicMock)

    with app.test_client() as client:
        resp = client.post("/errors/broken.pdf/retry")

    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    assert not f.exists()
    assert (input_dir / "broken.pdf").exists()


def test_errors_retry_404_if_missing(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/errors/nonexistent.pdf/retry")
    assert resp.status_code == 404
```

- [ ] **Lancer les tests pour vérifier qu'ils échouent**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_retry_moves_file tests/test_dashboard.py::test_errors_retry_404_if_missing -v
```
Attendu : `FAILED` avec `404 NOT FOUND` (route inexistante)

- [ ] **Implémenter la route dans `dashboard.py`**

Ajouter après la route `/upload` :

```python
@app.route("/errors/<filename>/retry", methods=["POST"])
def errors_retry(filename):
    slug = _active_slug()
    if not slug:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    paths = resolve_paths(slug)
    src = paths["errors"] / Path(filename).name
    if not src.is_file():
        return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
    dest = paths["input"] / src.name
    shutil.move(str(src), dest)

    def _run():
        subprocess.run(
            [sys.executable, str(HERE / "run.py"), "--profile", slug],
            cwd=str(HERE), capture_output=True,
        )

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"ok": True})
```

Vérifier que `shutil` et `threading` sont déjà importés en haut du fichier. Si non, les ajouter aux imports existants.

- [ ] **Lancer les tests pour vérifier qu'ils passent**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_retry_moves_file tests/test_dashboard.py::test_errors_retry_404_if_missing -v
```
Attendu : `PASSED PASSED`

- [ ] **Commit**

```bash
git add dashboard.py tests/test_dashboard.py
git commit -m "feat: add /errors/<filename>/retry route"
```

---

## Task 3 : Route `/errors/<filename>/delete` + tests

**Fichiers :**
- Modify: `dashboard.py`
- Modify: `tests/test_dashboard.py`

- [ ] **Écrire les tests**

```python
def test_errors_delete_removes_file(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    errors_dir  = profile_dir / "errors"
    f = errors_dir / "broken.pdf"
    f.write_bytes(b"fake pdf")

    with app.test_client() as client:
        resp = client.post("/errors/broken.pdf/delete", data={"year": "2025"})

    assert resp.status_code == 302
    assert not f.exists()


def test_errors_delete_404_if_missing(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/errors/nonexistent.pdf/delete", data={"year": "2025"})
    assert resp.status_code == 404


def test_errors_delete_rejects_path_traversal(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/errors/../../etc/passwd/delete", data={"year": "2025"})
    assert resp.status_code == 404
```

- [ ] **Lancer les tests pour vérifier qu'ils échouent**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_delete_removes_file tests/test_dashboard.py::test_errors_delete_404_if_missing tests/test_dashboard.py::test_errors_delete_rejects_path_traversal -v
```
Attendu : `FAILED` (route inexistante)

- [ ] **Implémenter la route dans `dashboard.py`**

Ajouter après la route `/errors/<filename>/retry` :

```python
@app.route("/errors/<filename>/delete", methods=["POST"])
def errors_delete(filename):
    slug = _active_slug()
    if not slug:
        return jsonify({"ok": False, "error": "Aucun profil actif"}), 400
    year = request.form.get("year", datetime.now().year)
    paths = resolve_paths(slug)
    target = paths["errors"] / Path(filename).name
    if not target.is_file():
        return jsonify({"ok": False, "error": "Fichier introuvable"}), 404
    target.unlink()
    return redirect(f"/?year={year}")
```

- [ ] **Lancer les tests pour vérifier qu'ils passent**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_delete_removes_file tests/test_dashboard.py::test_errors_delete_404_if_missing tests/test_dashboard.py::test_errors_delete_rejects_path_traversal -v
```
Attendu : `PASSED PASSED PASSED`

- [ ] **Commit**

```bash
git add dashboard.py tests/test_dashboard.py
git commit -m "feat: add /errors/<filename>/delete route"
```

---

## Task 4 : Passer `errors_list` au template + test

**Fichiers :**
- Modify: `dashboard.py` (fonction `index()`)
- Modify: `tests/test_dashboard.py`

- [ ] **Écrire le test**

```python
def test_errors_list_in_template(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    (profile_dir / "errors" / "broken.pdf").write_bytes(b"x")

    with app.test_client() as client:
        resp = client.get("/?year=2025")

    assert b"broken.pdf" in resp.data
    assert b"Erreurs (1)" in resp.data
```

- [ ] **Lancer le test pour vérifier qu'il échoue**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_list_in_template -v
```
Attendu : `FAILED` — `broken.pdf` absent du HTML (template pas encore modifié)

- [ ] **Modifier `index()` dans `dashboard.py`**

Dans la fonction `index()` (ligne ~464), ajouter après `corbeille_list = query_corbeille(...)` :

```python
errors_list = query_error_files(paths)
```

Puis ajouter `errors_list=errors_list,` dans l'appel `render_template(...)`.

Résultat :
```python
health = query_health(conn, paths)
items_a_reviser_list = query_items_a_reviser(conn, year)
corbeille_list = query_corbeille(conn, year)
errors_list = query_error_files(paths)          # ← ligne ajoutée
```

```python
return render_template(
    "dashboard.html",
    ...
    corbeille_list=corbeille_list,
    errors_list=errors_list,                    # ← ligne ajoutée
    ...
)
```

- [ ] **Ajouter le tab et le panel dans `templates/dashboard.html`**

**Tab button** — ajouter après le bouton Corbeille (ligne ~964) :

```html
  <button role="tab" id="tab-erreurs" aria-controls="panel-erreurs"
          aria-selected="false" class="tab-btn" tabindex="-1"
          {% if not errors_list %}disabled aria-disabled="true"{% endif %}>
    Erreurs ({{ errors_list|length }})
  </button>
```

**Panel** — ajouter juste avant `</main>` (ligne ~1325), après la fermeture de `#panel-corbeille` :

```html
      <div role="tabpanel" id="panel-erreurs" aria-labelledby="tab-erreurs" hidden>
        {% if errors_list %}
        <section aria-label="Fichiers en erreur">
          <h2 class="section-label">Erreurs ({{ errors_list|length }})</h2>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th scope="col">Fichier</th>
                  <th scope="col" class="text-right">Taille</th>
                  <th scope="col">Date</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {% for f in errors_list %}
                <tr>
                  <td class="cell-filename">{{ f.name }}</td>
                  <td class="text-right text-muted" style="font-size:12px">{{ f.size_kb }} Ko</td>
                  <td class="text-muted" style="font-size:12px">{{ f.mtime }}</td>
                  <td>
                    <span class="file-actions">
                      <button onclick="openPdfPreview('/preview/{{ f.name }}', '{{ f.name }}')"
                              aria-label="Prévisualiser {{ f.name }}" class="btn-icon-preview">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </button>
                      <button type="button" class="btn-restore"
                              onclick="retryErrorFile(this, '{{ f.name }}')"
                              aria-label="Réessayer l'extraction de {{ f.name }}">
                        ↩ Réessayer
                      </button>
                      <button type="button" class="btn-icon-trash"
                              data-error-filename="{{ f.name }}"
                              data-delete-label="{{ f.name }}"
                              onclick="openErrorDeleteModal(this)"
                              aria-label="Supprimer {{ f.name }}">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      </button>
                    </span>
                  </td>
                </tr>
                {% endfor %}
              </tbody>
            </table>
          </div>
        </section>
        {% else %}
        <p class="tab-empty">Aucun fichier en erreur.</p>
        {% endif %}
      </div>
```

- [ ] **Lancer le test pour vérifier qu'il passe**

```bash
python3 -m pytest tests/test_dashboard.py::test_errors_list_in_template -v
```
Attendu : `PASSED`

- [ ] **Commit**

```bash
git add dashboard.py templates/dashboard.html tests/test_dashboard.py
git commit -m "feat: pass errors_list to template and add Erreurs tab panel"
```

---

## Task 5 : JavaScript — TABS, retry, delete modal

**Fichiers :**
- Modify: `templates/dashboard.html` (bloc `<script>`)

Pas de test automatisé — vérification manuelle décrite en fin de task.

- [ ] **Ajouter `'erreurs'` dans le tableau TABS**

Trouver la ligne (ligne ~1347) :
```javascript
var TABS = ['ledger', 'reviser', 'corbeille'];
```
Remplacer par :
```javascript
var TABS = ['ledger', 'reviser', 'corbeille', 'erreurs'];
```

- [ ] **Ajouter `retryErrorFile()` dans le bloc `<script>`**

Ajouter après la fonction `openDeleteModal` (ligne ~1406) :

```javascript
function retryErrorFile(btn, filename) {
  btn.disabled = true;
  btn.textContent = '…';
  fetch('/errors/' + encodeURIComponent(filename) + '/retry', {
    method: 'POST',
    headers: { 'X-Requested-With': 'XMLHttpRequest' }
  })
  .then(function (r) { return r.json(); })
  .then(function (data) {
    if (data.ok) { location.reload(); }
    else { btn.disabled = false; btn.textContent = '↩ Réessayer'; }
  })
  .catch(function () { btn.disabled = false; btn.textContent = '↩ Réessayer'; });
}
```

- [ ] **Ajouter `openErrorDeleteModal()` dans le bloc `<script>`**

Ajouter après `retryErrorFile` :

```javascript
function openErrorDeleteModal(btn) {
  var modal = document.getElementById('delete-modal');
  var form  = document.getElementById('modal-form');
  var body  = document.getElementById('modal-body');
  form.action = '/errors/' + encodeURIComponent(btn.dataset.errorFilename) + '/delete';
  body.textContent = btn.dataset.deleteLabel;
  modal.classList.add('open');
  document.getElementById('modal-cancel').focus();
}
```

- [ ] **Lancer la suite de tests complète pour vérifier aucune régression**

```bash
python3 -m pytest tests/ -v
```
Attendu : tous les tests passent (les 101 existants + les 6 nouveaux = 107 au total).

- [ ] **Vérification manuelle**

1. Lancer `python3 dashboard.py`
2. Déposer un fichier illisible dans `data/profiles/<slug>/input/` (ex: `touch data/profiles/<slug>/input/fake.pdf`)
3. Cliquer "↻ Mettre à jour" dans Santé — le fichier doit atterrir dans `errors/` et l'onglet "Erreurs (1)" doit apparaître (non grisé)
4. Cliquer 🔍 sur le fichier — prévisualisation (ou erreur 415 si format non supporté)
5. Cliquer "↩ Réessayer" — bouton passe à "…", page se recharge, fichier de retour dans `errors/` si ça re-échoue
6. Cliquer ✕ — modale de confirmation s'ouvre, "Supprimer" efface le fichier, onglet repasse grisé
7. Vérifier que le badge Santé et le compteur d'onglet sont cohérents

- [ ] **Commit final**

```bash
git add templates/dashboard.html
git commit -m "feat: wire JS for errors tab — TABS, retryErrorFile, openErrorDeleteModal"
```
