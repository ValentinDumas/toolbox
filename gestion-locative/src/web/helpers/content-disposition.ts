/**
 * Encode un Content-Disposition `attachment` conforme à RFC 6266 + RFC 8187.
 *
 * Génère :
 *   attachment; filename="<ascii-fallback>"; filename*=UTF-8''<percent-encoded>
 *
 * Le navigateur lit `filename*` en priorité ; les anciens clients tombent
 * sur `filename`. L'ASCII fallback est NFD-normalisé puis purgé des combining
 * marks et des caractères `"`/`\` (qui casseraient le parsing du header).
 */
export function encodeFilenameRFC6266(filename: string): string {
  const asciiFallback = filename
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\]/g, '_');
  const percentEncoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${percentEncoded}`;
}
