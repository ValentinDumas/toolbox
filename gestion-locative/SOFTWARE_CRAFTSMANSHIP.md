# Software Craftsmanship — Bonnes pratiques

> Document **opposable**. Ces pratiques sont des engagements de qualité, pas des suggestions.
> Cible : tout contributeur (humain ou agent) au projet.

## 1. Manifesto

Adapté du *Manifesto for Software Craftsmanship* :

- **Pas seulement du code qui marche, mais du code bien fait.**
- **Pas seulement répondre au besoin, mais ajouter de la valeur durable.**
- **Pas seulement une communauté de pratiques, mais une communauté professionnelle.**
- **Pas seulement de la productivité individuelle, mais des partenariats productifs.**

Le projet gère de la **fiscalité réelle**. Une erreur silencieuse dans un calcul d'amortissement ou de plus-value peut coûter cher à l'utilisateur final. **La fiabilité prime sur la vitesse.**

## 2. Principes fondateurs

### 2.1 SOLID

- **S — Single Responsibility Principle** : une classe, une raison de changer.
- **O — Open/Closed Principle** : ouvert à l'extension, fermé à la modification.
- **L — Liskov Substitution Principle** : un sous-type doit pouvoir remplacer son parent sans casser le contrat.
- **I — Interface Segregation Principle** : préférer plusieurs petites interfaces dédiées à une grosse.
- **D — Dependency Inversion Principle** : dépendre des abstractions, pas des implémentations.

### 2.2 Clean Code

- **Nommage explicite** : `calculer_amortissement_annuel()` plutôt que `compute()`.
- **Vocabulaire métier** : utiliser les termes des docs ([LMNP.md](LMNP.md), [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md)) — cf. [DDD.md](DDD.md).
- **Fonctions courtes** : < 20 lignes en moyenne, un seul niveau d'abstraction.
- **Pas de magic numbers** : `SEUIL_MICRO_BIC_LONGUE_DUREE = 83_600` plutôt que `83600` inline.
- **Commentaires** : expliquent **pourquoi**, pas **quoi**. Si un commentaire décrit le code, renommer le code.

### 2.3 KISS / DRY / YAGNI

- **KISS** — *Keep It Simple, Stupid*. La complexité accidentelle est un coût permanent.
- **DRY** — *Don't Repeat Yourself*. La duplication = bug futur garanti.
- **YAGNI** — *You Aren't Gonna Need It*. Pas de code pour des besoins hypothétiques.

> Règle pratique : si la fonctionnalité n'est pas dans le PRD ([LOGICIEL_GESTION_LOCATIVE.md](LOGICIEL_GESTION_LOCATIVE.md)), elle n'est pas dans le code.

## 3. Pratiques de développement

### 3.1 Workflow

- **Branches courtes** : ≤ 3 jours de vie, fusionnées rapidement.
- **Commits atomiques** : un commit = une intention claire.
- **Format de message** *Conventional Commits* :
  ```
  feat(quittance): génération PDF avec forfait de charges
  fix(amortissement): corrige prorata temporis au mois de mise en service
  test(plus-value): cas réintégration sur résidence services exclue
  docs(lmnp): seuils micro-BIC 2026
  refactor(bail): extrait CalculPreavis dans le domaine
  ```
- **Pull Requests** obligatoires en revue (ou auto-revue rigoureuse en solo).

### 3.2 Boy Scout Rule

> *Always leave the campground cleaner than you found it.*

Améliorer le code que l'on touche, **mais dans la limite de la PR en cours**. Pas de refactoring opportuniste hors scope — créer un ticket à la place.

### 3.3 Refactoring continu

- Refactoring **guidé par les tests** (cf. [BDD_PRACTICES.md](BDD_PRACTICES.md)).
- **Petits pas** : jamais plus de 5 minutes entre deux états compilables et verts.
- **Avant** d'ajouter une fonctionnalité, mettre le code en état de l'accueillir facilement (« make the change easy, then make the easy change »).

