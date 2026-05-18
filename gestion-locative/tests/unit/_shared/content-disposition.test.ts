import { describe, it, expect } from 'vitest';
import { encodeFilenameRFC6266 } from '../../../src/web/helpers/content-disposition.js';

describe('encodeFilenameRFC6266 (CR-05)', () => {
  it('ASCII sans accents', () => {
    expect(encodeFilenameRFC6266('facture.pdf')).toBe(
      "attachment; filename=\"facture.pdf\"; filename*=UTF-8''facture.pdf",
    );
  });
  it('accents : drop dans le fallback, percent-encode dans filename*', () => {
    const out = encodeFilenameRFC6266('été.pdf');
    expect(out).toContain('filename="ete.pdf"');
    expect(out).toContain("filename*=UTF-8''%C3%A9t%C3%A9.pdf");
  });
  it('guillemets et backslash purgés du fallback', () => {
    const out = encodeFilenameRFC6266('rapport "Q1".pdf');
    expect(out).toMatch(/filename="rapport _Q1_\.pdf"/);
  });
  it('caractères non-ASCII non-diacritique remplacés par _', () => {
    const out = encodeFilenameRFC6266('日本語.pdf');
    expect(out).toContain('filename="___.pdf"');
    expect(out).toContain("filename*=UTF-8''");
  });
});
