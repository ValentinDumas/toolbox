# draw-bilan-depenses-train

Génère un bilan Markdown des dépenses train par mois et par année, à partir des justificatifs renommés par `curate-justificatifs-achat` ou `curate-justificatifs-voyage`.

---

## Structure des dossiers

```
draw-bilan-depenses-train/
├── draw-bilan-depenses-train.py    ← script de génération
├── docs/specs/                     ← spécifications internes
├── docs/tests/                     ← plan de tests métier
├── tests/                          ← tests automatisés
└── README.md                       ← ce fichier
```

---

## Prérequis

```bash
pip3 install pdfplumber
```

> `pdfplumber` est optionnel — utilisé uniquement en fallback si un fichier n'est pas au format attendu.

---

## Utilisation

```bash
# Depuis le dossier output d'un des scripts curate
python3 draw-bilan-depenses-train.py curate-justificatifs-achat/output/

# Avec un dossier de sortie distinct
python3 draw-bilan-depenses-train.py curate-justificatifs-achat/output/ ./bilans/

# Depuis le répertoire courant (IN = OUT = .)
python3 draw-bilan-depenses-train.py

# Forcer un seul type de justificatif
python3 draw-bilan-depenses-train.py ./curated/ ./bilans/ --source achat
```

### `--source` — quel justificatif fait foi

Un même trajet donne souvent **deux** documents : un justificatif d'achat et un
justificatif de voyage. Leurs références appartiennent à des espaces disjoints
(`1917346212-20260504` contre `ne3erm`) : aucun identifiant commun ne permet de
les rapprocher, et comptés tous les deux ils **doublent la dépense déclarée**.
Le rapprochement se fait donc sur les valeurs — date et montant.

| Valeur | Effet |
|---|---|
| `auto` (défaut) | Les achats font foi. Un justificatif de voyage dont la date tombe dans la plage d'une commande d'achat, et dont le montant tient dans ce qu'il reste du total de cette commande, lui est **rattaché** et n'est pas recompté ; un voyage qu'aucune commande ne couvre **devient un trajet**. |
| `achat` | Seuls les `justificatif-achat-*` alimentent le bilan, les voyages sont écartés du total. |
| `voyage` | Seuls les `justificatif-voyage-*` alimentent le bilan. |
| `tous` | Les deux, sans rapprochement — à n'utiliser que si le corpus ne contient jamais les deux documents pour un même trajet. |

Le rapprochement se fait au niveau de la **commande**, pas du trajet. Un
aller-retour acheté en une fois ne produit qu'un justificatif d'achat, souvent un
seul trajet daté du premier jour et portant le total : ses deux justificatifs de
voyage ne correspondent alors à aucun montant de trajet. La commande est donc
traitée comme un budget — plage de dates et total — que les justificatifs de
voyage consomment.

**Quand le rapprochement est certain** : les justificatifs de voyage rattachés
épuisent exactement le total de la commande (28,50 + 28,50 sur une commande à
57,00), ou chacun tombe sur un trajet de même date et même montant.

**Quand il ne l'est pas** : la commande n'est que partiellement couverte — un
seul justificatif de voyage récupéré sur deux, ou un montant qui ne correspond à
aucun trajet. Le total ne bouge pas, mais la ligne est listée en
`[À VÉRIFIER]` dans la console et nommément dans la section « Réconciliation »
du bilan. C'est le seul endroit où le rapprochement repose sur une supposition,
et il est signalé.

Le détail de ce qu'est devenu chaque justificatif de voyage — rattaché, rattaché
sur une commande partiellement couverte, ou compté comme trajet — figure dans
cette même section.

### Via config.json (optionnel)

Si `sncf-trip-proofs/config.json` contient des chemins non-vides pour `draw-bilan-depenses-train`, le script les utilise quand aucun argument n'est passé :

```json
{
  "draw-bilan-depenses-train": {
    "in": "/Users/alice/sncf/output-achat",
    "out": "/Users/alice/sncf/bilans"
  }
}
```

```bash
python3 draw-bilan-depenses-train.py   # lit in/out depuis config.json (0 args)
```

Priorité : arguments CLI > `config.json` > répertoire courant.
La configuration ne s'applique que lorsqu'aucun argument n'est fourni.

---

## Fichiers en entrée acceptés

Les deux types de justificatifs renommés sont supportés :

| Type | Format attendu |
|---|---|
| Achat | `justificatif-achat-date-prix-ref.pdf` |
| Voyage | `justificatif-voyage-date-prix-REF[-TCN][-N].pdf` |

Les fichiers au nom non reconnu déclenchent une tentative de lecture PDF (fallback). S'ils sont illisibles, ils apparaissent dans la section "Fichiers non traités" du bilan.

---

## Fichier généré

Un fichier `bilan-depenses-train-YYYY.md` par année détectée, contenant :

- Récapitulatif global (total TTC, nombre de trajets, coût moyen)
- Total annuel
- Détail par mois
- Liste des voyages par mois avec date et montant
- Section "Réconciliation" : combien de PDF déposés, combien retenus, et pourquoi
  les autres ont été écartés (autre type, commande en double, erreur de lecture),
  puis ce qu'est devenu chaque justificatif de voyage en mode `auto`
- Section "Fichiers non traités" si des erreurs sont survenues

---

## Comportement

| Situation | Comportement |
|---|---|
| Nom de fichier reconnu | Extraction depuis le nom — rapide, sans lire le PDF |
| Nom reconnu mais d'un autre type que `--source` | Écarté du total, compté en « Réconciliation » (modes `achat` et `voyage`) |
| Justificatif de voyage rattachable à un achat | Rattaché, non recompté (mode `auto`) |
| Justificatif de voyage orphelin | Compté comme trajet — cas d'un achat jamais téléchargé (mode `auto`) |
| Justificatif multi-trajets sans prix par trajet | Montant réparti à parts égales, le reste de la division allant au premier trajet — la somme rend le montant du justificatif au centime |
| Nom non reconnu | Fallback lecture PDF pour extraire date et montant |
| PDF illisible | Signalé dans le bilan, non comptabilisé |
| Même commande re-téléchargée | Déduplication par référence — seul un exemplaire comptabilisé |
| Trajets sur plusieurs années | Un fichier bilan par année |
| Dossier vide | Message "Rien à traiter", pas de fichier généré |
