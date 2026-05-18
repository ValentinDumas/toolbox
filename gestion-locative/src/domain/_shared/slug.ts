/**
 * Slugifie une chaîne en `[a-z0-9-]` uniquement, max 80 chars,
 * fallback "document" si vide après normalisation (DP-27).
 *
 * Fonction pure — sans dépendance technique. Utilisable depuis domain,
 * application, infrastructure ou web indistinctement.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/^-|-$/g, '');
  return slug.length > 0 ? slug : 'document';
}
