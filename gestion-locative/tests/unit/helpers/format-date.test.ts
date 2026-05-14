import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { formatDate } from '../../../src/helpers/format-date.js';

describe('formatDate', () => {
  it("formatDate(PlainDate(2026, 6, 12)) retourne '12/06/2026'", () => {
    const date = new Temporal.PlainDate(2026, 6, 12);
    expect(formatDate(date)).toBe('12/06/2026');
  });

  it("formatDate(PlainDate(2026, 1, 5)) retourne '05/01/2026' (zero-padded)", () => {
    const date = new Temporal.PlainDate(2026, 1, 5);
    expect(formatDate(date)).toBe('05/01/2026');
  });

  it("formatDate(null) retourne '—'", () => {
    expect(formatDate(null)).toBe('—');
  });

  it('formatDate(Temporal.Now.plainDateISO()) retourne format DD/MM/YYYY today', () => {
    const today = Temporal.Now.plainDateISO();
    const result = formatDate(today);
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});
