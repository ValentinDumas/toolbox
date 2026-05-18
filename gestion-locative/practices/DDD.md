# Domain-Driven Design — Pratiques

> DDD appliqué au domaine de la gestion locative LMNP.
> Pseudo-code neutre (stack non décidée), mais les noms reflètent le métier français.

## 1. Pourquoi DDD ici

Le métier de la gestion locative LMNP est :

- **complexe** — règles fiscales superposées, exceptions, calendriers (cf. [LMNP.md](LMNP.md)) ;
- **vivant** — chaque loi de finances modifie seuils, abattements, plus-values ;
- **strict** — une erreur = redressement.

DDD permet d'**aligner le code sur le métier** plutôt que sur la technique. Les concepts du droit fiscal sont nommés tels quels dans le code, ce qui facilite la traçabilité avec les textes officiels.

## 2. Ubiquitous Language

Le code, les tests, les docs et l'UI partagent **le même vocabulaire** que les documents métier ([LMNP.md](LMNP.md), [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md)).

Aucune traduction technique « confortable » n'est tolérée.

| Concept métier | Identifiant code | À NE PAS utiliser |
|---|---|---|
| Bail | `Bail` | `Lease`, `Contract` |
| Quittance | `Quittance` | `Receipt`, `Invoice` |
| Locataire | `Locataire` | `Tenant`, `Renter` |
| Bailleur | `Bailleur` | `Landlord`, `Owner` |
| Loyer hors charges | `loyer_hc` / `loyerHorsCharges` | `rentExclTax`, `baseRent` |
| Forfait de charges | `forfait_charges` | `chargesPackage` |
| Préavis | `Preavis` | `Notice` |
| État des lieux | `EtatDesLieux` (ou `EDL`) | `MoveInReport` |
| IRL | `IRL` | `RentIndex` |
| Amortissement réputé différé | `ARD` | `DeferredDepreciation` |
| Plus-value | `PlusValue` | `CapitalGain` |
| CFE | `CFE` | `BusinessPropertyTax` |
| BIC | `BIC` | (ne pas traduire) |

> Règle : avant de nommer une variable, vérifier que le terme **apparaît dans les docs métier**. Sinon, l'ajouter au lexique ci-dessus.

## 3. Bounded Contexts

Découpage pour la V1 LMNP :

| Bounded Context | Responsabilité | Concepts noyaux |
|---|---|---|
| **Patrimoine** | Biens, lots, composants amortissables, diagnostics | `Bien`, `Lot`, `Composant`, `Diagnostic` |
| **Locatif** | Locataires, baux, états des lieux, inventaire | `Bail`, `Locataire`, `EtatDesLieux`, `Inventaire` |
| **Encaissements** | Échéances, paiements, quittances, relances | `EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance` |
| **Comptabilité** | Plan comptable simplifié, ledger, amortissements | `EcritureComptable`, `TableauAmortissement` |
| **Fiscalité** | Agrégation recettes/charges, micro-BIC vs réel, liasse 2031, plus-value | `DeclarationAnnuelle`, `RegimeFiscal`, `CalculPlusValue` |
| **Documents** | Factures, tickets, justificatifs, OCR, indexation | `Justificatif`, `Facture`, `ExtractionOCR` |

Chaque contexte a **son propre modèle**. Le concept « bien » prend une forme différente :

- dans **Patrimoine** : entité riche avec composants amortissables et diagnostics ;
- dans **Locatif** : référence légère (`BienId` + adresse) au sein du bail ;
- dans **Fiscalité** : projection agrégée (recettes annuelles, charges, amortissement cumulé).

## 4. Tactical Patterns

Pseudo-code volontairement neutre. À transposer dans la stack retenue.

### 4.1 Entité

Identité durable, état mutable dans le temps, comportement métier **dans la classe**.

