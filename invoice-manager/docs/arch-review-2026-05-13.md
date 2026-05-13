# Revue d'architecture — Pérennité (2026-05-13)

> Audit déclenché par le ticket #141. Objectif : évaluer si Flask + SQLite +
> DDD tiennent la trajectoire AE-first (cf. VISION.md) sur les 5 prochaines
> années, et identifier 3 à 5 chantiers à fort levier coût/valeur.

---

## 1. Périmètre actuel

- **Code source :** ~13 000 lignes Python + Jinja, 458 tests pytest verts.
- **Couches :** pipeline CLI (`run.py`, `extract.py`, `export.py`), application
  Flask (`app.py` + 7 blueprints), domaine partagé (`db.py`, `queries.py`,
  `services/`), templates Jinja.
- **Données :** SQLite par profil sous `data/profiles/<slug>/invoices.db`.
  Aujourd'hui 1 profil en usage réel (`craft-agents-ei`).
- **Modules domaine :** revision, montants, comptabilite, urssaf,
  urssaf_export, seuils, cfe, facturation_emise — tous purs (pas de Flask),
  testables en isolation.

## 2. Scalabilité données

### Constat
- SQLite est largement suffisant pour un usage mono-utilisateur, mono-machine.
  Un AE typique : ~50–500 factures émises + 200–2 000 reçues/an. Sur 10 ans
  (rétention L123-22) → ~25 000 lignes max. SQLite gère ça sans effort.
- La table `invoices` a ~45 colonnes. Les lectures sont indexées implicitement
  par `id` (PRIMARY KEY) et `hash_fichier` (UNIQUE). **Manque d'index** sur
  `exercice_fiscal`, `date_paiement`, `statut_révision`, `deleted_at` — tous
  filtrés intensivement par `queries.py`.
- Pas de stockage de blobs en DB (PDF/HEIC restent sur disque, référencés
  par `fichier_source`). Bon choix : la DB reste compacte et `cat` sur
  `invoices.db` ne déclenche pas un swap.

### Risque
- **Faible.** À 25k lignes, même sans index, SQLite répond < 50 ms.
- Le risque réel se situe sur la croissance du **dossier `processed/`** :
  10 ans × 1 500 fichiers ≈ 15 000 fichiers, 20 Go en HEIC. C'est du
  filesystem, pas de la DB — gérable.

### Recommandation
- **R-A (low effort, medium value)** : ajouter trois index composés
  (`exercice_fiscal`, `statut_révision`, `deleted_at`) et (`date_paiement`)
  pour préparer l'agenda URSSAF #133 à monter à 100 000+ lignes sans
  régression perçue. Coût : 1 migration idempotente, ~10 lignes dans `db.py`.

## 3. Modularité actuelle (DDD)

### Constat
- Séparation `blueprints/ ↔ services/ ↔ queries.py ↔ db.py` **bien respectée**
  dans les commits récents. Les services restent purs (importables sans
  Flask). Les blueprints n'importent jamais d'autres blueprints (vérifié
  par grep).
- Le module `services/urssaf.py` regroupe désormais plusieurs concepts
  (taux, périodes, déclarations, ACRE, VFL). À 213 lignes c'est encore
  lisible. À 500 lignes ce sera un fourre-tout.
- `templates/dashboard.html` à **2 000+ lignes** est le seul vrai point
  d'inquiétude — déjà identifié comme dette technique implicite (CLAUDE.md
  parle de keep files focused).

### Risque
- **Moyen** sur dashboard.html : à chaque nouvelle bannière (CFE, plafonds,
  TVA), le fichier gonfle. Les fragments existants (`templates/fragments/`)
  montrent la voie — sous-utilisés aujourd'hui.

### Recommandation
- **R-B (medium effort, high value)** : extraire les bannières (`#profile_incomplete`,
  CFE, futur plafonds CA, futur franchise TVA) en `templates/fragments/banners/*.html`
  inclus par dashboard. Découple l'ajout d'une bannière de l'édition du
  template principal. Coût : ~2 h, pas de migration DB, tests inchangés.
- **R-C (low effort, low value)** : scinder `services/urssaf.py` en sous-modules
  (`taux.py`, `periodes.py`, `declarations.py`) **uniquement** quand le fichier
  dépasse 400 lignes. Aujourd'hui non rentable.

## 4. Migrations DB

### Constat
- Système actuel : `SCHEMA_VERSION` entier + `_run_migrations()` qui exécute
  des `ALTER TABLE ADD COLUMN` idempotents (catch `duplicate column name`).
  Tests `test_db.py` vérifient l'idempotence.
