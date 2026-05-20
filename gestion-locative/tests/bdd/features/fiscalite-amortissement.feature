# language: fr
@fis-04-amortissement @phase5
Fonctionnalité: Calcul d'amortissement par composant LMNP (FIS-04)

  # Sources juridiques :
  #   CGI art. 39 : plafond dotation = résultat avant amortissement
  #   CGI art. 39 B : ARD reportable sans limite
  #   BOFIP-BIC-AMT-20-10 : prorata temporis au jour près (D-FIS-G1.6)
  #   BOFIP-BIC-AMT-20-40 : durées composants BOFIP
  #   D-FIS-G1.6 : cas limites CONTEXT.md L249-252

  Contexte:
    Etant donné l'application est prête pour la fiscalité LMNP avec clock fixe "2026-12-31"
    Et un Bien enregistré avec valorisation fiscale activée

  @D-FIS-G1.6
  Scénario: Prorata temporis gros œuvre — acquisition 2026-03-15 (cas limite CONTEXT.md L249)
    Etant donné un composant gros_oeuvre de 200000 euros acquis le "2026-03-15"
    Et un résultat avant amortissement de 10000 euros pour exercice 2026
    Et un ARD cumulé en entrée de 0 euros
    Quand on calcule le tableau d'amortissement pour exercice 2026
    Alors le composant gros_oeuvre a une dotation théorique de 4000 euros pour exercice 2026
    Et le composant gros_oeuvre a une dotation appliquée de 4000 euros et ARD généré de 0 euros

  @D-FIS-G1.1
  Scénario: Terrain non amortissable — dotation toujours 0
    Etant donné un composant terrain de 20000 euros acquis le "2026-01-01"
    Et un résultat avant amortissement de 50000 euros pour exercice 2026
    Et un ARD cumulé en entrée de 0 euros
    Quand on calcule le tableau d'amortissement pour exercice 2026
    Alors le composant terrain a une dotation théorique de 0 euros pour exercice 2026

  @D-FIS-G1.6
  Scénario: Prorata temporis sortie mi-année (acquisition 2026-01-01 sortie 2026-06-30)
    Etant donné un composant mobilier de 5000 euros acquis le "2026-01-01" sorti le "2026-06-30"
    Et un résultat avant amortissement de 50000 euros pour exercice 2026
    Et un ARD cumulé en entrée de 0 euros
    Quand on calcule le tableau d'amortissement pour exercice 2026
    Alors le composant mobilier a une dotation théorique inférieure à 71428 centimes pour exercice 2026
    Et le composant mobilier a une dotation théorique supérieure à 35000 centimes pour exercice 2026

  @D-LOCK-1 @CGI-39
  Scénario: Résultat 0 — toutes les dotations génèrent 100% d'ARD
    Etant donné un composant gros_oeuvre de 200000 euros acquis le "2026-01-01"
    Et un résultat avant amortissement de 0 euros pour exercice 2026
    Et un ARD cumulé en entrée de 0 euros
    Quand on calcule le tableau d'amortissement pour exercice 2026
    Alors le composant gros_oeuvre a une dotation appliquée de 0 euros et ARD généré de 5000 euros
    Et l'ARD cumulé disponible exercice 2026 est de 5000 euros
