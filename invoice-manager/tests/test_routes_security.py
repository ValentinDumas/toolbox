"""Garde-fou sécurité : aucune route mutante ne doit accepter GET.

Contexte : le dashboard est local-first (VISION.md), mais si demain il était
exposé sur LAN, toute route mutante (POST/PATCH/DELETE/PUT) atteignable en
GET deviendrait un vecteur CSRF trivial (un simple <img src=...> suffirait
à déclencher la mutation). Ce test inspecte la table de routage Flask et
échoue dès qu'une règle mélange un verbe mutant et GET.
"""

import pytest

from app import create_app


MUTATING_METHODS = {"POST", "PATCH", "DELETE", "PUT"}


@pytest.mark.xfail(
    reason=(
        "Régression connue : profils.configuration (/configuration) accepte "
        "GET et POST sur la même règle. À scinder en deux endpoints (GET pour "
        "afficher, POST pour muter) dans un ticket séparé."
    ),
    strict=False,
)
def test_aucune_route_mutante_n_accepte_get():
    # Given l'application Flask complète, telle qu'elle est servie à l'utilisateur
    app = create_app()

    # When on parcourt toutes les règles de routage déclarées par les blueprints
    routes_fautives = []
    for rule in app.url_map.iter_rules():
        methods = set(rule.methods or set())
        if not (methods & MUTATING_METHODS):
            continue
        if "GET" in methods:
            verbes = sorted(methods - {"HEAD", "OPTIONS"})
            routes_fautives.append(
                f"Route mutante {rule.endpoint} ({rule.rule}) accepte aussi GET: methods={verbes}"
            )

    # Then aucune route mutante ne doit être atteignable en GET (anti-CSRF)
    assert not routes_fautives, (
        "Routes mutantes accessibles en GET (vecteur CSRF) :\n  - "
        + "\n  - ".join(routes_fautives)
    )
