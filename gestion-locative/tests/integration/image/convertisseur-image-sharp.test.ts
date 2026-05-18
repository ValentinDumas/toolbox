import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { ConvertisseurImageSharp } from '../../../src/infrastructure/image/convertisseur-image-sharp.js';

async function genererJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 200, g: 100, b: 50 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

async function genererPng(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 4, background: { r: 50, g: 100, b: 200, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

async function genererWebp(): Promise<Buffer> {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: { r: 100, g: 200, b: 150 } },
  })
    .webp()
    .toBuffer();
}

describe('ConvertisseurImageSharp', () => {
  it('passe-through JPEG : bytes identiques + mimeFinal=image/jpeg', async () => {
    const conv = new ConvertisseurImageSharp();
    const bytes = await genererJpeg();
    const r = await conv.convertirVersJpegSiNecessaire(bytes, 'image/jpeg');
    expect(r.bytes.equals(bytes)).toBe(true);
    expect(r.mimeFinal).toBe('image/jpeg');
  });

  it('passe-through PNG : bytes identiques + mimeFinal=image/png', async () => {
    const conv = new ConvertisseurImageSharp();
    const bytes = await genererPng();
    const r = await conv.convertirVersJpegSiNecessaire(bytes, 'image/png');
    expect(r.bytes.equals(bytes)).toBe(true);
    expect(r.mimeFinal).toBe('image/png');
  });

  it('passe-through WebP : bytes identiques + mimeFinal=image/webp', async () => {
    const conv = new ConvertisseurImageSharp();
    const bytes = await genererWebp();
    const r = await conv.convertirVersJpegSiNecessaire(bytes, 'image/webp');
    expect(r.bytes.equals(bytes)).toBe(true);
    expect(r.mimeFinal).toBe('image/webp');
  });

  it('HEIC corrompu → erreur métier explicite (pas crash serveur)', async () => {
    const conv = new ConvertisseurImageSharp();
    // Buffer minimal qui ressemble à un ftyp heic mais malformé
    const bytesCorrompus = Buffer.from([
      0, 0, 0, 32, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]);
    await expect(
      conv.convertirVersJpegSiNecessaire(bytesCorrompus, 'image/heic'),
    ).rejects.toThrow(/Conversion HEIC/);
  });
});
