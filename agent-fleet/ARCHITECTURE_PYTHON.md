# Architecture Python — Bonnes pratiques

## Structure répertoire

```
my-project/
├── src/my_package/      # code source isolé (évite les imports ambigus)
│   ├── __init__.py
│   ├── core.py
│   └── utils.py
├── tests/
│   ├── conftest.py      # fixtures partagées
│   └── test_core.py
├── data/                # données locales (gitignore si sensible)
├── docs/
├── pyproject.toml       # config unifiée (build, deps, linters)
├── .env.example
└── README.md
```

## Principes d'architecture

**1. Séparation des couches**

```
entrée (CLI/API) → logique métier → stockage
```

Jamais de SQL dans les routes. Jamais de logique dans les modèles.

**2. Une responsabilité par module**

Chaque fichier = un rôle unique et nommé explicitement.
Exemple : `extract.py` parse, `export.py` génère, `dashboard.py` affiche.

**3. Config centralisée**

Un seul point d'entrée pour la config. Jamais de valeurs hardcodées éparpillées dans les modules.
Ordre de priorité : CLI > fichier config > valeurs par défaut.

**4. Source de vérité unique**

La base de données est la vérité. Pas de duplication d'état entre CSV, DB et cache mémoire.

**5. Dépendances vers l'intérieur**

```
UI → logique métier → modèles/DB
```

Les couches basses ne connaissent pas les couches hautes.

## Outils standard

| Besoin      | Outil                        |
|-------------|------------------------------|
| Packaging   | `pyproject.toml` + `uv`      |
| Linting     | `ruff`                       |
| Types       | `mypy` (graduel)             |
| Tests       | `pytest` + `pytest-cov`      |
| Env vars    | `.env` + `python-dotenv`     |
