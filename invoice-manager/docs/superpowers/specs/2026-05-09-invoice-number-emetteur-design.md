# Spec: Extraction n° ticket/transaction + émetteur nom

## Contexte

Les tickets photo (reçus CB, tickets de caisse) ont des champs extractibles qui ne matchent pas les patterns actuels conçus pour des factures formelles. Deux champs manquants pénalisent la confiance :

- `numéro_facture` : les tickets ont des références de transaction/ticket mais sous des labels non-formels
- `émetteur_nom` : le nom du commerce est en clair dans les premières lignes du ticket, mais le parser actuel ne l'extrait pas

## Design

### 1. `_parse_invoice_number()` — chaîne de patterns prioritaires

Principe KISS : une liste ordonnée de regex, on retourne le premier match. Aucune logique conditionnelle, aucun fuzzy matching.

```python
_INVOICE_PATTERNS = [
    # 1. Factures formelles (existant)
    r"(?:facture|invoice|n°|ref|référence)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})",
    # 2. Reçus / tickets de caisse
    r"(?:ticket|reçu|recu|transaction)\s*[:\-]?\s*([A-Z0-9][A-Z0-9\-_/]{3,})",
    # 3. Format caisse RT + 8 chiffres minimum
    r"\b(RT\d{8,})\b",
]
```

Implémentation : itérer `_INVOICE_PATTERNS`, retourner le premier groupe capturé. Tous les patterns sont case-insensitive (`re.I`).

**Ce qui est exclu intentionnellement** : le pattern "référence garbled OCR" — trop risqué, trop fragile, pas KISS. Si une référence CB n'est pas capturée par les 3 patterns ci-dessus, elle reste None et l'utilisateur la saisit en révision.

### 2. `_parse_emetteur_fallback()` — premières lignes alphabétiques

Principe : si `émetteur_nom` est None après l'extraction standard, scanner les N premières lignes du texte OCR.

Règles de sélection (toutes doivent être vraies) :
- Longueur entre 3 et 60 chars
- Au moins 60% de caractères alphabétiques
- Pas un mot-clé fiscal connu (`TVA`, `HT`, `TTC`, `TOTAL`, `DATE`, `HEURE`, `CARTE`, `SIRET`, `SIREN`)
- Pas uniquement des chiffres

Retourne la **première ligne** passant ces filtres dans les 8 premières lignes non vides. Pas de scoring, pas de ranking — KISS.

Appelé dans `parse_invoice()` en dernier recours, après tous les autres parsers.

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `extract.py` | `_parse_invoice_number()` — remplacer par chaîne de patterns |
| `extract.py` | `_parse_emetteur_fallback()` — nouvelle fonction |
| `extract.py` | `parse_invoice()` — appeler le fallback si `émetteur_nom` is None |

## Hors scope

- Fuzzy matching sur les labels OCR garbled
- Extraction de l'adresse émetteur
- Inférence HT depuis TTC (décision séparée)

## Vérification

1. IMG_1149 → `numéro_facture` capté (référence CB), `émetteur_nom` = nom du commerce
2. BricoDepot → `numéro_facture` = `RT23692365201...` ou ticket n°, `émetteur_nom` = "BRICO DEPOT" (ou approx)
3. Factures OVH → `numéro_facture` inchangé (pattern 1 match en premier, fallbacks non déclenchés)
4. Confiance IMG_1149 ≥ 80% si `numéro_facture` + `émetteur_nom` trouvés
