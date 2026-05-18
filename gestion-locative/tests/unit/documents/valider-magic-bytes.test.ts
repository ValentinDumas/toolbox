import { describe, expect, it } from 'vitest';

import { validerMagicBytes } from '../../../src/application/documents/valider-magic-bytes.js';

function magicPdf(): Buffer {
  return Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
}

function magicJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function magicPng(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function magicWebp(): Buffer {
  // RIFF....WEBP
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46,
    0x00, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50,
  ]);
}

function magicHeic(brand: string): Buffer {
  const buffer = Buffer.alloc(12);
  // ftyp at offset 4
  buffer[4] = 0x66;
  buffer[5] = 0x74;
  buffer[6] = 0x79;
  buffer[7] = 0x70;
  buffer.write(brand, 8, 'ascii');
  return buffer;
}

describe('validerMagicBytes — détection magic', () => {
  it('détecte application/pdf avec %PDF-', () => {
    const r = validerMagicBytes(magicPdf(), 'application/pdf');
    expect(r).toEqual({ ok: true, mimeFinal: 'application/pdf' });
  });

  it('détecte image/jpeg avec FF D8 FF', () => {
    const r = validerMagicBytes(magicJpeg(), 'image/jpeg');
    expect(r).toEqual({ ok: true, mimeFinal: 'image/jpeg' });
  });

  it('détecte image/png avec signature 8 bytes', () => {
    const r = validerMagicBytes(magicPng(), 'image/png');
    expect(r).toEqual({ ok: true, mimeFinal: 'image/png' });
  });

  it('détecte image/webp avec RIFF + WEBP croisé', () => {
    const r = validerMagicBytes(magicWebp(), 'image/webp');
    expect(r).toEqual({ ok: true, mimeFinal: 'image/webp' });
  });

  it.each(['heic', 'heix', 'mif1', 'msf1'] as const)(
    'détecte image/heic avec brand %s',
    (brand) => {
      const r = validerMagicBytes(magicHeic(brand), 'image/heic');
      expect(r).toEqual({ ok: true, mimeFinal: 'image/heic' });
    },
  );
});

describe('validerMagicBytes — rejets', () => {
  it("retourne { ok:false, raison:'format-non-accepte' } pour un buffer aléatoire", () => {
    const r = validerMagicBytes(
      Buffer.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01, 0x02]),
      'application/pdf',
    );
    expect(r).toEqual({ ok: false, raison: 'format-non-accepte' });
  });

  it("retourne { ok:false, raison:'mismatch' } quand magic JPEG mais mimeAnnonce=application/pdf (D-118)", () => {
    const r = validerMagicBytes(magicJpeg(), 'application/pdf');
    expect(r).toEqual({ ok: false, raison: 'mismatch' });
  });

  it('tolère image/jpg ↔ image/jpeg (variante non standard mais fréquente)', () => {
    const r = validerMagicBytes(magicJpeg(), 'image/jpg');
    expect(r).toEqual({ ok: true, mimeFinal: 'image/jpeg' });
  });

  it("retourne format-non-accepte pour un buffer trop court", () => {
    const r = validerMagicBytes(Buffer.from([0x25, 0x50]), 'application/pdf');
    expect(r).toEqual({ ok: false, raison: 'format-non-accepte' });
  });
});