```
class Bail:
    id: BailId
    locataire_id: LocataireId
    bien_id: BienId
    type: TypeBail  # CLASSIQUE | ETUDIANT | MOBILITE
    date_debut: Date
    duree_mois: int
    loyer_hc: Money
    mode_charges: ModeCharges  # FORFAIT | PROVISIONS
    montant_charges: Money
    depot_garantie: Money

    def reviser_loyer(self, irl_reference: IRL, irl_nouveau: IRL, dpe: DPE) -> None:
        if dpe in {DPE.F, DPE.G}:
            raise GelLoyerObligatoire("Gel du loyer pour DPE F/G")
        coefficient = irl_nouveau / irl_reference
        self.loyer_hc = self.loyer_hc * coefficient

    def preavis_locataire(self) -> Duree:
        return Duree.mois(1)  # quel que soit le type de bail meublé

    def preavis_bailleur(self) -> Duree:
        if self.type == TypeBail.ETUDIANT:
            raise PasDePreavisRequis("Bail étudiant non reconductible")
        return Duree.mois(3)
```

### 4.2 Value Object

Immuable, défini par ses attributs. Comparé par valeur.

```
@valueobject
class Money:
    centimes: int
    devise: str = "EUR"

    def __add__(self, other: Money) -> Money: ...
    def __mul__(self, factor: Decimal) -> Money: ...

@valueobject
class Adresse:
    rue: str
    code_postal: str
    ville: str

@valueobject
class IRL:
    trimestre: str  # "2026T1"
    valeur: Decimal
```

### 4.3 Agrégat

Cluster d'entités / VO avec **une racine** garante des invariants. Référencement vers les autres agrégats **par identifiant uniquement**.

- **Agrégat `Bail`** — racine : `Bail`. Contient `EcheancierLoyer`, `Inventaire`. Référence `LocataireId`, `BienId`.
- **Agrégat `Bien`** — racine : `Bien`. Contient `Lots[]`, `Composants[]`, `Diagnostics[]`.
- **Agrégat `Quittance`** — racine : `Quittance`. Référence `BailId`, `EcheanceLoyerId`.

> Règle : on ne traverse pas les agrégats. Une opération métier modifie **un seul** agrégat dans une transaction.

### 4.4 Repository

Persistance **par agrégat**, expose une interface collection.

```
interface BailRepository:
    def trouver_par_id(self, id: BailId) -> Bail | None
    def enregistrer(self, bail: Bail) -> None
    def lister_actifs(self) -> list[Bail]
    def lister_par_locataire(self, id: LocataireId) -> list[Bail]
```

L'implémentation (SQLite, fichier, mémoire) est un **adapter**, jamais dans le domaine.

### 4.5 Domain Service

Logique métier qui n'appartient à aucune entité.

```
class CalculPlusValueLmnp:
    """
    Applique l'article 150 VB III du CGI (LF 2025, art. 84)
    pour les cessions à partir du 15 février 2025.
    """
    def calculer(
        self,
        bien: Bien,
        cession: Cession,
        amortissements_gros_oeuvre: list[Amortissement],
        type_residence: TypeResidence,
    ) -> PlusValue:
        if cession.date < date(2025, 2, 15):
            return self._calcul_ancien_regime(bien, cession)
        if type_residence in {TypeResidence.ETUDIANTE, TypeResidence.SENIOR, TypeResidence.EHPAD}:
            return self._calcul_sans_reintegration(bien, cession)
        return self._calcul_avec_reintegration(bien, cession, amortissements_gros_oeuvre)
```

### 4.6 Domain Event

Fait métier passé, **immuable**, nommé au passé.

- `QuittanceEmise(bail_id, periode, montant, emise_le)`
- `LoyerEncaisse(bail_id, montant, encaisse_le)`
- `RetardConstate(bail_id, montant_du, retard_jours)`
- `BailResilie(bail_id, motif, prend_effet_le)`
- `CessionEnregistree(bien_id, prix, date_cession)`

Les événements alimentent les projections (tableau de bord, ledger, fiscalité) et permettent une cohérence inter-agrégats **eventually consistent**.

## 5. Architecture hexagonale (Ports & Adapters)

```
        ┌─────────────────────────────────────────┐
        │  Adapters (UI desktop, CLI, REST, DB)   │
        │  ┌───────────────────────────────────┐  │
        │  │  Ports (interfaces)               │  │
        │  │  ┌─────────────────────────────┐  │  │
        │  │  │  Domain (core)              │  │  │
        │  │  │  - Agrégats                 │  │  │
        │  │  │  - Value Objects            │  │  │
        │  │  │  - Domain Services          │  │  │
        │  │  │  - Domain Events            │  │  │
        │  │  └─────────────────────────────┘  │  │
        │  └───────────────────────────────────┘  │
        └─────────────────────────────────────────┘
```

