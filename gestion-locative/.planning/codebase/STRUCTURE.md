# STRUCTURE — Planning state

> **État courant** : 9 documents `.md` de planning, **0 fichier de code**.

## Arborescence actuelle

```
gestion-locative/
├── .planning/
│   └── codebase/                     # ce dossier (mapping)
│       ├── ARCHITECTURE.md
│       ├── CONCERNS.md
│       ├── CONVENTIONS.md
│       ├── INTEGRATIONS.md
│       ├── STACK.md
│       ├── STRUCTURE.md
│       └── TESTING.md
├── BDD_PRACTICES.md                  # politique de test (opposable)
├── CLAUDE.md                         # index projet
├── DDD.md                            # DDD opposable
├── LMNP.md                           # base de connaissances fiscales
├── LOCATION_MEUBLEE_REGLES.md        # base de connaissances juridiques
├── LOGICIEL_GESTION_LOCATIVE.md      # PRD
├── RISKS.md                          # registre des risques
├── SOFTWARE_CRAFTSMANSHIP.md         # discipline d'ingénierie (opposable)
└── VISION.md                         # vision produit
```

## Arborescence cible proposée

À aligner avec les bounded contexts ([ARCHITECTURE.md](ARCHITECTURE.md)) :

```
gestion-locative/
├── domain/                           # cœur pur, zéro dépendance technique
│   ├── patrimoine/
│   ├── locatif/
│   ├── encaissements/
│   ├── comptabilite/
│   ├── fiscalite/                    # règles versionnées par exercice
│   └── documents/
├── adapters/                         # implémentations des ports
│   ├── persistence/                  # SQLite + migrations
│   ├── ocr/
│   ├── bank/                         # CSV / OFX
│   ├── insee/                        # IRL + loyer de référence
│   ├── pdf/                          # quittances, avis, lettres
│   └── ui/                           # desktop / web / CLI
├── app/                              # application services (use cases)
├── tests/
│   ├── unit/                         # par bounded context
│   ├── integration/
│   ├── e2e/
│   └── features/                     # scénarios BDD Gherkin
└── docs/                             # docs métier (déplacement à étudier)
```

## Conventions de nommage ([CONVENTIONS.md](CONVENTIONS.md))

- Dossiers et fichiers : **kebab-case**, sans accents.
- Identifiants : **vocabulaire métier français** (`Bail`, `Quittance`, `IRL`, `ARD`, `CFE`).
- Dates dans les noms de fichiers : ISO 8601 (`AAAA-MM-JJ`).

## Notes

- Le découpage mono-package vs multi-package sera figé après choix de la stack.
- Les docs `.md` actuelles restent à la racine pour visibilité — déplacement vers `docs/` envisageable mais non urgent.
