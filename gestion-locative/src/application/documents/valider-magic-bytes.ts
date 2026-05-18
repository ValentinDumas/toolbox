/**
 * Validation magic-bytes (D-118).
 *
 * Fonction PURE — aucun import infrastructure.
 *
 * Cross-référence MIME header annoncé par le client avec les magic bytes lus dans
 * les ~12 premiers octets du buffer. Magic gagne : si MIME header dit "application/pdf"
 * mais les bytes sont JPEG, on rejette ({ ok: false, raison: 'mismatch' }).
 */

export type MimeDetecte =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic';

export type ResultatValiderMagicBytes =
  | { ok: true; mimeFinal: MimeDetecte }
  | { ok: false; raison: 'mismatch' | 'format-non-accepte' };

const HEIC_BRANDS: ReadonlySet<string> = new Set([
  'heic',
  'heix',
  'mif1',
  'msf1',
  'heif',
  'heim',
  'heis',
  'hevc',
  'hevx',
]);

function detecterMagic(bytes: Buffer): MimeDetecte | null {
  if (bytes.length < 4) return null;

  // %PDF- = 0x25 0x50 0x44 0x46 0x2D
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP : "RIFF" (0..3) + "WEBP" (8..11)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return 'image/webp';
  }

  // HEIC : "ftyp" (4..7) + brand (8..11) ∈ HEIC_BRANDS
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
  ) {
    const brand = bytes.subarray(8, 12).toString('ascii');
    if (HEIC_BRANDS.has(brand)) {
      return 'image/heic';
    }
  }

  return null;
}

export function validerMagicBytes(
  bytes: Buffer,
  mimeAnnonce: string,
): ResultatValiderMagicBytes {
  const detecte = detecterMagic(bytes);

  if (detecte === null) {
    return { ok: false, raison: 'format-non-accepte' };
  }

  // Tolérance MIME header : image/jpg ↔ image/jpeg (variante non standard mais
  // fréquente). Si l'utilisateur envoie image/jpg et les bytes sont JPEG → OK.
  const mimeAnnonceNormalise =
    mimeAnnonce === 'image/jpg' ? 'image/jpeg' : mimeAnnonce;

  if (mimeAnnonceNormalise !== detecte) {
    return { ok: false, raison: 'mismatch' };
  }

  return { ok: true, mimeFinal: detecte };
}
