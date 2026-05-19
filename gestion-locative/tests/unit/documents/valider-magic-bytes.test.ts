import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

function magicWebp(subType: 'VP8 ' | 'VP8L' | 'VP8X' = 'VP8 '): Buffer {
  // RIFF....WEBP + subType (12..15) — CR-08 : sous-format obligatoire
  return Buffer.concat([
    Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, // taille placeholder
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]),
    Buffer.from(subType, 'ascii'), // VP8 / VP8L / VP8X
  ]);
}

function magicHeic(brand: string): Buffer {
  // box_size = 24 (0x00000018) — plausible, >= 16 && <= bytes.length
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(24, 0); // box_size
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

describe('CR-08 — WebP sous-format', () => {
  const RIFF = Buffer.from([0x52, 0x49, 0x46, 0x46]);
  const SIZE = Buffer.from([0x00, 0x00, 0x00, 0x10]); // 16 bytes placeholder
  const WEBP = Buffer.from('WEBP', 'ascii');

  it('accepte VP8  (lossy)', () => {
    const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8 ', 'ascii')]);
    expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
  });
  it('accepte VP8L (lossless)', () => {
    const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8L', 'ascii')]);
    expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
  });
  it('accepte VP8X (extended)', () => {
    const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('VP8X', 'ascii')]);
    expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: true, mimeFinal: 'image/webp' });
  });
  it('rejette RIFF+WEBP sans sous-format VP8 valide (CR-08 hybride)', () => {
    const buf = Buffer.concat([RIFF, SIZE, WEBP, Buffer.from('XXXX', 'ascii'), Buffer.alloc(1024)]);
    expect(validerMagicBytes(buf, 'image/webp')).toEqual({ ok: false, raison: 'format-non-accepte' });
  });
});

describe('CR-08 — HEIC box_size', () => {
  const FTYP = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'
  const BRAND_HEIC = Buffer.from('heic', 'ascii');

  it('rejette box_size = 0 (anormal)', () => {
    const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x00]), FTYP, BRAND_HEIC]);
    expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: false, raison: 'format-non-accepte' });
  });
  it('rejette box_size > bytes.length', () => {
    // box_size = 9999 mais buffer ne fait que 12 bytes
    const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x27, 0x0F]), FTYP, BRAND_HEIC]);
    expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: false, raison: 'format-non-accepte' });
  });
  it('accepte box_size = 24 plausible (HEIC valide)', () => {
    const buf = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), FTYP, BRAND_HEIC, Buffer.alloc(12)]);
    expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: true, mimeFinal: 'image/heic' });
  });
});

// ---------------------------------------------------------------------------
// G-HEIC-01 — brands ISOBMFF élargis
// ---------------------------------------------------------------------------

function magicHeicBrand(brand: string, boxSize = 24): Buffer {
  const buffer = Buffer.alloc(Math.max(boxSize, 24));
  buffer.writeUInt32BE(boxSize, 0);
  buffer[4] = 0x66; // f
  buffer[5] = 0x74; // t
  buffer[6] = 0x79; // y
  buffer[7] = 0x70; // p
  buffer.write(brand, 8, 'ascii');
  return buffer;
}

describe('G-HEIC-01 — brands ISOBMFF élargis', () => {
  it.each(['mif2', 'msf2', 'avif', 'avis', '1pic', 'mfsm', 'j2ki', 'j2is'] as const)(
    'accepte brand %s',
    (brand) => {
      const r = validerMagicBytes(magicHeicBrand(brand), 'image/heic');
      expect(r).toEqual({ ok: true, mimeFinal: 'image/heic' });
    },
  );
});

describe('G-HEIC-01 — large box (box_size === 1, largesize UInt64BE offset 8)', () => {
  const FTYP = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp'

  it('accepte large box avec largesize valide', () => {
    // box_size = 1 → large box ; largesize = 32 (fits in buffer)
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(1, 0);    // box_size = 1 (large box signal)
    FTYP.copy(buf, 4);          // ftyp
    buf.writeBigUInt64BE(32n, 8); // largesize = 32 (= buffer length)
    buf.write('heic', 16, 'ascii'); // brand at offset 16
    expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: true, mimeFinal: 'image/heic' });
  });

  it('rejette large box avec largesize > bytes.length', () => {
    const buf = Buffer.alloc(32);
    buf.writeUInt32BE(1, 0);
    FTYP.copy(buf, 4);
    buf.writeBigUInt64BE(9999n, 8); // largesize dépasse le buffer
    buf.write('heic', 16, 'ascii');
    expect(validerMagicBytes(buf, 'image/heic')).toEqual({ ok: false, raison: 'format-non-accepte' });
  });
});

describe('G-HEIC-01 — logger empreinte GSD_DEBUG_MAGIC_BYTES', () => {
  const originalEnv = process.env['GSD_DEBUG_MAGIC_BYTES'];

  beforeEach(() => {
    delete process.env['GSD_DEBUG_MAGIC_BYTES'];
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['GSD_DEBUG_MAGIC_BYTES'];
    } else {
      process.env['GSD_DEBUG_MAGIC_BYTES'] = originalEnv;
    }
  });

  it('appelle console.error quand GSD_DEBUG_MAGIC_BYTES=1', () => {
    process.env['GSD_DEBUG_MAGIC_BYTES'] = '1';
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    validerMagicBytes(magicHeicBrand('heic'), 'image/heic');
    expect(spy).toHaveBeenCalledWith('[magic-bytes] empreinte=', expect.any(String));
    spy.mockRestore();
  });

  it('ne appelle pas console.error quand GSD_DEBUG_MAGIC_BYTES non défini', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    validerMagicBytes(magicHeicBrand('heic'), 'image/heic');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
