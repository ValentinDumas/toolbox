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
```

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
- Section "Fichiers non traités" si des erreurs sont survenues

---

## Comportement

| Situation | Comportement |
|---|---|
| Nom de fichier reconnu | Extraction depuis le nom — rapide, sans lire le PDF |
| Nom non reconnu | Fallback lecture PDF pour extraire date et montant |
| PDF illisible | Signalé dans le bilan, non comptabilisé |
| Même commande re-téléchargée | Déduplication par référence — seul un exemplaire comptabilisé |
| Trajets sur plusieurs années | Un fichier bilan par année |
| Dossier vide | Message "Rien à traiter", pas de fichier généré |
