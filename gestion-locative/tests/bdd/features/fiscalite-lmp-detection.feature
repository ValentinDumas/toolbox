# language: fr
@fis-01 @phase5
Fonctionnalité: Détection bascule LMNP → LMP — CGI art. 155 IV (FIS-01)

  # Sources juridiques :
  #   CGI art. 155 IV — critères LMP depuis Conseil Constitutionnel n° 2009-587 DC
  #   D-FIS-G3.3 — verdict tri-état (LMNP confirmé / Indéterminé / LMP probable)
  #   D-FIS-G3.4 — évaluation indépendante par exercice (anti-sticky LMP)
  #   BOFIP-BIC-CHAMP-40-20 — périmètre revenus actifs foyer
  #
  # Cas limites obligatoires (CONTEXT.md L245-247)

  Contexte:
    Etant donné l'application est prête pour la détection LMP avec clock fixe "2026-12-31"

  Scénario: Recettes 22 999,99 € → LMNP confirmé (sous seuil)
    # Cas limite CONTEXT.md L245 : juste sous le seuil de 23 000 €
    Etant donné des recettes annuelles de 2299999 centimes pour exercice 2026
    Et aucun revenu du foyer renseigné
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"

  Scénario: Recettes 23 000,00 € exact → LMNP confirmé (égalité non strict supérieur)
    # Cas limite CONTEXT.md L245 : exactement 23 000 € — critère (a) = strict supérieur donc non rempli
    Etant donné des recettes annuelles de 2300000 centimes pour exercice 2026
    Et aucun revenu du foyer renseigné
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"

  Scénario: Recettes 24 000 € + revenus foyer 24 001 € → LMNP confirmé (recettes ≤ revenus)
    # Cas limite CONTEXT.md L246 : recettes > seuil mais ≤ revenus foyer → critère (b) non rempli
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 2400100 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"

  Scénario: Recettes 24 000 € + revenus foyer 24 000 € (égalité) → LMNP confirmé
    # Cas limite CONTEXT.md L246 : égalité = critère (b) strict non rempli
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 2400000 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"

  Scénario: Recettes 24 000 € + revenus foyer 23 000 € → LMP probable
    # Cas limite CONTEXT.md L247 : les deux critères (a) et (b) remplis → LMP probable
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 2300000 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmp_probable"

  Scénario: Recettes 24 000 € sans revenus foyer saisis → Indéterminé
    # Cas limite CONTEXT.md L247 : recettes > seuil mais revenus foyer null → impossible de trancher
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et aucun revenu du foyer renseigné
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "indetermine_revenus_foyer_manquants"

  Scénario: Anti-sticky exercice N — LMNP confirmé (foyer > recettes)
    # D-FIS-G3.4 : évaluation indépendante par exercice
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 3000000 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"

  Scénario: Anti-sticky exercice N+1 — LMP probable (foyer < recettes)
    # D-FIS-G3.4 : même recettes, revenus différents → verdict différent sans verrouillage
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 2000000 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmp_probable"

  Scénario: Anti-sticky exercice N+2 — retour LMNP confirmé (pas de sticky LMP)
    # D-FIS-G3.4 : après LMP probable, retour LMNP est possible (pas de verrouillage)
    Etant donné des recettes annuelles de 2400000 centimes pour exercice 2026
    Et des revenus du foyer de 3000000 centimes enregistrés
    Quand on évalue le verdict LMNP/LMP pour exercice 2026
    Alors le verdict est "lmnp_confirme"
