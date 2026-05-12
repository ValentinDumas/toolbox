# BDD — Behavior-Driven Development

Inspiré de North, *Introducing BDD* (2006) et Adzic, *Specification by Example* (2011).
S'applique à **tout test** de ce dépôt — Python (pytest), JS, intégration, UI.

**Priorité :** les tests fonctionnels BDD sont la **première forme de test** à écrire. Ils sont la **spécification exécutable** du domaine. Les tests techniques (unitaires de bas niveau, parsing, helpers) viennent **en complément**, jamais à la place.

---

## 1. Un test = une règle métier, exprimée en langage ubiquitaire

Un test BDD se lit comme une phrase de cahier des charges. Il parle de `facture`, `émetteur`, `révision`, `statut`, jamais de `dict`, `row`, `mock`.

```python
# ❌ Test technique — décrit l'implémentation
def test_update_invoice_returns_200(): ...
def test_recompute_returns_float(): ...

# ✅ Test BDD — décrit une règle comptable
def test_facture_à_réviser_validée_par_humain_devient_validée(): ...
def test_facture_validée_avec_confiance_faible_est_rétrogradée_à_réviser(): ...
def test_récapitulatif_fiscal_exclut_les_factures_à_réviser(): ...
```

**Règle :** si tu peux lire le nom du test à voix haute à un comptable et qu'il comprend la règle, le nom est bon.

---

## 2. Structure Given / When / Then visible

Chaque test a trois sections clairement délimitées. Les commentaires `# Given`, `# When`, `# Then` sont **autorisés et encouragés** — ils balisent la spec, pas l'implémentation.

```python
def test_facture_validée_avec_montant_manquant_est_rétrogradée():
    # Given une facture validée avec un montant TTC renseigné
    facture = make_facture(statut_révision=STATUT_VALIDE, montant_ttc=120.0)
    conn = seed_db(facture)

    # When un humain efface le montant TTC et sauvegarde
    form = {"montant_ttc": "", "statut_révision": STATUT_VALIDE}
    result = save_review(form, facture["id"], conn)

    # Then la facture repasse en "à réviser" avec un avertissement
    assert result["statut_révision"] == STATUT_A_REVISER
    assert "À réviser" in result["warning"]
```

- **Given** : état initial, fixtures, données métier (pas de mocks techniques)
- **When** : **un seul** acte métier (une transition, une commande)
- **Then** : **une seule** assertion métier principale (les corollaires sont des sous-asserts du même comportement)

Trois actes `When` dans un test = trois tests.

---

## 3. Le test atteste le design — pas l'inverse

Un test BDD doit pouvoir **survivre à un refactor**. Il décrit **ce que** le système fait pour le métier, pas **comment** il le fait.

```python
# ❌ Fragile — casse au moindre refactor interne
def test_save_calls_persist_invoice_then_log():
    with patch("services.revision._persist_invoice") as p:
        save_review(...)
        p.assert_called_once_with(...)

# ✅ Robuste — décrit l'effet observable
def test_modification_d_une_facture_apparait_dans_le_journal_de_corrections():
    save_review(form, facture_id, conn)
    log = query_corrections_log(conn, facture_id)
    assert log[-1]["champ"] == "montant_ttc"
    assert log[-1]["actor"] == "humain"
```

**Test fragile** = couplé à l'implémentation (noms de fonctions internes, ordre d'appel, structures privées).
**Test robuste** = couplé au comportement observable (état DB, valeur retournée, événement métier).

Si renommer une fonction privée casse 30 tests, les tests testent la mauvaise chose.

---

## 4. Pyramide des tests — la base est BDD

```
        /\
       /  \    ← UI / E2E (peu, lents, fragiles)
      /----\
     /      \  ← Intégration BDD (cœur de la spec)
    /--------\
   /          \ ← Unitaires techniques (parsing, helpers purs)
  /------------\
```

**Priorité d'écriture :**

