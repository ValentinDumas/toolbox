import { describe, it, expect } from 'vitest';
import { formaterTrimestreIRL } from '../../../src/helpers/format-trimestre-irl.js';

describe('formaterTrimestreIRL', () => {
  it("T28 '2026-T1' → '1er trimestre 2026'", () => {
    expect(formaterTrimestreIRL('2026-T1')).toBe('1er trimestre 2026');
  });
  it("T29 '2026-T2' → '2e trimestre 2026'", () => {
    expect(formaterTrimestreIRL('2026-T2')).toBe('2e trimestre 2026');
  });
  it("T30 '2026-T3' → '3e trimestre 2026'", () => {
    expect(formaterTrimestreIRL('2026-T3')).toBe('3e trimestre 2026');
  });
  it("T31 '2026-T4' → '4e trimestre 2026'", () => {
    expect(formaterTrimestreIRL('2026-T4')).toBe('4e trimestre 2026');
  });
  it("T32 'invalid' → 'invalid' (fallback)", () => {
    expect(formaterTrimestreIRL('invalid')).toBe('invalid');
  });
});
