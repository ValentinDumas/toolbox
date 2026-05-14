import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { ClockSysteme, ClockFixe } from '../../../src/domain/_shared/clock.js';

describe('Clock', () => {
  it('ClockSysteme.aujourdhui() retourne un Temporal.PlainDate', () => {
    const clock = new ClockSysteme();
    const date = clock.aujourdhui();
    expect(date).toBeInstanceOf(Temporal.PlainDate);
  });

  it("ClockFixe.du('2026-05-01').aujourdhui() égale Temporal.PlainDate.from('2026-05-01')", () => {
    const clock = ClockFixe.du('2026-05-01');
    const date = clock.aujourdhui();
    const attendu = Temporal.PlainDate.from('2026-05-01');
    expect(Temporal.PlainDate.compare(date, attendu)).toBe(0);
  });
});
