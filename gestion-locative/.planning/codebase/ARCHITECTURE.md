# ARCHITECTURE — Planning state

> **État** : architecture **planifiée**, non implémentée.
> Source canonique : [DDD.md](../../DDD.md).

## Style architectural

**Hexagonal (Ports & Adapters)** + **Domain-Driven Design**.

```
┌─────────────────────────────────────────┐
│  Adapters (UI, CLI, REST, DB, OCR…)     │
│  ┌───────────────────────────────────┐  │
│  │  Ports (interfaces)               │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  Domain (core)              │  │  │
│  │  │  Agrégats, VO, Services,    │  │  │
│  │  │  Domain Events              │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Règles non négociables ([DDD.md §5](../../DDD.md))

1. Le **domaine ne dépend de rien** : pas d'ORM, pas de framework, pas de HTTP, pas de fichier.
2. Les **adapters dépendent du domaine**, jamais l'inverse.
3. Les **ports** sont définis par le domaine, **implémentés** par les adapters.
4. Les imports techniques (sqlite, requests, etc.) sont **interdits** dans `domain/`.

## Bounded Contexts ([DDD.md §3](../../DDD.md))

| Contexte | Responsabilité | Concepts noyaux |
|---|---|---|
| **Patrimoine** | Biens, lots, composants amortissables, diagnostics | `Bien`, `Lot`, `Composant`, `Diagnostic` |
| **Locatif** | Locataires, baux, EDL, inventaire | `Bail`, `Locataire`, `EtatDesLieux`, `Inventaire` |
| **Encaissements** | Échéances, paiements, quittances, relances | `EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance` |
| **Comptabilité** | Plan comptable simplifié, ledger, amortissements | `EcritureComptable`, `TableauAmortissement` |
| **Fiscalité** | Agrégation recettes/charges, régime, liasse, PV | `DeclarationAnnuelle`, `RegimeFiscal`, `CalculPlusValue` |
| **Documents** | Factures, tickets, justificatifs, OCR | `Justificatif`, `Facture`, `ExtractionOCR` |

## Cohérence transactionnelle

- **1 transaction = 1 agrégat.**
- Cohérence inter-agrégats via **domain events** (eventually consistent).
- Exemple : `LoyerEncaisse` met à jour la projection tableau de bord hors transaction principale.

## Décisions architecturales clés

| Décision | Origine |
|---|---|
| Persistance **SQLite locale** | [VISION.md](../../VISION.md) |
| **Local-first**, mono-utilisateur | [VISION.md](../../VISION.md) |
| **Ledger append-only** | [VISION.md](../../VISION.md) (audit-friendly) |
| **Snapshot annuel immuable** post-déclaration | [RISKS.md R1.3](../../RISKS.md) |
| **Règles fiscales versionnées** par exercice | [RISKS.md R1.1](../../RISKS.md) |
| **Horloge injectable** (port `Clock`) | [BDD_PRACTICES.md §9](../../BDD_PRACTICES.md) |
| **Backup chiffré exportable** | [RISKS.md R3.1](../../RISKS.md) |

## ADR à formaliser après choix de stack

- Choix de la stack (langage, UI, ORM/raw, OCR).
- Stratégie de migration de schéma SQLite.
- Format de snapshot annuel (hash, signature).
- Format d'export expert-comptable.
- Format de représentation des règles fiscales versionnées (code vs DSL vs config).
