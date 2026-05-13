"""
migrations/ — Runner de migrations fichier-par-version (cf. #146).

À utiliser pour toute évolution de schéma au-delà de la version inline portée
par `db.py:_run_migrations`. Le runner lit les fichiers `NNNN_*.sql` du
dossier, les applique en transaction si leur numéro de version est > au
`PRAGMA user_version` courant, et bumpe la version.

**Convention de nommage :** `NNNN_courte_description.sql` où NNNN est entier
zero-padded ≥ `db.SCHEMA_VERSION + 1`. La première migration au format
fichier sera donc `0011_*.sql` (version 10 étant l'état initial inline).

**Pas de descente** : les migrations sont append-only. Une migration buggée
se corrige par une migration suivante, pas par un rollback.
"""
