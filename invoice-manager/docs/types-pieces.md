# Types de pièces comptables

Référentiel métier — types de documents supportés, règles par statut, et deadlines de déclaration.

> Sources : URSSAF.fr, DGFiP.fr — Vérifié 2026-05-05

---

## Types de documents et sens comptable

| `type_document`   | Sens comptable (PCG) | Nature métier                       | Statuts concernés      | Signal de détection                               |
|-------------------|----------------------|-------------------------------------|------------------------|---------------------------------------------------|
| `facture_reçue`   | **Débit**            | Charge fournisseur                  | Tous                   | Défaut (aucun autre signal)                        |
| `facture_émise`   | **Crédit**           | Produit / recette client            | AE, SASU, SARL         | Ton SIREN dans le corps du document                |
| `avoir_reçu`      | **Crédit** (contre-passation) | Remboursement fournisseur  | Tous                   | "avoir", "credit note", "note de crédit"           |
| `avoir_émis`      | **Débit** (contre-passation) | Remboursement client        | AE, SASU, SARL         | "avoir" + ton SIREN émetteur                       |
| `reçu`            | **Débit**            | Charge sans facture formelle        | Tous                   | Pas de numéro de facture + montant TTC < 200 €     |
| `note_de_frais`   | **Débit**            | Frais pro remboursés                | Salarié, SASU, SARL    | "note de frais", "remboursement de frais"          |
| `relevé_bancaire` | _Hors livre-journal_ | Réconciliation                      | SASU, SARL             | "relevé de compte", "extrait de compte"            |
| `devis`           | _Hors livre-journal_ | Hors mouvement financier            | Tous                   | "devis", "cotation", "quote"                       |

> **Convention PCG** : charges au débit (classe 6), produits au crédit (classe 7).
> Un avoir est une **contre-passation** : il prend le sens inverse de la pièce qu'il annule.
> Source de vérité : `services/comptabilite.py::sens_comptable`.

**Priorité de détection** (ordre appliqué dans `_guess_doc_type()`) :
1. avoir (`avoir_reçu` ou `avoir_émis` selon SIREN)
2. note de frais
3. devis
4. relevé bancaire
5. facture émise (SIREN utilisateur présent)
6. reçu (pas de n° facture + montant < 200 €)
7. facture reçue (défaut)

---

## Règles de déductibilité par type et statut

| `type_document`   | Auto-entrepreneur            | SASU / SARL                            | Salarié                            |
|-------------------|------------------------------|----------------------------------------|------------------------------------|
| `facture_reçue`   | Déductible (charge pro)      | Déductible IS + TVA récupérable        | Non déductible (sauf frais réels)  |
| `facture_émise`   | Produit → CA déclaré         | Produit → CA IS                        | N/A                                |
| `avoir_reçu`      | Réduit la charge (−charge)   | Réduit charge IS + TVA à reverser      | Réduit les frais réels             |
| `avoir_émis`      | Réduit le CA déclaré         | Réduit CA IS + TVA collectée           | N/A                                |
| `reçu`            | Déductible si pro            | Déductible IS (sans TVA récupérable)   | Frais réels si justifié            |
| `note_de_frais`   | N/A (pas de salariés en AE)  | Déductible IS + remboursement salarié  | Remboursement employeur            |
| `relevé_bancaire` | Hors ledger (réconciliation) | Hors ledger (réconciliation)           | Hors ledger                        |
| `devis`           | Hors ledger                  | Hors ledger                            | Hors ledger                        |

**Taux de déductibilité spéciaux :**
- Repas d'affaires : 50 % déductible (toutes structures)
- Véhicule personnel (usage pro) : barème kilométrique, non déductible TTC
- Téléphonie/internet : 50–100 % selon usage pro documenté

---

## Statuts fiscaux et cadences de déclaration

| Statut             | Régime TVA            | Déclaration revenus          | Cadence défaut | Cadences proposées           | Assujetti TVA |
|--------------------|-----------------------|------------------------------|----------------|------------------------------|---------------|
| `auto-entrepreneur`| Franchise en base     | CA mensuel ou trimestriel (URSSAF) | trimestrielle | `mensuelle` · `trimestrielle` | Non           |
| `SASU`             | Réel normal           | IS annuel (liasse fiscale)   | mensuelle      | `mensuelle` · `trimestrielle` | Oui           |
| `SARL`             | Réel normal           | IS annuel (liasse fiscale)   | mensuelle      | `mensuelle` · `trimestrielle` | Oui           |
| `salarié`          | N/A                   | IR annuel (DGFiP)            | annuelle       | `annuelle`                   | Non           |

La cadence peut être surchargée depuis **Paramètres → Fiscalité** ; les options proposées sont filtrées selon le statut fiscal sélectionné (`CADENCE_OPTIONS` dans `config.py`).

---

## Deadlines de déclaration

### Auto-entrepreneur — trimestrielle (URSSAF)

| Trimestre | Période couverte    | Deadline       |
|-----------|---------------------|----------------|
| T1        | Jan–Mar             | 30 avril       |
| T2        | Avr–Jun             | 31 juillet     |
| T3        | Jul–Sep             | 31 octobre     |
| T4        | Oct–Déc             | 31 janvier N+1 |

### Auto-entrepreneur — mensuelle (URSSAF)

Deadline : dernier jour du mois suivant.  
Ex : janvier → 28/29 février.

### SASU / SARL — TVA mensuelle CA3 (DGFiP, télédéclaration)

Deadline : 19 du mois suivant.  
Ex : janvier → 19 février ; décembre → 19 janvier N+1.

### Salarié — IR annuel (DGFiP)

Deadline : 31 mai de l'année suivante.  
Ex : revenus 2025 → 31 mai 2026.

> Les deadlines sont calculées offline dans `export.py` à partir de ces règles.  
> Aucune API externe n'est interrogée.

---

## Correction du stock existant (`--reclassify`)

Tous les documents importés avant l'ajout de `_guess_doc_type()` ont `type_document = "facture_reçue"` par défaut. Pour corriger :

```bash
# Option A — correction automatique via texte_brut (si disponible)
python3 review.py --reclassify --auto

# Option B — correction manuelle (CSV à éditer)
python3 review.py --reclassify          # exporte review/reclassify.csv
# → éditer la colonne type_document
python3 review.py --reclassify --import # applique les corrections
```

Le CSV `reclassify.csv` ne contient que les champs utiles à l'identification :
`id | type_document | date_document | émetteur_nom | montant_ttc | catégorie | fichier_source`

Seul le champ `type_document` est mis à jour à l'import — les autres champs restent inchangés.

Les documents avec `statut_révision = à_réviser` sont exclus du reclassify (ils passent d'abord par `review.py --import`).