1. **D'abord** : tests BDD d'intégration sur les agrégats (`Facture`, `Profil`, `Paramètre`) — ils figent les règles métier.
2. **Ensuite** : tests unitaires sur les helpers purs (`_parse_amount`, `_validate_siren`) — ils figent les briques techniques.
3. **En dernier** : tests E2E sur les flux UI critiques (validation d'une facture, export du ledger) — ils figent l'expérience utilisateur.

Un module sans test BDD de niveau 1 ne peut pas être considéré comme « livré ».

---

## 5. Le test précède (ou accompagne) le code — jamais après coup

Pour toute nouvelle règle métier :

1. Écris le test BDD qui exprime la règle, en français, dans le langage du domaine.
2. Lance-le → il échoue (rouge).
3. Implémente le minimum pour le faire passer (vert).
4. Refactore en gardant le test vert.

Pour un bug :

1. Écris le test BDD qui **reproduit** le bug et exprime le comportement **attendu**.
2. Le test échoue.
3. Corrige le code → le test passe.
4. Le test reste comme garde-fou anti-régression.

---

## 6. Fixtures = données métier, pas données techniques

Les fixtures partagées (`conftest.py`) construisent des **objets métier nommés**, pas des dictionnaires anonymes.

```python
# ❌ Fixture technique
@pytest.fixture
def row():
    return {"id": 1, "f1": "x", "f2": 0.8}

# ✅ Fixture métier
@pytest.fixture
def facture_émise_à_réviser():
    """Facture émise avec confiance faible, en attente de révision humaine."""
    return make_facture(
        type_document=DOC_FACTURE_EMISE,
        statut_révision=STATUT_A_REVISER,
        confiance=0.65,
    )
```

Le nom de la fixture **raconte** le scénario.

---

## 7. Scénarios paramétrés = table de spécification

`pytest.mark.parametrize` est l'équivalent Python d'une table « Examples » de Gherkin. Utilise-le pour exprimer une règle qui se décline en plusieurs cas.

```python
@pytest.mark.parametrize("profil_fiscal, taux_tva, déductible", [
    ("auto-entrepreneur", 0.20, False),   # micro-BNC : pas de TVA déductible
    ("SASU",              0.20, True),
    ("SARL",              0.20, True),
    ("salarié",           0.20, False),   # n'a pas vocation à déduire
])
def test_tva_déductible_selon_profil_fiscal(profil_fiscal, taux_tva, déductible):
    # Given un profil fiscal donné et une facture reçue à 20% de TVA
    facture = make_facture_reçue(taux_tva=taux_tva)

    # When on calcule la déductibilité à l'export
    result = is_tva_déductible(facture, profil_fiscal)

    # Then le résultat correspond à la règle fiscale du profil
    assert result is déductible
```

La table EST la spécification. Ajouter un profil fiscal = ajouter une ligne.

---

## 8. Vocabulaire interdit dans les noms de tests BDD

Les mots suivants signalent un test **technique** qui ne devrait pas porter le label BDD :

- `returns_`, `calls_`, `raises_`, `mocks_`, `patches_`
- `_dict`, `_list`, `_string`, `_int`
- `_method`, `_function`, `_class`, `_handler`, `_controller`
- `200`, `404`, `500` (codes HTTP — sauf si tester le code HTTP **est** la règle métier)

Préfère :

- `est_`, `devient_`, `exclut_`, `inclut_`, `apparait_`, `rétrograde_`, `valide_`, `refuse_`
- noms de concepts métier : `facture`, `émetteur`, `révision`, `corbeille`, `cadence`

---

## 9. Un test qui passe sans implémentation ne teste rien

Si tu supprimes le code de production et que le test passe encore, **le test est faux**. Vérifie systématiquement :

1. Écris le test.
2. Lance-le → il doit échouer.
3. Implémente.
4. Lance-le → il passe.
5. Casse volontairement l'implémentation (commente une ligne) → il doit re-échouer.

Tests qui ne passent jamais au rouge = tests décoratifs.

---

## 10. Tests = documentation vivante

La sortie de `pytest -v` doit se lire comme un cahier des charges fonctionnel :

```
tests/test_revision.py::test_facture_à_réviser_validée_devient_validée PASSED
tests/test_revision.py::test_facture_validée_sans_montant_est_rétrogradée PASSED
tests/test_export.py::test_récapitulatif_fiscal_exclut_les_factures_à_réviser PASSED
tests/test_export.py::test_tva_déductible_selon_profil_fiscal[SASU-0.2-True] PASSED
tests/test_export.py::test_tva_déductible_selon_profil_fiscal[auto-entrepreneur-0.2-False] PASSED
```

Un nouveau contributeur lit la liste des tests et comprend les règles du métier **avant** d'ouvrir le code.

---

## Checklist avant de merger

- [ ] Chaque nouvelle règle métier a un test BDD nommé dans le langage du domaine
- [ ] Chaque test suit Given / When / Then visible
- [ ] Aucun test ne mocke une fonction interne du même module
- [ ] Aucun test ne dépend de l'ordre d'exécution d'un autre
- [ ] Renommer une fonction privée ne casse aucun test BDD
- [ ] La sortie `pytest -v` se lit comme une spec en français
