# Spec — Décommissionnement de la migration legacy `profiles.json`

## Context

Le 2026-05-13 (commit `095ae8d`), `data/profiles.json` a été remplacé par
une lecture 100 % SQLite : la liste des profils est dérivée du scan de
`data/profiles/*/`, les métadonnées `nom` et `created_at` vivent dans la
table `user_profile` de chaque DB de profil. Une migration idempotente
`migrate_legacy_profiles_json()` a été ajoutée pour reporter le contenu
du JSON dans les DB et renommer le fichier en `.bak`.

Cette migration a déjà tourné sur le seul environnement concerné (poste
de l'utilisateur), avec succès :
- `data/profiles.json` a été renommé en
  `data/profiles.json.migrated-20260513083324.bak` ;
- `user_profile.{nom, created_at}` du profil `craft-agents-ei` portent
  désormais les bonnes valeurs.

Le code de migration et son fichier `.bak` sont donc devenus du **code
mort** : ils n'ont plus de cas d'usage présent ou futur (single-user,
single-machine, déjà migré). Ce spec décrit leur suppression propre.

## Goal

Retirer le code de migration `profiles.json → SQLite`, son fichier
`.bak` résiduel, et sa documentation associée, sans dégrader le
comportement courant (`load_profiles()` scan filesystem, déjà la source
de vérité).

YAGNI : pas d'infrastructure générique d'expiration de migrations. La
roadmap AE (versement libératoire, ACRE, URSSAF, CFE) n'a que des
ajouts de colonnes additifs ; le pattern actuel `_run_migrations`
suffit. Si un futur cas concret réapparaît, le mécanisme générique
sera conçu à ce moment-là avec un vrai besoin pour le guider.

## Scope — éléments supprimés

| Élément | Localisation | LOC |
|---|---|---|
| Fichier `.bak` résiduel | `data/profiles.json.migrated-20260513083324.bak` | — |
| Fonction `migrate_legacy_profiles_json()` | `profiles.py` | -56 |
| Constante `LEGACY_REGISTRY` + références internes (4) | `profiles.py` | -5 |
| Import + appel au boot + bloc d'affichage du log | `dashboard.py:18, 33-36` | -6 |
| Tests de la migration legacy (5 BDD) | `tests/test_migrate_profiles_json.py` (fichier entier) | -160 |
| Mention dans la description du wizard | `README.md` (paragraphe « Wizard de configuration ») | -1 phrase |

Total : ~225 LOC retirées, ~10 LOC modifiées (texte du README et imports
dans `profiles.py`).

## Hors-scope

- **Infra générique d'expiration de migrations** (décorateur
  `@one_shot_migration(remove_after_version=N)` + test de garde) :
  reporté tant qu'il n'y a pas d'autre cas concret. YAGNI explicite.
- **Suppression automatique du `.bak` au boot** : laissé manuel, plus
  sûr (un boot accidentel ne doit pas détruire de sauvegarde).
- **Note d'obsolescence dans `docs/superpowers/specs/2026-05-10-multi-profils-design.md`** :
  on **garde** la note historique. Le spec décrit l'archi telle qu'elle
  a été conçue à l'époque ; la note signale qu'elle a évolué. Pas de
  réécriture rétroactive.

## Comportement après suppression

- `load_profiles()` continue de scanner `data/profiles/*/` et de lire
  `user_profile.{nom, created_at}` de chaque DB. Aucun changement.
- Le boot du dashboard perd la ligne de log
  `[migration] data/profiles.json → user_profile pour N profil(s) ...`.
  Les autres migrations (`maybe_migrate_legacy()` pour la DB
  mono-profil legacy) restent en place.
- Si un environnement fictif contenait encore un `data/profiles.json`
  jamais migré, le fichier serait simplement ignoré (la liste de
  profils reflète déjà le filesystem). Aucune erreur, pas d'avertissement.
  Acceptable : ce cas n'existe pas dans la réalité (single-user, déjà
  migré et vérifié).

## Vérifications

1. **Tests** : `python3 -m pytest tests/` → 460 tests verts (465 -
   les 5 tests de migration supprimés).
2. **Boot dashboard** :
   - `python3 dashboard.py` se lance sans erreur.
   - Aucun message « migration » lié à `profiles.json` n'apparaît dans
     les logs.
3. **Recréation de profil** :
   - Créer un nouveau profil via le wizard.
   - Vérifier que `data/profiles.json` n'apparaît jamais dans
     `data/` (aucune écriture).
4. **Grep de garde** :
   ```bash
   grep -r "LEGACY_REGISTRY\|migrate_legacy_profiles_json\|profiles\.json" \
     --include="*.py" --include="*.html" --include="*.md" .
   ```
   N'a plus aucun match en code Python. Seule la note historique du
   spec multi-profils peut encore matcher en `.md`, c'est OK.
5. **Filesystem** : `data/profiles.json.migrated-*.bak` retiré.

## Risques

- **Quelqu'un qui restaurerait un vieux `profiles.json` après
  suppression du code** : sans effet — `load_profiles()` ignore le
  JSON, le wizard demande la création d'un nouveau profil. Aucune
  perte de données possible (les DBs sont autoportées).
- **Pas de rollback de la suppression du `.bak`** : un `git checkout` ne
  ramène pas un fichier non versionné. Risque assumé : le fichier est
  une sauvegarde manuelle d'une migration déjà vérifiée, sans valeur.
