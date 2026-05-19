import sharp from 'sharp';

import type {
  ConvertisseurImage,
  MimeTypeImage,
  MimeTypeImagePersiste,
} from '../../domain/documents/convertisseur-image.js';
import { ConversionHeicIndisponible } from '../../domain/documents/erreurs.js';

/**
 * Adapter sharp pour `ConvertisseurImage` (D-105).
 *
 * - HEIC → JPEG (qualité 85) via sharp + libvips HEIF.
 * - JPEG / PNG / WebP → passe-through (bytes identiques).
 *
 * Note prod : sharp prebuilds inclut libvips avec HEIF sur darwin/linux x64+arm64
 * (depuis 0.32). Pour macOS sur Apple Silicon, le binding charge libvips HEIF intégré.
 * En cas d'erreur sharp (HEIC corrompu, format inattendu), on propage l'erreur métier
 * sans laisser fuir le stacktrace serveur.
 */
export class ConvertisseurImageSharp implements ConvertisseurImage {
  async convertirVersJpegSiNecessaire(
    bytes: Buffer,
    mimeSource: MimeTypeImage,
  ): Promise<{ bytes: Buffer; mimeFinal: MimeTypeImagePersiste }> {
    if (mimeSource !== 'image/heic') {
      return { bytes, mimeFinal: mimeSource };
    }

    try {
      const jpegBytes = await sharp(bytes).jpeg({ quality: 85 }).toBuffer();
      return { bytes: jpegBytes, mimeFinal: 'image/jpeg' };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur inconnue de conversion HEIC';
      // G-HEIC-02 : libheif présent sans plugin HEVC → erreur 503 actionable
      if (/No decoding plugin installed|bad seek|libheif: Error while loading plugin/i.test(message)) {
        throw new ConversionHeicIndisponible(message);
      }
      throw new Error(`Conversion HEIC → JPEG échouée : ${message}`);
    }
  }
}
