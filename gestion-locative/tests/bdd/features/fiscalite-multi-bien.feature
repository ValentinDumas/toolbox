# language: fr
@fis-multi-bien @phase5
Fonctionnalité: Vue consolidée multi-bien LMNP (D-FIS-G5.1, D-LOCK-2)

  En tant que bailleur LMNP possédant plusieurs biens meublés
  Je veux visualiser mes recettes et charges consolidées par bien
  Afin d'anticiper le verdict LMNP/LMP et le régime fiscal appliqué

  Contexte:
    Soit un bailleur LMNP inscrit dans le système
    Et aucune déclaration annuelle clôturée pour l'exercice 2026

  Scénario: Vue consolidée avec 2 biens — ventilation réelle et régime réel forcé
    Étant donné un bailleur avec 2 biens actifs
    Et recettes 50 000 € pour le bien "1 rue Paris" exercice 2026
    Et recettes 40 000 € pour le bien "2 rue Lyon" exercice 2026
    Et charges qualifiées 5 000 € pour le bien "1 rue Paris" exercice 2026
    Et charges qualifiées 10 000 € pour le bien "2 rue Lyon" exercice 2026
    Et revenus actifs foyer 100 000 € renseignés
    Quand le bailleur consulte la vue consolidée fiscale 2026
    Alors la vue consolidée 2026 affiche 2 lignes bien et 1 ligne totaux
    Et la ligne bien "1 rue Paris" affiche recettes 50 000 € charges 5 000 €
    Et la ligne bien "2 rue Lyon" affiche recettes 40 000 € charges 10 000 €
    Et le seuil consolidé 90 000 € dépasse 83 600 € donc régime réel forcé
    Et le verdict LMP affiche "LMNP confirmé" car recettes 90 000 € inférieur au foyer 100 000 €

  Scénario: Seuil exact 83 599.99 € — micro-BIC éligible (D-LOCK-2)
    Étant donné un bailleur avec 1 bien actif
    Et recettes 83 599 € 99 centimes pour le bien "3 rue Marseille" exercice 2026
    Quand le bailleur consulte la vue consolidée fiscale 2026
    Alors le régime consolidé est "micro_bic"

  Scénario: Seuil consolidé + 1 centime — régime réel forcé (D-LOCK-2)
    Étant donné un bailleur avec 1 bien actif
    Et recettes 83 600 € pour le bien "4 rue Nice" exercice 2026
    Quand le bailleur consulte la vue consolidée fiscale 2026
    Alors le régime consolidé est "reel"
