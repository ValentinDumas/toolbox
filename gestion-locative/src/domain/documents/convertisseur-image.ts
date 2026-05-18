/**
 * Port domain `ConvertisseurImage` (D-105 — pour conversion HEIC → JPEG).
 *
 * Adapté côté infra par `ConvertisseurImageSharp` (sharp + libvips HEIF).
 */

export type MimeTypeImage =
  | 'image/jpeg'
  | 'image/png'
  | 'image/heic'
  | 'image/webp';

export type MimeTypeImagePersiste =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp';

export interface ConvertisseurImage {
  /**
   * Si `mimeSource === 'image/heic'` : convertit en JPEG (qualité 85 par défaut).
   * Sinon (jpeg/png/webp) : passe-through (bytes identiques).
   * Retourne `mimeFinal` qui ne peut PAS être image/heic.
   */
  convertirVersJpegSiNecessaire(
    bytes: Buffer,
    mimeSource: MimeTypeImage,
  ): Promise<{
    bytes: Buffer;
    mimeFinal: MimeTypeImagePersiste;
  }>;
}
