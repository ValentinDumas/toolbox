# language: fr
@fis-sortie-composant @phase5
Fonctionnalité: Sortie de composant en cours d'exercice (D-FIS-G5.2, LF 2025 art. 84)

  En tant que bailleur LMNP en régime réel
  Je veux sortir un composant de mon bien (vente, sinistre, mise au rebut)
  Afin d'ajuster le tableau d'amortissement à partir de la date de sortie

  Contexte:
    Soit un bailleur LMNP avec un bien immobilier en fiscalité réelle activée
    Et un composant gros_oeuvre de 200 000 € acquis le 2026-01-01

  Scénario: Sortie d'un composant gros_oeuvre — prorata exercice de sortie
    Quand le bailleur sort le composant gros_oeuvre avec motif "vente" date "2026-06-30"
    Alors le composant gros_oeuvre a la date de sortie "2026-06-30"
    Et le composant gros_oeuvre a le motif de sortie "vente"
    Et la dotation 2026 pour gros_oeuvre est calculée en prorata 181/365 jours

  Scénario: Le composant sorti disparaît de la liste active pour l'exercice suivant
    Quand le bailleur sort le composant gros_oeuvre avec motif "mise_au_rebut" date "2026-12-31"
    Alors le composant gros_oeuvre est sorti du parc actif
    Et le composant gros_oeuvre n'apparaît plus dans la liste des composants actifs pour 2027

  Scénario: Tentative de sortie d'un composant déjà sorti — erreur attendue
    Étant donné que le composant gros_oeuvre a déjà été sorti le "2026-06-30"
    Quand le bailleur tente de sortir à nouveau le composant gros_oeuvre
    Alors une erreur "déjà sorti" est levée
    Et le composant gros_oeuvre reste avec sa date de sortie "2026-06-30" originale
