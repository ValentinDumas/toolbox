# language: fr
# Feature — Cas limites obligatoires Phase 5 (Plan 08)
#
# Couverture 100 % des cas limites CONTEXT.md L242-252.
# Chaque scénario correspond à 1 cas limite identifié dans le document de contexte.
#
# Sources juridiques :
#   CGI art. 50-0 — micro-BIC seuil 83 600 € (2026-2028), abattement 50 %, plancher 305 €
#   CGI art. 39, 39 B — amortissement par composant, ARD reportable sans limite
#   CGI art. 155 IV — critères LMP (Conseil Constitutionnel n° 2009-587 DC)
#   BOFIP-BIC-AMT-20-10 — prorata temporis jour par jour

@fis-cas-limites @phase5
Fonctionnalité: Cas limites locked Phase 5 — couverture 100 % CONTEXT.md L242-252

  Contexte:
    Etant donné l'application est prête pour les cas limites fiscaux avec clock fixe "2026-12-31"

  # ──────────────────────────────────────────────────────────────────────────────
  # L242a — Seuil micro-BIC inférieur strict (CGI art. 50-0)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L242a — recettes 8 359 999n → régime auto-choisi micro éligible
    # 83 599,99 € < 83 600 € exact → micro-BIC éligible (seuil strict supérieur)
    Etant donné des recettes de 8359999 centimes pour calcul du régime
    Quand on calcule le régime auto-choisi pour ces recettes
    Alors le régime auto-choisi est "micro_bic"

  # ──────────────────────────────────────────────────────────────────────────────
  # L242b — Seuil micro-BIC dépassé (réel forcé)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L242b — recettes 8 360 001n → régime auto-choisi réel forcé
    # 83 600,01 € > 83 600 € exact → réel forcé (CGI art. 50-0 seuil strict supérieur)
    Etant donné des recettes de 8360001 centimes pour calcul du régime
    Quand on calcule le régime auto-choisi pour ces recettes
    Alors le régime auto-choisi est "reel"

  # ──────────────────────────────────────────────────────────────────────────────
  # L243 — Plancher abattement 305 € (CGI art. 50-0)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L243 — recettes 60 998n (50% = 30 499n) → plancher 305 € appliqué
    # recettes × 50 % = 30 499 centimes = 304,99 € < 305 € plancher → abattement = 305 €
    Etant donné des recettes de 60998 centimes pour calcul micro-BIC
    Quand on calcule le micro-BIC pour ces recettes
    Alors l'abattement appliqué est 30500 centimes (plancher 305 €)

  # ──────────────────────────────────────────────────────────────────────────────
  # L244 — LMNP confirmé sous le seuil (CGI art. 155 IV)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L244 — recettes 2 299 999n → LMNP confirmé (sous seuil LMP)
    # 22 999,99 € < 23 000 € → critère (a) non rempli → LMNP confirmé
    Etant donné des recettes de 2299999 centimes pour le calcul du verdict LMP
    Et aucun revenu du foyer renseigné pour le calcul du verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmnp_confirme"

  # ──────────────────────────────────────────────────────────────────────────────
  # L245 — Égalité recettes/revenus foyer → LMNP (critère b non strict)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L245 — recettes 2 300 001n ET revenus 2 300 001n → LMNP (égalité non strict)
    # recettes > seuil (a rempli), recettes = revenus foyer → critère (b) strict non rempli → LMNP
    Etant donné des recettes de 2300001 centimes pour le calcul du verdict LMP
    Et des revenus du foyer de 2300001 centimes pour le calcul du verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmnp_confirme"

  # ──────────────────────────────────────────────────────────────────────────────
  # L246 — LMP probable (les deux critères stricts satisfaits)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L246 — recettes 2 400 000n ET revenus 2 300 000n → LMP probable
    # recettes > seuil (a) ET recettes > revenus foyer (b) → LMP probable
    Etant donné des recettes de 2400000 centimes pour le calcul du verdict LMP
    Et des revenus du foyer de 2300000 centimes pour le calcul du verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmp_probable"

  # ──────────────────────────────────────────────────────────────────────────────
  # L247 — Indéterminé (revenus foyer manquants)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L247 — recettes 2 400 000n ET revenus null → indéterminé
    # recettes > seuil (a rempli), revenus foyer null → impossible de trancher → indéterminé
    Etant donné des recettes de 2400000 centimes pour le calcul du verdict LMP
    Et aucun revenu du foyer renseigné pour le calcul du verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "indetermine_revenus_foyer_manquants"

  # ──────────────────────────────────────────────────────────────────────────────
  # L249 — Acquisition gros œuvre 200k 2026-03-15 → dotation proratisée (292 jours)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L249 — acquisition gros_oeuvre 200 000 € le 2026-03-15 → dotation 4 000 €
    # dotation = 200 000 € × (292/365) ÷ 40 ans = 4 000 € (prorata temporis BOFIP-BIC-AMT-20-10)
    Etant donné un composant gros_oeuvre de 20000000 centimes acquis le "2026-03-15"
    Quand on calcule l'amortissement du composant pour l'exercice 2026
    Alors la dotation théorique du composant est d'environ 400000 centimes (±100 centimes)

  # ──────────────────────────────────────────────────────────────────────────────
  # L250 — Sortie même année → prorata 6 mois
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L250 — composant gros_oeuvre sorti le 2026-06-30 → prorata 181 jours
    # Acquisition 2026-01-01 + sortie 2026-06-30 → 181 jours actifs sur 365
    # dotation = 200 000 € × (181/365) ÷ 40 ans ≈ 2 479 €
    Etant donné un composant gros_oeuvre de 20000000 centimes acquis le "2026-01-01" sorti le "2026-06-30"
    Quand on calcule l'amortissement du composant pour l'exercice 2026
    Alors la dotation théorique du composant est d'environ 247945 centimes (±500 centimes)
    Et le composant n'est pas actif pour l'exercice 2027

  # ──────────────────────────────────────────────────────────────────────────────
  # L251 — Soft-delete encaissement post-clôture → snapshot inchangé
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L251 — annulation encaissement post-clôture → déclaration inchangée
    # La déclaration est un snapshot par valeur (D-FIS-G4.2) — l'annulation post-clôture n'affecte pas le snapshot
    Etant donné une déclaration clôturée avec 5000000 centimes de recettes
    Quand on annule l'encaissement après la clôture
    Alors la déclaration a toujours 5000000 centimes de recettes

  # ──────────────────────────────────────────────────────────────────────────────
  # L252 — Anti-sticky LMP : 3 exercices indépendants (D-FIS-G3.4)
  # ──────────────────────────────────────────────────────────────────────────────
  Scénario: Cas limite L252 — anti-sticky LMP sur 3 exercices indépendants
    # N : recettes 24k, foyer 30k → LMNP confirmé
    Etant donné des recettes de 2400000 centimes et revenus du foyer 3000000 centimes pour le verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmnp_confirme"
    # N+1 : recettes 24k, foyer 20k → LMP probable (pas de sticky !)
    Etant donné des recettes de 2400000 centimes et revenus du foyer 2000000 centimes pour le verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmp_probable"
    # N+2 : recettes 24k, foyer 25k → LMNP confirmé (retour normal, pas de verrouillage)
    Etant donné des recettes de 2400000 centimes et revenus du foyer 2500000 centimes pour le verdict LMP
    Quand on évalue le verdict LMP pour ces recettes
    Alors le verdict LMP est "lmnp_confirme"
