# language: fr
@fis-04 @phase5
Fonctionnalité: Gestion des composants de la ValorisationFiscale (D-FIS-G1.1, G1.4, G1.5)

  En tant que bailleur LMNP
  Je veux activer la fiscalité réelle sur un bien
  Afin de gérer les composants amortissables et la valorisation initiale

  Contexte:
    Soit un bien immobilier enregistré dans le système
    Et aucune valorisation fiscale active pour ce bien

  Scénario: Activation initiale de la fiscalité réelle — création de 6 composants (D-FIS-G1.4)
    Quand je soumets le formulaire d'activation fiscale avec:
      | prix_acquisition_euros     | 200000 |
      | date_acquisition           | 2026-03-15 |
      | frais_notaire_euros        | 16000  |
      | frais_agence_euros         | 8000   |
      | quote_part_terrain_ratio   | 0.10   |
      | composant_gros_oeuvre      | 130000 |
      | composant_toiture_facade   | 25000  |
      | composant_installations    | 12000  |
      | composant_agencements      | 8000   |
      | composant_mobilier         | 5000   |
    Alors 6 composants sont créés incluant le terrain et les amortissables
    Et la valorisation fiscale est persistée avec le prix d'acquisition de 200 000 €
    Et je suis redirigé vers la page détail de la fiscalité du bien

  Scénario: Sortie d'un composant (D-FIS-G1.5)
    Étant donné que la fiscalité a été activée sur ce bien avec 6 composants
    Quand je sors le composant "gros_oeuvre" avec le motif "vente" à la date "2026-06-01"
    Alors le composant gros_oeuvre n'apparaît plus dans la liste des composants actifs
    Et 5 composants restent actifs

  Scénario: Tentative de double activation — idempotence (T-05-03-01)
    Étant donné que la fiscalité a déjà été activée sur ce bien
    Quand je tente d'activer à nouveau la fiscalité
    Alors je reçois une erreur indiquant que le bien est déjà actif fiscalement
    Et la valorisation fiscale existante est préservée sans modification