Règles **non négociables** :

1. **Le domaine ne dépend de rien.** Pas d'ORM, pas de framework, pas de HTTP, pas de fichier.
2. **Les adapters dépendent du domaine**, jamais l'inverse.
3. **Les ports** (interfaces) sont **définis par le domaine**, **implémentés** par les adapters.
4. Les imports techniques (`sqlite3`, `requests`, etc.) sont **interdits** dans `domain/`.

## 6. Cohérence transactionnelle

- **Une transaction = un agrégat.** Toute opération métier modifie un seul agrégat dans la même transaction SQL.
- **Cohérence inter-agrégats** via **événements**.

Exemple : encaisser un loyer

1. Application service modifie l'agrégat `Encaissement` (transaction 1).
2. L'agrégat publie `LoyerEncaisse`.
3. Un *projector* met à jour la vue agrégée du tableau de bord (transaction 2, plus tard).
4. Si le loyer solde l'échéance → publication de `QuittanceEmiseAutomatiquement` qui déclenche la génération PDF.

## 7. Anti-Corruption Layer (ACL)

Aux frontières du domaine, un ACL transforme les formats externes en concepts du domaine, et inversement.

| Source externe | ACL | Vers le domaine |
|---|---|---|
| Relevé bancaire CSV / OFX | `BankStatementParser` | `list[LigneBancaire]` |
| OCR de facture | `OcrAdapter` | `ExtractionOCR` (montant, date, fournisseur) |
| Liasse fiscale 2031-SD | `Cerfa2031Mapper` | `LigneLiasse2031[]` |
| Indice INSEE IRL | `InseeIrlClient` | `IRL` |

Aucun format externe **ne pénètre** le cœur du domaine.

## 8. Modèles métier critiques

### 8.1 Tableau d'amortissement

- Par **composant** du bien (gros œuvre, toiture, installations, agencements, mobilier).
- Durées paramétrables par défaut (cf. [LMNP.md](LMNP.md) §5), surchargeables par bien.
- **Linéaire prorata temporis** depuis la date de mise en service.
- **ARD** (Amortissement Réputé Différé) reporté indéfiniment.
- **Terrain non amortissable** — séparé du bâti dès l'acquisition.

### 8.2 Calcul de plus-value

`CalculPlusValueLmnp` applique :

- **Avant 15/02/2025** : régime des plus-values des particuliers sans réintégration.
- **À partir du 15/02/2025** (CGI 150 VB III, LF 2025 art. 84) : réintégration des amortissements pratiqués sur le **gros œuvre**.
- **Exceptions** documentées et testées (résidences étudiantes / seniors / EHPAD, transmissions, mobilier exclus).

Chaque exception = un scénario BDD obligatoire (cf. [BDD_PRACTICES.md](BDD_PRACTICES.md) §8).

## 9. Anti-patterns DDD

- **Anemic Domain Model** : entités sans comportement, logique dans des « services ». → Mettre le comportement dans la classe.
- **Big Ball of Mud** : un seul agrégat fourre-tout. → Re-délimiter les contextes.
- **Leaky Abstraction** : l'ORM remonte dans le domaine (`@Entity`, annotations SQL). → Modèle de persistance distinct.
- **Repository pour tout** : repository sur des VO ou objets non agrégats. → Un repo par racine d'agrégat, pas plus.
- **Service grab-bag** : un fichier `services.py` de 2000 lignes. → Décomposer par cas d'usage.
- **Primitives obsession** : `int` pour un identifiant, `str` pour une adresse. → Toujours un VO ou un type nommé.

## 10. Références

- *Domain-Driven Design: Tackling Complexity in the Heart of Software* — Eric Evans.
- *Implementing Domain-Driven Design* — Vaughn Vernon.
- *Patterns, Principles, and Practices of Domain-Driven Design* — Scott Millett.
- *Hexagonal Architecture* — Alistair Cockburn.
- *Clean Architecture* — Robert C. Martin.
