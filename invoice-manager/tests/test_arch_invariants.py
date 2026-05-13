"""Invariants d'architecture (DDD).

Atteste que :
- aucun blueprint n'importe un autre blueprint (cf. DDD_PRACTICES.md §2) ;
- la couche domaine (`services/*.py`, `queries.py`) ne dépend pas de Flask
  (cf. DDD_PRACTICES.md §4 — les services sont purs).
"""

from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLUEPRINTS_DIR = ROOT / "blueprints"
SERVICES_DIR = ROOT / "services"
QUERIES_FILE = ROOT / "queries.py"


def _iter_python_modules(directory: Path):
    """Retourne les fichiers .py d'un dossier, hors __init__.py."""
    for path in sorted(directory.glob("*.py")):
        if path.name == "__init__.py":
            continue
        yield path


def _collect_imported_roots(source: str) -> list[tuple[str, int]]:
    """Retourne la liste (module_complet, lineno) des imports d'un module."""
    tree = ast.parse(source)
    imports: list[tuple[str, int]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append((alias.name, node.lineno))
        elif isinstance(node, ast.ImportFrom):
            if node.module and node.level == 0:
                imports.append((node.module, node.lineno))
    return imports


def test_aucun_blueprint_n_importe_un_autre_blueprint():
    # Given le dossier blueprints/ tel qu'il existe aujourd'hui
    violations: list[str] = []

    # When on parse tous les imports de tous les fichiers blueprint
    for module_path in _iter_python_modules(BLUEPRINTS_DIR):
        self_name = module_path.stem
        source = module_path.read_text(encoding="utf-8")
        for imported, lineno in _collect_imported_roots(source):
            if not imported.startswith("blueprints."):
                continue
            other = imported.split(".", 2)[1]
            if other == self_name:
                continue
            violations.append(
                f"  - blueprints/{module_path.name}:{lineno} importe '{imported}'"
            )

    # Then aucun ne référence blueprints.<autre>
    assert not violations, (
        "Violation DDD §2 — un blueprint ne doit jamais en importer un autre.\n"
        "Communiquer via queries.py / services / context_helpers à la place.\n"
        + "\n".join(violations)
    )


def test_la_couche_domaine_n_importe_pas_flask():
    # Given les modules de la couche domaine (services/ + queries.py)
    domain_files = list(_iter_python_modules(SERVICES_DIR))
    if QUERIES_FILE.exists():
        domain_files.append(QUERIES_FILE)

    violations: list[str] = []

    # When on parse leurs imports
    for module_path in domain_files:
        source = module_path.read_text(encoding="utf-8")
        for imported, lineno in _collect_imported_roots(source):
            root = imported.split(".", 1)[0]
            if root == "flask":
                rel = module_path.relative_to(ROOT)
                violations.append(f"  - {rel}:{lineno} importe '{imported}'")

    # Then aucun n'importe flask
    assert not violations, (
        "Violation DDD §4 — la couche domaine doit rester pure (pas de Flask).\n"
        "Les services prennent des données + une connexion, et retournent des données.\n"
        + "\n".join(violations)
    )