### 3.4 Pair / Mob programming

- Recommandé sur les zones critiques : **calculs fiscaux, plus-value, amortissements, génération de quittance**.
- En solo : revue différée minutieuse (relire son propre diff 24 h plus tard).

## 4. Tests

Le testing est **prioritaire et systématique**. Toutes les règles détaillées sont dans **[BDD_PRACTICES.md](BDD_PRACTICES.md)**.

Résumé non négociable :

- **100 % de couverture sur la logique métier** (calculs fiscaux, plus-value, amortissement).
- Cycle **outside-in** : scénario BDD rouge → implémentation TDD → scénario vert.
- **Pas de merge** sur test rouge ou couverture en dessous des seuils.

## 5. Code review

Checklist (auto-revue ou pair) :

- [ ] Le besoin du PRD est couvert sans extra.
- [ ] **Cas limites** explicites : montant 0, négatif, date passée, date future, valeur nulle, division par zéro.
- [ ] **Tests** existants et passants ; les exceptions métier ont leur scénario dédié.
- [ ] **Nommage** cohérent avec l'*Ubiquitous Language* (cf. [DDD.md](DDD.md)).
- [ ] **Pas de duplication** évidente — extraire si la règle apparaît trois fois.
- [ ] **Lisible** sans contexte externe (un nouveau contributeur comprend la fonction en 30 s).
- [ ] **Documentation** ([README](README.md), specs) à jour dans la **même PR**.
- [ ] **Aucun TODO** sans ticket associé et date butoir.
- [ ] **Aucun warning** lint, aucun secret commité.

## 6. Documentation

- Spec, README, docs métier mis à jour **dans la même PR** que le code qui change le comportement.
- Pas de documentation reportée à un sprint « doc ».
- Conventions de naming des fichiers : `kebab-case`, dates ISO 8601 si pertinent.
- Tout document de référence métier vit dans le dépôt (`gestion-locative/*.md`).

## 7. Anti-patterns à éviter

- **God Object** : une classe qui sait tout — signal d'un agrégat mal délimité (cf. [DDD.md](DDD.md)).
- **Sur-ingénierie** : abstractions pour des besoins non actuels.
- **Optimisation prématurée** : pas avant un profil documenté.
- **Mocks abusifs** : signal d'un couplage trop fort. Le domaine ne se mocke pas.
- **Couverture pour la couverture** : 100 % vide de sens < 80 % significatifs. Mesurer le **comportement testé**, pas la ligne touchée.
- **`else` redondant** après `return` / `raise` / `throw`.
- **Try/catch fourre-tout** qui avale les exceptions sans les remonter.
- **Commits « WIP »** non rebasés avant merge.
- **Branches longues** divergeant de `main` sur plusieurs sprints.

## 8. Mesures de qualité (gates CI bloquants)

| Mesure | Seuil |
|---|---|
| Warnings lint | **0** |
| Couverture globale | ≥ **80 %** |
| Couverture logique métier (fiscalité, bail, plus-value) | **100 %** |
| Complexité cyclomatique par fonction | < **10** |
| Durée suite unitaire | < **30 s** |
| Durée suite complète | < **2 min** |
| Tests flaky | **0** toléré |
| Dette technique non traitée | > 1 sprint = à traiter |

## 9. Définitions

- **Done** : code mergé sur `main` + tests verts + docs à jour + déployable localement sans étape manuelle non documentée.
- **Production-ready** : *Done* + logs structurés + erreurs récupérables + rollback possible (export DB avant migration, par exemple).

## 10. Références

- *Clean Code* — Robert C. Martin.
- *The Pragmatic Programmer* — Andy Hunt & Dave Thomas.
- *Refactoring* — Martin Fowler.
- *Working Effectively with Legacy Code* — Michael Feathers.
- [Software Craftsmanship Manifesto](http://manifesto.softwarecraftsmanship.org/).
