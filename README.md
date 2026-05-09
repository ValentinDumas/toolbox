# toolbox

Scripts pour automatiser les tâches répétitives.

---

## Utilitaires

### Invoice Manager — Gestion de factures

[`invoice-manager/`](invoice-manager/README.md) — pipeline offline-first d'extraction et gestion de factures pour déclarations fiscales.

| Composant | Rôle |
|---|---|
| `run.py` | Pipeline complet : dédup → extraction → révision → export |
| `dashboard.py` | Dashboard web local (`python dashboard.py` → http://localhost:7800) |
| `export.py` | Génère `ledger-YYYY.csv` et `ledger-YYYY.xlsx` |

### SNCF — Justificatifs de frais de train

[`sncf-trip-proofs/`](sncf-trip-proofs/README.md) — trois scripts pour déclarer les frais de train au réel à partir des PDFs SNCF Connect.

| Utilitaire | Rôle |
|---|---|
| `curate-justificatifs-voyage` | Organise les justificatifs de **voyage** → `JustificatifVoyage_DATE_PRIX_REF.pdf` |
| `curate-justificatifs-achat` | Organise les justificatifs d'**achat** → `justificatif_achat_DATE_PRIX_REF.pdf` |
| `draw-bilan-depenses-train` | Génère un bilan `.md` par année (totaux par mois) |
