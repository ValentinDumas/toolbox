# migrations/

Dossier des migrations DB versionnées (cf. ticket #146).

## Convention

`NNNN_courte_description.sql` où :
- `NNNN` est un entier zero-padded ≥ `db.SCHEMA_VERSION + 1`. Aujourd'hui la
  version inline est **10**, donc la première migration au format fichier
  s'appellera `0011_*.sql`.
- `courte_description` est un slug en `snake_case` (lettres, chiffres,
  underscores).

## Comment ajouter une migration

1. Crée `migrations/00NN_ma_modification.sql` avec un ou plusieurs statements
   SQL séparés par `;`.
2. Le runner (`migrations/runner.py`) l'appliquera automatiquement au
   prochain boot du dashboard ou exécution CLI (via `db.open_db`).
3. Chaque migration tourne dans **sa propre transaction** — un échec annule
   tous les statements de la migration et laisse `PRAGMA user_version`
   inchangé. Tu peux corriger le fichier et relancer.

## Règles

- **Append-only.** Une migration buggée se corrige par une migration suivante,
  jamais par un rollback ou une édition rétroactive.
- **Idempotence souhaitable.** Préfère `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `INSERT OR IGNORE` pour qu'une re-application
  accidentelle ne casse rien.
- **Numéros uniques.** Deux fichiers au même `NNNN` font crasher le runner.
