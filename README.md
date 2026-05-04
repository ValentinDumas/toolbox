# toolbox

Scripts pour automatiser les tâches répétitives.

---

## Utilitaires

### SNCF — Justificatifs de frais de train

Trois scripts qui fonctionnent ensemble pour déclarer les frais de train au réel à partir des PDFs SNCF Connect.

| Utilitaire | Dossier | Rôle |
|---|---|---|
| `rename-justificatifs-voyage` | [`rename-justificatifs-voyage/`](rename-justificatifs-voyage/README.md) | Renomme les justificatifs de **voyage** SNCF Connect → `JustificatifVoyage_DATE_PRIX_REF.pdf` |
| `rename-justificatifs-achat` | [`rename-justificatifs-achat/`](rename-justificatifs-achat/README.md) | Renomme les justificatifs d'**achat** SNCF Connect → `justificatif_achat_DATE_PRIX_REF.pdf` |
| `bilan-depenses-train` | [`bilan-depenses-train/`](bilan-depenses-train/README.md) | Génère un bilan `.md` par année (totaux par mois) à partir des PDFs renommés |

**Workflow typique :**

```
PDFs bruts SNCF
    → rename-justificatifs-achat --real   # normalise les noms
    → bilan-depenses-train output/        # génère le bilan chiffré
```

**Prérequis communs :**

```bash
brew install tesseract tesseract-lang poppler
pip3 install pdfplumber pdf2image pytesseract Pillow
```
