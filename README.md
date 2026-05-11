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

### Agent Fleet — Flotte d'agents autonomes

[`agent-fleet/`](agent-fleet/CLAUDE.md) — flotte d'agents Claude pilotée par GitHub Issues. Analyse le code, crée des issues, ouvre des PRs et fusionne automatiquement les corrections à faible risque.

| Étape | Commande | Rôle |
|---|---|---|
| Inspection | `python run.py inspect code` | Analyse le dépôt cible, crée des issues `agent:code` |
| Dispatch | `python run.py dispatch --once` | Un agent par issue → PR ouvert avec tests verts |
| Review | `python run.py review` | Adresse les commentaires, fusionne les PRs `risk=low` |

Flux complet : `inspect code` → `dispatch` → `review` → répéter.

### SNCF — Justificatifs de frais de train

[`sncf-trip-proofs/`](sncf-trip-proofs/README.md) — trois scripts pour déclarer les frais de train au réel à partir des PDFs SNCF Connect.

| Utilitaire | Rôle |
|---|---|
| `curate-justificatifs-voyage` | Organise les justificatifs de **voyage** → `JustificatifVoyage_DATE_PRIX_REF.pdf` |
| `curate-justificatifs-achat` | Organise les justificatifs d'**achat** → `justificatif_achat_DATE_PRIX_REF.pdf` |
| `draw-bilan-depenses-train` | Génère un bilan `.md` par année (totaux par mois) |
