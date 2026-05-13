# CONCERNS — Planning state

> **État** : aucun code, donc **aucun code smell** à reporter.
> Cette doc liste les **risques structurels anticipés**, dérivés de [RISKS.md](../../RISKS.md).
>
> Source canonique pour le suivi détaillé : [RISKS.md](../../RISKS.md). Ce fichier est une synthèse pour le mapping de codebase.

## Top 5 prioritaires à intégrer V1

1. **R3.1** — Backup planifié + export complet (DB SQLite = SPOF).
2. **R1.2** — Tableau d'amortissement historisé (sinon pas d'anticipation PV depuis LF 2025).
3. **R2.1** — Alertes d'échéance (diagnostics, IRL, CFE, seuils micro/réel et LMNP/LMP).
4. **R1.3** — Snapshot annuel immuable post-déclaration (reproductibilité audit).
5. **R5.1** — Maintenance des règles fiscales (versioning + golden tests + revue annuelle).

## Risques structurels par catégorie

### Fiscal (le plus critique)

| ID | Risque | Cible |
|---|---|---|
| R1.1 | Veille législative annuelle (PLF) | Continu + V1 (architecture versioning) |
| R1.2 | Anticipation plus-value — historique amortissements | V1 + V1.1 (simulateur) |
| R1.3 | Reproductibilité audit — snapshot immuable | V1 |
| R1.4 | Distinction entretien / amélioration / immobilisation | V1.1 (assistant) |
| R1.5 | Validation pré-export (sanity checks) | V1 |
| R1.6 | Bascule LMNP ↔ LMP | V1 (alerte) + V1.1 (simulation) |
| R1.7 | Bascule micro ↔ réel | V1.1 (simulateur) |

### Juridique locatif

| ID | Risque | Cible |
|---|---|---|
| R2.1 | Alertes d'échéance critiques | V1 |
| R2.2 | Calendrier passoires énergétiques (G 2025, F 2028, E 2034) | V1 |
| R2.3 | Cas non standards (indivision, démembrement, colocation) | V2 |
| R2.4 | Encadrement zones tendues | V1 manuel · V1.1 INSEE |

### Technique (local-first)

| ID | Risque | Cible |
|---|---|---|
| R3.1 | Backup / restauration | V1 |
| R3.2 | Migrations de schéma SQLite | V1 |
| R3.3 | RGPD locataires | V1 + V1.1 (politique formalisée) |
| R3.4 | Chiffrement DB au repos | V1.1 |
| R3.5 | OCR + correction humaine | V1 |
| R3.6 | Quittance — numérotation, intégrité, conservation | V1 |

### UX / produit

| ID | Risque | Cible |
|---|---|---|
| R4.1 | Onboarding avec historique existant | V1.1 |
| R4.2 | Aide à la décision (simulateurs) | V1.1 |
| R4.3 | Pédagogie fiscale contextuelle | V1 |
| R4.4 | Export expert-comptable (EDI-TDFC) | V1 CSV · V2 EDI |

### Maintien dans le temps

| ID | Risque | Cible |
|---|---|---|
| R5.1 | Maintenance docs métier + règles fiscales | Continu |
| R5.2 | Tests de régression fiscale (golden tests) | V1 |
| R5.3 | Confiance utilisateur (disclaimers, traçabilité) | V1 |

## Périmètre étendu sciemment reporté

Cf. [LOGICIEL_GESTION_LOCATIVE.md §10](../../LOGICIEL_GESTION_LOCATIVE.md) — buckets V1.1 et V2 actés.

## Notes

- Aucun smell de code (il n'y a pas de code).
- Aucune dette technique (il n'y a pas de code).
- Le principal risque actuel est de **commencer à coder sans avoir verrouillé l'architecture** des règles fiscales versionnées et de l'historique d'amortissement — deux décisions qui sont structurantes et coûteuses à reprendre plus tard.
