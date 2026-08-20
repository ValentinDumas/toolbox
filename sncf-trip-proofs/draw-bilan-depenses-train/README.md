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

# Compter les justificatifs de voyage plutôt que ceux d'achat
python3 draw-bilan-depenses-train.py ./curated/ ./bilans/ --source voyage
```

### `--source` — quel justificatif fait foi

Un même trajet donne souvent **deux** documents : un justificatif d'achat et un
justificatif de voyage. Leurs références appartiennent à des espaces disjoints
(`1917346212-20260504` contre `ne3erm`), donc rien ne permet de les rapprocher :
comptés tous les deux, ils **doublent la dépense déclarée**.

| Valeur | Effet |
|---|---|
| `achat` (défaut) | Seuls les `justificatif-achat-*` alimentent le bilan. C'est la source qui porte le prix et le détail des trajets. |
| `voyage` | Seuls les `justificatif-voyage-*` alimentent le bilan. |
| `tous` | Les deux — à n'utiliser que si le corpus ne contient jamais les deux documents pour un même trajet. |

Les fichiers de l'autre type ne sont pas des erreurs : ils sont comptés dans la
section « Réconciliation » du bilan et listés en console en `[AUTRE TYPE]`.

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
  les autres ont été écartés (autre type, commande en double, erreur de lecture)
- Section "Fichiers non traités" si des erreurs sont survenues

---

## Comportement

| Situation | Comportement |
|---|---|
| Nom de fichier reconnu | Extraction depuis le nom — rapide, sans lire le PDF |
| Nom reconnu mais d'un autre type que `--source` | Écarté du total, compté en « Réconciliation » |
| Justificatif multi-trajets sans prix par trajet | Montant réparti à parts égales, le reste de la division allant au premier trajet — la somme rend le montant du justificatif au centime |
| Nom non reconnu | Fallback lecture PDF pour extraire date et montant |
| PDF illisible | Signalé dans le bilan, non comptabilisé |
| Même commande re-téléchargée | Déduplication par référence — seul un exemplaire comptabilisé |
| Trajets sur plusieurs années | Un fichier bilan par année |
| Dossier vide | Message "Rien à traiter", pas de fichier généré |
