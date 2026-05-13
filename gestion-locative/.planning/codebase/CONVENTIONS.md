# CONVENTIONS — Planning state

> **État** : conventions définies dans les docs opposables, **non encore reflétées dans du code**.
> Sources : [SOFTWARE_CRAFTSMANSHIP.md](../../SOFTWARE_CRAFTSMANSHIP.md), [DDD.md](../../DDD.md), [BDD_PRACTICES.md](../../BDD_PRACTICES.md).

## Code

- **SOLID** strict ([SOFTWARE_CRAFTSMANSHIP.md §2.1](../../SOFTWARE_CRAFTSMANSHIP.md)).
- **Clean Code** : fonctions < 20 lignes en moyenne, un seul niveau d'abstraction par fonction.
- **KISS / DRY / YAGNI** appliqués sans exception.
- **Complexité cyclomatique** < 10 par fonction.
- **Pas de magic numbers** : constantes nommées (ex. `SEUIL_MICRO_BIC_LONGUE_DUREE = 83_600`).
- **Commentaires** : expliquent **pourquoi**, jamais **quoi**.

## Ubiquitous Language ([DDD.md §2](../../DDD.md))

Identifiants en **français**, fidèles au vocabulaire métier.

| Concept | Identifiant | À NE PAS utiliser |
|---|---|---|
| Bail | `Bail` | `Lease`, `Contract` |
| Quittance | `Quittance` | `Receipt`, `Invoice` |
| Locataire | `Locataire` | `Tenant` |
| Bailleur | `Bailleur` | `Landlord` |
| État des lieux | `EtatDesLieux` / `EDL` | `MoveInReport` |
| Préavis | `Preavis` | `Notice` |
| IRL · ARD · CFE · BIC | conserver tel quel | (ne pas traduire) |

**Règle** : avant de nommer une variable, vérifier que le terme est dans les docs métier ([LMNP.md](../../LMNP.md), [LOCATION_MEUBLEE_REGLES.md](../../LOCATION_MEUBLEE_REGLES.md)).

## Commits

Format **Conventional Commits** en français :

```
feat(quittance): génération PDF avec forfait de charges
fix(amortissement): corrige prorata temporis au mois de mise en service
test(plus-value): cas réintégration résidence services exclue
docs(lmnp): seuils micro-BIC 2026
chore(deps): mise à jour pytest
refactor(bail): extrait CalculPreavis dans le domaine
```

## Documentation

- Docs commitées **dans la même PR** que le code qui change le comportement.
- Pas de doc reportée à un sprint « doc ».
- En-tête daté pour les docs métier (`> État du droit au YYYY-MM-DD`).

## Fichiers et dossiers

- **kebab-case**, sans accents, sans espaces.
- Dates ISO 8601 (`AAAA-MM-JJ`).
- Underscores réservés au code.

## Anti-patterns proscrits

### Côté domaine ([DDD.md §9](../../DDD.md))

- Anemic Domain Model (entités sans comportement).
- Big Ball of Mud (un seul contexte fourre-tout).
- Leaky Abstraction (ORM dans le domaine).
- Primitives obsession (`int` au lieu d'un VO).
- Repository sur objets non agrégats.

### Côté implémentation ([SOFTWARE_CRAFTSMANSHIP.md §7](../../SOFTWARE_CRAFTSMANSHIP.md))

- God Object.
- Sur-ingénierie.
- Optimisation prématurée.
- Mocks abusifs.
- Couverture vide (100 % de lignes sans assertions sur le comportement).
- `else` redondants après `return` / `raise`.
- Try/catch fourre-tout.

### Côté tests ([BDD_PRACTICES.md §12](../../BDD_PRACTICES.md))

- Tests qui répliquent l'implémentation.
- Mocks en cascade.
- Setup massif > 30 lignes sans factory.
- Assertions vagues.
- Tests nommés d'après un ticket plutôt qu'un comportement.
- Mock d'un objet du domaine.

## Gates CI bloquants ([SOFTWARE_CRAFTSMANSHIP.md §8](../../SOFTWARE_CRAFTSMANSHIP.md))

| Mesure | Seuil |
|---|---|
| Warnings lint | **0** |
| Couverture globale | ≥ **80 %** |
| Couverture logique fiscale | **100 %** |
| Complexité cyclomatique | < **10** |
| Durée suite unitaire | < **30 s** |
| Tests flaky | **0** |
