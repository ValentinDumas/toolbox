# language: fr
@loc-04-apply @phase3
Fonctionnalité: Application IRL — apply + renoncer + avenant PDF (LOC-04)

  Contexte:
    Etant donné l'application est prête pour LOC-04 apply avec clock fixe "2026-05-15"

  Scénario: Apply flow complet pivot loyer + BailIndexation + avenant PDF
    Etant donné un Bien LOC-04 apply avec DPE "D"
    Et un Bail LOC-04 apply actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Et le bailleur soumet POST /baux/:id/indexer/appliquer
    Alors le bail a loyer_hc 81920 et irl_reference "2025-T4"/145.47
    Et la table bail_indexations contient 1 ligne avec indexation_appliquee=1
    Et le fichier avenant existe sur disque pour l'année 2026

  Scénario: Renoncer flow pivot IRL sans changement loyer
    Etant donné un Bien LOC-04 apply avec DPE "D"
    Et un Bail LOC-04 apply actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Et le bailleur soumet POST /baux/:id/indexer/renoncer
    Alors le bail a loyer_hc 80000 et irl_reference "2025-T4"/145.47
    Et la table bail_indexations contient 1 ligne avec indexation_appliquee=0 et raison "refus_bailleur"

  Scénario: GET avenant PDF après apply
    Etant donné un Bien LOC-04 apply avec DPE "D"
    Et un Bail LOC-04 apply actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Et le bailleur soumet POST /baux/:id/indexer/appliquer
    Et le bailleur télécharge GET /baux/:id/avenant/2026
    Alors la réponse a Content-Type "application/pdf"
    Et le corps commence par "%PDF-"

  Scénario: Gel DPE bloque apply server-side
    Etant donné un Bien LOC-04 apply avec DPE "F"
    Et un Bail LOC-04 apply actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/appliquer en forcant la session draft "2025-T4"/145.47
    Alors la table bail_indexations contient 0 ligne

  Scénario: Renoncer met à jour l'IRL référence même quand l'utilisateur abandonne
    Etant donné un Bien LOC-04 apply avec DPE "D"
    Et un Bail LOC-04 apply actif avec date_debut "2025-05-01" loyer_hc 800 irl_ref "2024-T4"/142.06
    Quand le bailleur soumet POST /baux/:id/indexer/simuler avec irl_trimestre="2025-T4" irl_valeur="145.47"
    Et le bailleur soumet POST /baux/:id/indexer/renoncer
    Et le bailleur ouvre la fiche du Bail LOC-04 apply
    Alors la page LOC-04 apply contient "145.47"
