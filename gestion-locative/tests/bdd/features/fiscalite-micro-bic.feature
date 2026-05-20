# language: fr
@fis-02 @phase5
Fonctionnalité: Calcul abattement micro-BIC LMNP (FIS-02)

  # Source juridique : CGI art. 50-0 (abattement 50 %, plancher 305 €, seuil 83 600 € recettes 2026-2028)
  # Cas limites obligatoires (CONTEXT.md L242-244)

  Scénario: Abattement 50 % standard sur recettes inférieures au seuil
    Etant donné des recettes annuelles de 60000 euros pour l'année 2026
    Quand l'on calcule le micro-BIC avec les règles fiscales 2026
    Alors l'abattement appliqué est 30000 euros
    Et le résultat imposable est 30000 euros
    Et le seuil micro-BIC n'est pas dépassé

  Scénario: Plancher 305 € appliqué si 50 % des recettes est inférieur au plancher
    # 600 € × 50 % = 300 € < 305 € plancher CGI art. 50-0
    Etant donné des recettes annuelles de 600 euros pour l'année 2026
    Quand l'on calcule le micro-BIC avec les règles fiscales 2026
    Alors l'abattement appliqué est 305 euros
    Et le résultat imposable est 295 euros
    Et le seuil micro-BIC n'est pas dépassé

  Scénario: Seuil exact 83 599,99 € → micro-BIC éligible
    # Cas limite : la borne inférieure stricte du seuil (CGI art. 50-0)
    Etant donné des recettes annuelles en centimes de 8359999 pour l'année 2026
    Quand l'on calcule le micro-BIC avec les règles fiscales 2026
    Alors le seuil micro-BIC n'est pas dépassé

  Scénario: Seuil dépassé de 1 centime 83 600,01 € → réel forcé
    # Cas limite : 1 centime au-dessus du seuil → régime réel (CGI art. 50-0)
    Etant donné des recettes annuelles en centimes de 8360001 pour l'année 2026
    Quand l'on calcule le micro-BIC avec les règles fiscales 2026
    Alors le seuil micro-BIC est dépassé
