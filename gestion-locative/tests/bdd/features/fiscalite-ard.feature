# language: fr
@fis-04-ard @phase5
Fonctionnalité: ARD reporté — consommation prioritaire exercice N+1 (CGI art. 39 B)

  # Sources juridiques :
  #   CGI art. 39 B : ARD reportable sans limite de durée
  #   D-FIS-G1.7 : read-model matérialisé AmortissementExercice (SYNTHESE_BIEN)
  #   must_haves truth 5 : ardConsomme = min(ardCumuleEnEntree, resultatAvantAmortissement)

  Contexte:
    Etant donné l'application est prête pour la fiscalité LMNP avec clock fixe "2026-12-31"
    Et un Bien enregistré avec valorisation fiscale activée

  @CGI-39B
  Scénario: ARD reporté consommé en priorité absolue — exercice N+1
    Etant donné un composant gros_oeuvre de 200000 euros acquis le "2026-01-01"
    Et un résultat avant amortissement de 10000 euros pour exercice 2026
    Et un ARD cumulé en entrée de 15000 euros
    Quand on calcule le tableau d'amortissement pour exercice 2026
    Alors l'ARD consommé pour exercice 2026 est de 10000 euros
    Et le composant gros_oeuvre a une dotation appliquée de 0 euros et ARD généré de 5000 euros
    Et l'ARD cumulé disponible exercice 2026 est de 10000 euros
