# toolbox

Scripts pour automatiser les tâches répétitives.

---

## Utilitaires

### SNCF — Justificatifs de frais de train

[`sncf-trip-proofs/`](sncf-trip-proofs/README.md) — trois scripts pour déclarer les frais de train au réel à partir des PDFs SNCF Connect.

| Utilitaire | Rôle |
|---|---|
| `curate-justificatifs-voyage` | Organise les justificatifs de **voyage** → `JustificatifVoyage_DATE_PRIX_REF.pdf` |
| `curate-justificatifs-achat` | Organise les justificatifs d'**achat** → `justificatif_achat_DATE_PRIX_REF.pdf` |
| `draw-bilan-depenses-train` | Génère un bilan `.md` par année (totaux par mois) |
