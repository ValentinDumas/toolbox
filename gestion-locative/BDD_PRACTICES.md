# BDD — Pratiques de test

> **Testing = top priority.** Pas de code métier sans test. Pas de merge sur test rouge.
> Ce document est **opposable** : les seuils et règles ci-dessous sont des gates CI bloquants.

## 1. Pourquoi BDD

- **Aligner code et métier** via le même langage (cf. [DDD.md](DDD.md) §2).
- **Tests = documentation vivante** : les scénarios racontent ce que fait le système.
- **Spécifier avant d'implémenter** — moins d'allers-retours, moins de re-conception en cours.
- **Lever les ambiguïtés** par l'exemple : un cas concret tranche plus vite qu'un débat sémantique.
- **Capturer la fiscalité 2026** : chaque seuil et exception du droit ([LMNP.md](LMNP.md), [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md)) a son scénario.

## 2. Format Given / When / Then

Toute spécification métier est exprimée en :

```
Given <contexte initial>
When  <action exécutée>
Then  <résultat attendu>
```

Exemple **Gherkin** (à transposer dans la stack retenue) :

```gherkin
Feature: Émission de quittance après encaissement

  Scenario: Quittance émise pour un encaissement complet avec forfait de charges
    Given un bail actif avec un loyer de 800 € HC et un forfait de charges de 50 €
    And l'échéance de loyer du 5 octobre 2026 est due
    When le bailleur enregistre un encaissement de 850 € le 4 octobre 2026
    Then une quittance datée d'octobre 2026 est générée
    And la quittance détaille 800 € de loyer et 50 € de charges
    And l'événement QuittanceEmise est publié

  Scenario: Pas de quittance si l'encaissement est partiel
    Given un bail actif avec un loyer de 800 € HC et un forfait de charges de 50 €
    And l'échéance de loyer du 5 octobre 2026 est due
    When le bailleur enregistre un encaissement de 500 € le 4 octobre 2026
    Then aucune quittance n'est générée
    And l'échéance reste due pour un solde de 350 €
```

## 3. Pyramide de tests

```
          /\
         /  \    E2E (≈ 5 %)
        /----\
       /      \   Intégration (≈ 15 %)
      /--------\
     /          \  Unitaires (≈ 80 %)
    /____________\
```

| Niveau | Cible | Vitesse | Exemples |
|---|---|---|---|
| **Unitaire** | Une méthode d'agrégat ou un VO | < 10 ms | Calcul d'amortissement, comparaison de `Money`, préavis selon type de bail |
| **Intégration** | Plusieurs composants (repo + agrégat + DB en mémoire) | < 1 s | `BailRepository` sur SQLite mémoire, génération PDF de quittance |
| **End-to-end** | Scénario complet (UI ou CLI → DB) | < 30 s | Création bail → émission quittance → relance |

## 4. Règles d'or

1. **Un test = un comportement** (peut comporter plusieurs `assert` techniques pour vérifier ce comportement).
2. **Nommer le test par le comportement**, pas par la méthode :
   - OK : `test_quittance_inclut_loyer_et_charges_si_forfait_present`
   - KO : `test_emit_receipt`
3. **AAA — Arrange / Act / Assert.** Une ligne blanche entre chaque section.
4. **Pas de logique dans les tests** : ni `if`, ni `for`. Utiliser la **paramétrisation**.
5. **Fixtures explicites** : un objet utilisé dans l'assertion doit être visible dans le corps du test, ou nommé sans ambiguïté.
6. **Pas de mocks pour le domaine.** On instancie réellement `Bail`, `Bien`, `Quittance`. Seuls les **ports** (DB, mail, OCR, horloge, INSEE) sont mockés.
7. **Tests déterministes** : pas de `Date.now()` ni `random()` sans seed contrôlé. Cf. §9 (`Clock` port).
8. **Tests isolés** : aucun ordre d'exécution implicite, pas d'état partagé.

## 5. Outside-in / ATDD