- Très simple, suffisant pour les évolutions additives (ajout de colonnes).
  **Inadapté** à des migrations destructives (rename, drop, conversion de
  type non triviale).
- Aucun système de versionning par fichier (type Alembic). Le code des
  migrations est inline dans `db.py`.

### Risque
- **Faible aujourd'hui.** La trajectoire AE n'impose que des ajouts (champ
  date_paiement → réutilisé, colonnes activité/VFL/ACRE/CFE/code APE ajoutées).
- **Moyen à 18 mois** : si on doit déprécier des champs ou normaliser le
  modèle (table `corrections_log` séparée, table `clients` extraite), le
  système inline montrera ses limites.

### Recommandation
- **R-D (medium effort, medium value)** : passer à un système de migrations
  fichier-par-version (`migrations/0001_initial.sql`, `0002_date_paiement.sql`,
  …) avec un runner simple en Python. Pas besoin d'Alembic — 60 lignes de
  code suffisent. À déclencher au prochain changement non-additif (probablement
  l'extraction d'une table `clients`).

## 5. Flask et trajectoire

### Constat
- Flask en mode synchrone, serveur de développement, écoute `localhost:7800`.
- Pas d'authentification HTTP : confiance dans l'isolation locale (single-user,
  single-machine — VISION.md explicit).
- Aucune route mutante n'est protégée par CSRF — acceptable tant que l'app
  est strictement locale. Devient un risque dès qu'elle est exposée même
  sur LAN.
- Exports lourds (#134 CSV URSSAF, #140 HTML facture) restent sub-secondes
  → pas besoin d'async ou de worker.

### Risque
- **Faible** sur la trajectoire AE single-user.
- **Élevé** si la VISION évolue vers du multi-utilisateur ou de l'exposition
  réseau — mais ce n'est pas la roadmap.

### Recommandation
- **R-E (low effort, high value, défensif)** : ajouter un test e2e qui
  vérifie qu'**aucune route mutante n'accepte GET**. Garde-fou pour le jour
  où la VISION change. Coût : ~20 lignes dans `test_dashboard.py`, zéro
  impact runtime.

## 6. Tests

### Constat
- 458 tests, ratio BDD/unitaire ~50/50. Les commits AE récents ont privilégié
  le BDD (`test_date_paiement`, `test_ca_encaisse`, `test_urssaf`, `test_acre`,
  `test_seuils`, `test_cfe_banner`, `test_vfl`, `test_facturation_emise`).
- Suite complète en 2,8 s — excellent feedback loop.
- Couverture des règles `AUTO_ENTREPRENEUR_RULES.md` : §2 ✓ §3.2 ✓ §4.1 ✓
  §4.2 ✓ §4.3 ✓ §4.4 ✓ §5.2 ✓ §6 ✓ §7.2 ✓.
- **Manque** : un test e2e qui parcourt le workflow complet (créer profil
  AE → importer 3 factures → marquer encaissement → exporter récap URSSAF →
  émettre une facture → vérifier numérotation).

### Recommandation
- **R-F (medium effort, high value)** : 1 à 2 tests e2e Flask test_client
  qui couvrent le golden path AE de bout en bout. Permet de figer la
  trajectoire principale et d'attraper les régressions invisibles aux
  tests unitaires (ex. : casser le rendu dashboard sans casser un test).

## 7. Synthèse — recommandations classées

| Réf | Reco | Coût | Valeur | Priorité |
|---|---|---|---|---|
| R-E | Test « aucune route mutante n'accepte GET » | XS | M | **1** |
| R-A | Index DB sur exercice/date_paiement/statut/deleted_at | XS | M | **2** |
| R-B | Extraire bannières en fragments Jinja | S | H | **3** |
| R-F | 2 tests e2e du golden path AE | M | H | **4** |
| R-D | Migrations fichier-par-version | M | M | 5 (différée) |
| R-C | Découper services/urssaf.py | S | L | 6 (différée) |

**Conclusion :** la trajectoire actuelle est saine. Aucun chantier majeur
de refonte nécessaire. Les 3 premiers items (R-E, R-A, R-B) totalisent
~1 jour de travail et améliorent significativement la robustesse perçue
sans perturber le flux de feature AE en cours.

## 8. Tickets de suivi proposés

1. `chore(security): test e2e — aucune route mutante n'accepte GET` (R-E)
2. `perf(db): index composés sur invoices (exercice/statut/deleted)` (R-A)
3. `refactor(ui): extraire les bannières dashboard en fragments` (R-B)
4. `test(e2e): golden path AE — créer, importer, déclarer, émettre` (R-F)
5. `chore(migrations): runner fichier-par-version (différé)` (R-D)
