# TESTING — Planning state

> **État** : **0 test écrit, 0 framework installé**.
> Politique de test définie dans [BDD_PRACTICES.md](../../BDD_PRACTICES.md) — opposable dès le premier commit de code.

## Pyramide cible ([BDD_PRACTICES.md §3](../../BDD_PRACTICES.md))

| Niveau | Part visée | Vitesse | Outils (à choisir après stack) |
|---|---|---|---|
| Unitaire | ~ 80 % | < 10 ms | pytest · vitest · cargo test |
| Intégration | ~ 15 % | < 1 s | pytest + SQLite mémoire · équivalent |
| End-to-end | ~ 5 % | < 30 s | Playwright |
| BDD Gherkin | transverse | — | pytest-bdd · cucumber-js · cucumber-rs |
| Property-based | ciblé | — | hypothesis · fast-check · proptest |

## Couverture obligatoire ([BDD_PRACTICES.md §7](../../BDD_PRACTICES.md))

| Type de logique | Seuil |
|---|---|
| Calculs fiscaux (amortissement, micro-BIC, plus-value, IRL) | **100 %**, chaque exception du droit testée |
| Génération de documents (quittance, avis, lettres) | **100 %** du gabarit + cas limites |
| Logique de bail (préavis, IRL, refus mobilier) | **100 %** |
| Adapters | tests d'intégration, pas couverture unitaire abusive |
| UI | E2E des parcours critiques |
| **Couverture globale** | ≥ **80 %** |

## Cycle de développement ([BDD_PRACTICES.md §5](../../BDD_PRACTICES.md))

**Outside-in / ATDD** :

1. Scénario BDD **Given/When/Then** rouge.
2. TDD interne sur les collaborateurs (red → green → refactor).
3. Scénario passe au vert.
4. Refactor sous filet de sécurité.

> **Règle** : pas de code métier écrit avant qu'un test rouge ne l'exige.

## Cas obligatoires non négociables

Liste exhaustive : [BDD_PRACTICES.md §8](../../BDD_PRACTICES.md). Extraits critiques :

### Quittances et encaissements
- Quittance avec / sans forfait de charges.
- Quittance avec régularisation annuelle.
- Pas de quittance sur encaissement partiel.

### Bail
- Préavis locataire **1 mois** quel que soit le type.
- Préavis bailleur **3 mois** sur bail classique.
- Bail mobilité : dépôt **interdit**, durée 1-10 mois.
- Refus de bail si **mobilier incomplet** (décret 2015-981).
- Restitution dépôt : 1 mois si EDL conforme, 2 mois sinon, pénalité 10 %.

### Fiscalité
- Bascule **micro-BIC ↔ réel** seuils 2026 (83 600 € / 15 000 €).
- Distinction **LMNP / LMP** selon recettes 23 000 € + revenus d'activité.

### Amortissements
- Linéaire **prorata temporis**.
- Par **composant**.
- **Terrain non amortissable**.
- **ARD** reportable indéfiniment.

### Plus-value (LF 2025 art. 84)
- Réintégration amortissements gros œuvre depuis **15/02/2025**.
- **Pas** de réintégration : résidence étudiante / senior / EHPAD, transmission gratuite, mobilier.
- Exonérations durée détention : IR **22 ans**, PS **30 ans**.

## Données de test ([BDD_PRACTICES.md §9](../../BDD_PRACTICES.md))

- **Builders / factories** : `un_bail_actif()`, `une_quittance_payee()`.
- **Fixtures réalistes** : loyers 600-1200 €, surfaces 20-80 m².
- **Dates explicites** : pas de `today()`, **horloge injectable** (port `Clock`).
- **Property-based** sur les calculs fiscaux.

## Hygiène ([BDD_PRACTICES.md §10](../../BDD_PRACTICES.md))

- Suite unit ≤ **30 s**.
- Suite totale ≤ **2 min**.
- **CI bloquante** : merge interdit sur test rouge ou couverture insuffisante.
- **0 flaky** toléré.
- Pas de `skip` / `xfail` sans ticket + date butoir.

## Golden tests (régression fiscale) ([RISKS.md R5.2](../../RISKS.md))

- Cas réels figés en JSON + résultat attendu.
- Suite « legal-regression » exécutée à chaque PR + CI hebdomadaire.
- Mise à jour planifiée à chaque loi de finances.
