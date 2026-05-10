# Spec — Onglet "Erreurs" dans le dashboard

## Contexte

Le bloc Santé du dashboard affiche un compteur de fichiers dans `errors/` (dossier où `extract.py` dépose les fichiers qu'il n'a pas pu traiter), mais ne permet aucune action. L'utilisateur doit aller fouiller le dossier à la main pour diagnostiquer ou relancer un fichier. Cette spec ajoute un onglet dédié avec liste, prévisualisation, et deux actions : Réessayer et Supprimer.

## Décisions de design

- **Pattern** : 4ème onglet dans la tab bar ("Erreurs (N)"), identique à l'onglet Corbeille — grisé et non cliquable si 0 fichier.
- **Retry** : déplace le fichier de `errors/` vers `input/` puis relance `run.py --profile slug` en thread background. Si l'extraction échoue à nouveau, le fichier revient dans `errors/` sans état supplémentaire.
- **Suppression** : hard delete du fichier disque (pas de DB). Réutilise la modale `#delete-modal` existante.
- **Prévisualisation** : les routes `/files/<filename>` et `/preview/<filename>` cherchent déjà dans `errors/` — aucune route à ajouter.

## Backend — `dashboard.py`

### Nouvelle fonction helper

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

### Nouvelle route POST `/errors/<filename>/retry`

- Vérifie que le profil est actif.
- Résout `errors_dir / filename` (basename only, pas de path traversal).
- Déplace le fichier vers `input_dir / filename`.
- Lance `run.py --profile slug` en thread background (même pattern que `/upload`).
- Retourne `{"ok": True}`.
- Erreurs : 400 si pas de profil, 404 si fichier absent.

### Nouvelle route POST `/errors/<filename>/delete`

- Vérifie que le profil est actif.
- Résout `errors_dir / filename` (basename only).
- Supprime le fichier (`f.unlink()`).
- Retourne un redirect vers `/?year=<year>` (cohérent avec les routes delete existantes qui font un redirect — la modale `#delete-modal` utilise un form POST standard, pas fetch).
- Erreurs : 400 si pas de profil, 404 si fichier absent.

### Passage à la template

Ajouter `errors_list = query_error_files(paths)` dans la route `/` et le passer au `render_template`.

## Template — `dashboard.html`

### Tab bar

Ajouter un 4ème bouton après "Corbeille" :

```html
<button role="tab" id="tab-erreurs" aria-controls="panel-erreurs"
        aria-selected="false" class="tab-btn" tabindex="-1"
        {% if not errors_list %}disabled aria-disabled="true"{% endif %}>
  Erreurs ({{ errors_list|length }})
</button>
```

### Panel `#panel-erreurs`

Même structure que `#panel-corbeille` : tableau avec colonnes Fichier, Taille, Date, Actions. Chaque ligne :
- 🔍 lien vers `/preview/<name>` (ouvre la prévisualisation inline existante)
- Bouton **Réessayer** → `fetch POST /errors/<name>/retry` → reload
- Bouton **✕** → déclenche `#delete-modal` avec action pointant sur `/errors/<name>/delete`

### JS

- Ajouter `'erreurs'` dans le tableau `TABS`.
- Ajouter une fonction `retryErrorFile(filename)` : fetch POST, affiche un spinner sur le bouton, reload à la réponse.
- Réutiliser la logique `#delete-modal` existante (déjà générique via `modal-form.action`).

## Sécurité

Les deux routes backend utilisent `Path(filename).name` pour isoler le basename et empêcher tout path traversal (`../../etc/passwd`).

## Tests manuels

1. Déposer un fichier illisible dans `input/` (ex. fichier texte renommé `.pdf`) → pipeline → vérifier qu'il apparaît dans l'onglet Erreurs.
2. Cliquer Réessayer → vérifier que le fichier disparaît de l'onglet pendant l'extraction.
3. Si l'extraction échoue à nouveau → vérifier que le fichier réapparaît dans l'onglet.
4. Cliquer ✕ → modale de confirmation → confirmer → fichier supprimé, onglet se grise si liste vide.
5. Cliquer 🔍 sur un PDF → prévisualisation inline (route existante).
6. Vérifier avec 0 fichier en erreur : onglet grisé et non cliquable.
7. Vérifier que le compteur dans le bloc Santé et l'onglet sont cohérents.
