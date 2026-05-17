# language: fr
@loc-05 @phase3
Fonctionnalité: Gel loyer Climat — DPE F/G bloque l'indexation (LOC-05)

  Contexte:
    Etant donné l'application est prête pour LOC-05 avec clock fixe "2026-05-15"

  Scénario: DPE F bloque hard à l'UI (gel-loyer.ejs)
    Etant donné un Bien LOC-05 avec DPE "F"
    Et un Bail LOC-05 actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre GET /baux/:id/indexer
    Alors la page LOC-05 contient "Gel loyer Climat actif (DPE F)"
    Et la page LOC-05 contient "Compris"
    Et la page LOC-05 ne contient PAS "Simuler la révision"

  Scénario: DPE F — bypass POST simuler refusé (defense en profondeur)
    Etant donné un Bien LOC-05 avec DPE "F"
    Et un Bail LOC-05 actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Alors la réponse LOC-05 n'effectue pas le calcul d'indexation
    Et la page LOC-05 contient "Gel loyer Climat actif"

  Scénario: DPE G bloque hard idem F
    Etant donné un Bien LOC-05 avec DPE "G"
    Et un Bail LOC-05 actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur ouvre GET /baux/:id/indexer
    Alors la page LOC-05 contient "Gel loyer Climat actif (DPE G)"
