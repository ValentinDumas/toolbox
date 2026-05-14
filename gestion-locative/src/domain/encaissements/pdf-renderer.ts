/**
 * Port PdfRenderer — abstraction de la génération PDF.
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer
 * le type `TDocumentDefinitions` de pdfmake (package infrastructure).
 * L'adapter infrastructure caste vers `TDocumentDefinitions` à l'entrée.
 *
 * Utilisé par :
 *   - Plan 02-02 : avis d'échéance (D-66 — on-the-fly, sans persistance)
 *   - Plan 02-04 : quittance de loyer (D-63 — PDF persisté local)
 *   - Plan 02-06 : mise en demeure (D-68 niveau 3)
 */
export interface PdfRenderer {
  genererBuffer(docDef: unknown): Promise<Buffer>;
}
