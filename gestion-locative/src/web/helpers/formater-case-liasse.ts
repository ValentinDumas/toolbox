/**
 * Helper UI — formaterCaseLiasse (Phase 6 / FIS-05 / UI-SPEC §S2).
 *
 * Rend le numéro de case cerfa en monospace 14px pour distinguer visuellement
 * l'identifiant de case (ex. `CB`, `FK`, `1GF`) du texte courant — sans quoi
 * l'utilisateur le confond avec du contenu narratif (UI-SPEC §Typography).
 *
 * **Sécurité (V5 + T-06-LIASSE-W1-02 threat register) :** Le contenu est
 * échappé contre XSS bien que la donnée provienne du mapping interne — défense
 * en profondeur. La vue EJS doit utiliser `<%- formaterCaseLiasse(c.numero) %>`
 * (interpolation HTML) car la fonction retourne du HTML pré-échappé.
 *
 * Pas un nouveau token CSS (UI-SPEC §Design System verrouillé) — usage local
 * de la stack monospace système.
 */

/**
 * Échappement HTML minimal (5 caractères + apostrophe).
 * Pattern hérité du code Phase 4 (helpers UI sécurisés).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Retourne le HTML `<span>` monospace pour un numéro de case cerfa.
 *
 * Exemple :
 *   `formaterCaseLiasse('CB')` →
 *   `<span class="case-cerfa" style="font-family:ui-monospace, monospace; font-size:14px">CB</span>`
 */
export function formaterCaseLiasse(numero: string): string {
  const safe = escapeHtml(numero);
  return `<span class="case-cerfa" style="font-family:ui-monospace, monospace; font-size:14px">${safe}</span>`;
}
