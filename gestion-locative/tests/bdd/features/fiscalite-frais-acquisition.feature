# language: fr
@fis-04 @phase5
Fonctionnalité: Répartition des frais d'acquisition au prorata (D-FIS-G1.3, BOFIP-BIC-AMT-10-20 §110)

  En tant que bailleur LMNP
  Je veux que les frais de notaire et d'agence soient répartis au prorata
  Sur les composants amortissables (hors terrain)
  Afin de respecter la règle fiscale BOFIP-BIC-AMT-10-20 §110

  Scénario: Exemple G1.3 — répartition prorata 5 amortissables, frais 24 000 € (D-FIS-G1.3)
    Étant donné un bien avec un prix d'acquisition de 200 000 €
    Et des frais notaire de 16 000 € et des frais d'agence de 8 000 €
    Et une quote-part terrain de 10 % (terrain = 20 000 €)
    Et les 5 composants amortissables suivants:
      | type                    | montant_ht_euros |
      | gros_oeuvre             | 130000           |
      | toiture_facade          | 25000            |
      | installations_techniques| 12000            |
      | agencements_interieurs  | 8000             |
      | mobilier                | 5000             |
    Quand j'active la fiscalité réelle sur ce bien
    Alors les frais totaux de 24 000 € sont répartis au prorata sur les 5 amortissables
    Et le composant gros_oeuvre reçoit la plus grande quote-part (≈ 18 000 €, proportionnel à 130/180)
    Et la somme des quotes-parts est exactement égale à 24 000 €
    Et le dernier composant selon l'ordre stable absorbe l'éventuel centime d'arrondi

  Scénario: Un seul composant amortissable reçoit l'intégralité des frais
    Étant donné un bien avec un prix d'acquisition de 100 000 €
    Et des frais notaire de 8 000 € et des frais d'agence de 0 €
    Et une quote-part terrain de 20 % (terrain = 20 000 €)
    Et un seul composant amortissable de type gros_oeuvre pour 80 000 €
    Quand j'active la fiscalité réelle sur ce bien
    Alors le composant gros_oeuvre reçoit l'intégralité des frais (8 000 €)
    Et le montant total du composant gros_oeuvre est de 88 000 €