Cycle de développement d'une fonctionnalité :

1. **Écrire un scénario BDD** Given/When/Then qui échoue (rouge).
2. Descendre dans les **tests unitaires** des collaborateurs nécessaires (rouge → vert).
3. Remonter, faire passer le **scénario complet** (vert).
4. **Refactor** sous filet de sécurité.

> Règle : pas de code métier écrit avant qu'un test rouge ne l'exige.

## 6. TDD à l'intérieur

Cycle red-green-refactor classique :

- **Red** — écrire le test minimal qui échoue pour la bonne raison.
- **Green** — écrire le code minimal qui fait passer le test (la « solution la plus paresseuse »).
- **Refactor** — nettoyer sans changer le comportement, tests verts en permanence.

## 7. Couverture obligatoire par type de logique

| Type | Seuil | Détail |
|---|---|---|
| **Calculs fiscaux** (amortissement, micro-BIC, plus-value, IRL) | **100 %** | Chaque exception du droit a un test dédié. Exemple : la plus-value LMNP a un scénario « résidence senior exclue de la réintégration ». |
| **Génération de documents** (quittances, avis d'échéance, lettres de relance) | **100 %** du gabarit + cas limites | Forfait vs provisions, mois partiel, indemnité d'occupation. |
| **Logique de bail** (préavis, IRL, renouvellement, refus mobilier) | **100 %** | Cf. [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md). |
| **Adapters** (DB, OCR, mail, banque) | tests d'**intégration** | Pas de couverture unitaire abusive. Vérifier la conformité au port. |
| **UI** | **E2E** des parcours critiques | Création bail, génération quittance, relance, export fiscal. |

## 8. Cas de test obligatoires (LMNP / locatif)

À couvrir **explicitement** par des scénarios BDD. Liste non exhaustive mais **incompressible** :

### Quittances et encaissements

- [ ] Quittance avec forfait de charges (un seul montant cumulé).
- [ ] Quittance avec provisions sur charges (loyer + provisions distincts).
- [ ] Quittance avec régularisation annuelle de charges.
- [ ] Pas de quittance sur encaissement partiel.
- [ ] Quittance prorata pour un mois d'entrée incomplet.

### Bail

- [ ] Préavis locataire : **1 mois** quel que soit le type (classique / étudiant / mobilité).
- [ ] Préavis bailleur : **3 mois** sur bail classique, **interdit / non requis** sur bail étudiant (non reconductible).
- [ ] Bail mobilité : durée **1 à 10 mois fermes**, dépôt de garantie **interdit**.
- [ ] Refus de bail si **mobilier incomplet** au sens du décret 2015-981.
- [ ] Restitution du dépôt : **1 mois** si EDL conforme, **2 mois** sinon, pénalité **10 %** par mois de retard.
- [ ] Encadrement du loyer en zone tendue (loyer de référence ± 20 % / -30 %).

### Indexation

- [ ] Application **IRL** annuelle à la date prévue au bail.
- [ ] **Gel du loyer** si DPE **F** ou **G** (loi Climat).
- [ ] Interdiction de relocation DPE G à partir de 2025.

### Fiscalité

- [ ] Bascule **micro-BIC ↔ réel** selon les seuils 2026 :
  - longue durée / tourisme classé : **83 600 €** / abattement **50 %**,
  - tourisme **non classé** : **15 000 €** / abattement **30 %**.
- [ ] Abattement minimum **305 €**.
- [ ] Distinction LMNP / LMP selon `recettes > 23 000 €` **ET** `recettes > revenus d'activité du foyer`.

### Amortissements

- [ ] Amortissement linéaire **prorata temporis** depuis la mise en service.
- [ ] Amortissement **par composant** (gros œuvre, toiture, installations, agencements, mobilier).
- [ ] **Terrain non amortissable** — exclusion du calcul.
- [ ] **ARD** reportable indéfiniment.

### Plus-value

- [ ] Réintégration des amortissements gros œuvre **depuis le 15/02/2025**.
- [ ] **Pas** de réintégration pour cession **avant** le 15/02/2025.
- [ ] **Pas** de réintégration pour résidence **étudiante**, **senior**, **EHPAD**.
- [ ] **Pas** de réintégration sur **transmission à titre gratuit** (donation, succession).
- [ ] **Pas** de réintégration sur l'amortissement du **mobilier**.
- [ ] Abattements pour durée de détention : exonération IR **22 ans**, PS **30 ans**.

### Relances

- [ ] Relance amiable J+5 après échéance impayée.
- [ ] Mise en demeure J+30 après première relance.
- [ ] Pas de relance si encaissement reçu entre temps.

## 9. Données de test

- **Builders / factories** : `un_bail_actif()`, `une_quittance_payee(montant=...)`. Pas de répétition d'arguments dans chaque test.
- **Fixtures réalistes** : loyers entre 600 € et 1 200 €, surfaces 20-80 m². Pas de valeurs absurdes type 1 234,56.
- **Dates explicites** : éviter `today()`. Injecter un **port `Clock`** :

```
interface Clock:
    def maintenant(self) -> Datetime

class ClockFige(Clock):
    def __init__(self, instant: Datetime):
        self._instant = instant
    def maintenant(self) -> Datetime:
        return self._instant
```

- **Property-based testing** sur les calculs : pour chaque montant positif, `quittance.total == loyer_hc + charges`. Utiliser `hypothesis` / `fast-check` selon la stack.

## 10. Hygiène

- **Suite unitaire** : ≤ **30 s**.
- **Suite complète** : ≤ **2 min**.
- **CI bloquante** : merge interdit sur test rouge ou couverture en dessous des seuils (cf. [SOFTWARE_CRAFTSMANSHIP.md](SOFTWARE_CRAFTSMANSHIP.md) §8).
- **Tests flaky** : **zéro toléré**. Un test intermittent = bug à corriger immédiatement, pas un `retry`.
- **Pas de `skip` / `xfail`** sans ticket associé **et** date butoir de levée.
- **Snapshot testing** : autorisé pour le **rendu PDF** des quittances, en complément (pas en remplacement) des assertions sur les valeurs métier.

## 11. Outils proposés

À choisir après décision de stack :

### Python

- `pytest` — runner.
- `pytest-bdd` — scénarios Gherkin.
- `hypothesis` — property-based.
- `coverage.py` — couverture.
- `playwright` (Python) — E2E.

### TypeScript / Node

- `vitest` ou `jest` — runner.
- `@cucumber/cucumber` ou `vitest-cucumber` — Gherkin.
- `fast-check` — property-based.
- `playwright` — E2E.

### Rust

- `cargo test` + `rstest` — runner et paramétrisation.
- `cucumber-rs` — Gherkin.
- `proptest` — property-based.

## 12. Anti-patterns

- **Tests qui répliquent l'implémentation** — changer le code change le test à l'identique. Tester le **comportement**, pas la mécanique.
- **Mocks en cascade** (`mock.mock.mock`) — signal d'un design couplé. Refactorer le code, pas le test.
- **Setup massif** > 30 lignes — utiliser des factories.
- **Assertions vagues** : `assert result`. Préciser : `assert result == Quittance.de(800)`.
- **Tests nommés d'après un ticket** ou un commit (`test_fix_123`) au lieu d'un comportement.
- **Désactiver un test** au lieu de comprendre pourquoi il échoue.
- **Mock d'un objet du domaine** : `mock(Bail)`. Instancier un vrai `Bail` avec une factory.

## 13. Références

- *Specification by Example* — Gojko Adzic.
- *Growing Object-Oriented Software, Guided by Tests* — Steve Freeman & Nat Pryce.
- *BDD in Action* — John Ferguson Smart.
- *The Cucumber Book* — Matt Wynne & Aslak Hellesøy.
- *Test-Driven Development by Example* — Kent Beck.
