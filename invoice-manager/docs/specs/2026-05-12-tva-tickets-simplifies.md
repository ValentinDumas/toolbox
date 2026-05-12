# TVA — règle des tickets simplifiés (seuil 150 €)

## Contexte

Le champ `taux_tva` du formulaire d'édition de facture pouvait être laissé vide sans aucun signal utilisateur. Le placeholder `0.20` sur le formulaire d'ajout de catégories TVA (`settings.html:412`) suggérait par ailleurs un défaut implicite à 20 %. Or :

- L'article 289 du CGI et l'article 242 nonies A annexe II imposent une mention **explicite** du taux et du montant de TVA sur toute facture **TTC ≥ 150 €** pour ouvrir droit à déduction.
- `services/montants.complete_amounts` n'a **jamais** assumé 20 % en silence : si HT et TVA sont absents, `taux_tva` reste `NULL` en base. L'UI laissait pourtant croire l'inverse.

Une facture validée à TTC ≥ 150 € sans taux est donc fiscalement suspecte : la TVA n'est pas déductible, et l'utilisateur doit pouvoir trancher (réclamer une facture conforme au fournisseur, ou accepter la non-déduction).

## Changement

### 1. Constante

```python
# constants.py
SEUIL_TVA_SIMPLIFIEE_EUR = 150.0
```

Cite l'article 242 nonies A ann. II CGI dans le commentaire d'accompagnement.

### 2. Règle métier — démotion automatique

`services/revision.py::_check_taux_manquant_si_grand_montant(fields, current, profil_fiscal) -> str | None`

- Court-circuite si `FISCAL_RULES[profil_fiscal]["tva_déductible"]` est `False` (profils `auto-entrepreneur`, `salarié`).
- Retourne `None` si TTC < `SEUIL_TVA_SIMPLIFIEE_EUR` (ticket simplifié — mention TVA optionnelle).
- Retourne `None` si `taux_tva` est renseigné après `_complete_montants`.
- Sinon, retourne un warning citant le seuil : *« TTC ≥ 150 € sans taux TVA — TVA non déductible sans mention explicite, item retourné en « À réviser ». »*

Branchement dans `blueprints/factures.py::facture_save` :

```python
profil_fiscal = (get_profile() or {}).get("fiscal_profile")
taux_warning = _check_taux_manquant_si_grand_montant(fields, current, profil_fiscal)
warning = mismatch_warning or confidence_warning or taux_warning
fields = _build_corrections_log(fields, current, now, warning)
```

La démotion en `à_réviser` est gérée par le mécanisme existant `_build_corrections_log` (lignes 185-186) — pas de nouvelle branche de transition, pas de duplication.

### 3. UI — mention honnête + masquage par profil

`templates/dashboard.html` — deux emplacements (ledger édité, onglet « À réviser ») :

- **Profil non auto-entrepreneur** : sous le `<select name="taux_tva">`, ajout d'un `<p class="review-hint">` lié au champ via `aria-describedby` : *« Vide : TVA non considérée comme déductible. Demandez une facture conforme pour la récupérer. »*
- **Profil `auto-entrepreneur`** : le `<select>` entier est remplacé par la mention *« TVA non applicable pour ce régime (franchise en base). »* — le champ disparaît du form (pas envoyé au serveur), ce qui réduit le bruit cognitif.

`templates/settings.html:411-413` — formulaire d'ajout de catégorie TVA :

- Suppression du `placeholder="0.20"` qui laissait croire à un défaut implicite.
- Ajout d'un `.field-hint` qui donne des exemples (0.20 / 0.10 / 0.055) sans suggérer une valeur par défaut.

CSS `.review-hint` ajouté (`dashboard.html:460-466`) : `font-size: 11px`, `color: var(--on-surface-muted)`, contraste WCAG AA conservé.

### 4. Tests BDD

`tests/test_dashboard.py` — 5 nouveaux tests (français, Given/When/Then) :

- `test_facture_sasu_au_dessus_150_sans_taux_génère_un_warning`
- `test_facture_sasu_en_dessous_150_sans_taux_reste_sans_warning`
- `test_facture_auto_entrepreneur_au_dessus_150_sans_taux_reste_sans_warning`
- `test_facture_sasu_au_dessus_150_avec_taux_renseigné_ne_génère_pas_de_warning`
- `test_warning_démotion_taux_manquant_est_loggué_dans_corrections_log`

Plus un test d'intégration HTTP `test_post_review_save_facture_validée_sasu_au_dessus_150_sans_taux_est_rétrogradée` qui inverse le profil de test à `SASU`, sauvegarde une facture à 200 € TTC sans taux, et vérifie la démotion + le warning citant le seuil.

## Hors scope

- Modification d'`export.py` pour filtrer les factures sans taux : la démotion en `à_réviser` les exclut déjà du livre-journal et du récapitulatif fiscal.
- Distinction franchise vs réel à l'intérieur du profil `auto-entrepreneur` : non modélisée dans `FISCAL_RULES`, et la franchise en base reste le cas par défaut codifié.
- Cas particulier des notes de restaurant / hôtel < 150 € (règle simplifiée admettant un taux par défaut) : nécessite un signal sur le type de document, hors périmètre de ce changement.
- Réécriture du `placeholder` dans d'autres formulaires : seul `settings.html:412` portait un défaut trompeur.

## Vérification

```bash
python3 -m pytest tests/test_dashboard.py -k "taux or 150 or auto_entrepreneur" -v
python3 -m pytest tests/  # non-régression complète (350 tests)
```

Smoke test UI :

```bash
python3 dashboard.py
```

- Profil **SASU** : éditer une facture validée à 200 € TTC, laisser taux vide, sauvegarder → la ligne repasse en « à réviser » + bandeau warning citant le seuil de 150 €.
- Profil **auto-entrepreneur** : le champ taux est remplacé par la mention de non-applicabilité ; une facture à 500 € TTC sans taux reste validée.
- Onglet **Paramètres → Catégories TVA** : plus de placeholder `0.20` trompeur, hint avec exemples explicites à la place.
