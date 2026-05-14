import type { NiveauRelance } from './relance.js';

export interface VariablesRelance {
  prenom_locataire: string;
  nom_locataire: string;
  adresse_locataire: string;
  periode_impayee: string;
  montant_du: string;
  date_echeance_initiale: string;
  nom_bailleur: string;
  adresse_bailleur: string;
}

export interface TemplateRenderer {
  rendre(niveau: NiveauRelance, variables: VariablesRelance): string;
}

/**
 * Parse le sujet depuis un contenu rendu (format "Objet : XXX\n\n...").
 * Fonction pure — pas d'I/O.
 */
export function extraireSujet(rendu: string): string {
  const premiereLigne = rendu.split('\n')[0] ?? '';
  return premiereLigne.replace(/^Objet\s*:\s*/i, '').trim();
}

/**
 * Parse le corps depuis un contenu rendu (tout après la première ligne + ligne vide).
 * Fonction pure — pas d'I/O.
 */
export function extraireCorps(rendu: string): string {
  const lignes = rendu.split('\n');
  // Ignorer la première ligne (sujet) et les lignes vides suivantes
  let i = 1;
  while (i < lignes.length && (lignes[i] ?? '').trim() === '') {
    i++;
  }
  return lignes.slice(i).join('\n').trim();
}
