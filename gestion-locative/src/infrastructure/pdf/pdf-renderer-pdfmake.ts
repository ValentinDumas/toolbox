import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pdfmake est un package CJS — import via createRequire depuis ESM.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfMakeLib = require('pdfmake') as {
  addFonts: (fonts: Record<string, unknown>) => void;
  createPdf: (docDef: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
  setUrlAccessPolicy: (cb: () => boolean) => void;
  setLocalAccessPolicy: (cb: () => boolean) => void;
};

// Polices Roboto présentes dans node_modules/pdfmake/fonts/Roboto/
const FONTS_DIR = path.resolve(__dirname, '../../../node_modules/pdfmake/fonts/Roboto');

pdfMakeLib.setUrlAccessPolicy(() => false);
pdfMakeLib.setLocalAccessPolicy(() => true);

pdfMakeLib.addFonts({
  Roboto: {
    normal: path.join(FONTS_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(FONTS_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(FONTS_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(FONTS_DIR, 'Roboto-MediumItalic.ttf'),
  },
});

export class PdfRendererPdfmake implements PdfRenderer {
  async genererBuffer(docDef: unknown): Promise<Buffer> {
    return pdfMakeLib.createPdf(docDef as TDocumentDefinitions).getBuffer();
  }
}
