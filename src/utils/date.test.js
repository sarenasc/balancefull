import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildDateRange,
  formatWeekday,
  getCuradoReleaseDate,
  hoursToWholeDays,
  isSunday,
} from './date';

describe('date utils', () => {
  it('adds days without shifting the calendar date', () => {
    expect(addDays('2026-03-12', 3)).toBe('2026-03-15');
  });

  it('rounds curado hours up to whole days', () => {
    expect(hoursToWholeDays(0)).toBe(0);
    expect(hoursToWholeDays(1)).toBe(1);
    expect(hoursToWholeDays(24)).toBe(1);
    expect(hoursToWholeDays(25)).toBe(2);
  });

  it('builds the release date from hours', () => {
    expect(getCuradoReleaseDate('2026-03-12', 48)).toBe('2026-03-14');
    expect(getCuradoReleaseDate('2026-03-12', 49)).toBe('2026-03-15');
  });

  it('builds a continuous date range', () => {
    expect(buildDateRange('2026-03-12', 3)).toEqual([
      '2026-03-12',
      '2026-03-13',
      '2026-03-14',
    ]);
  });

  it('detects Sundays and formats weekdays', () => {
    expect(isSunday('2026-03-15')).toBe(true);
    expect(isSunday('2026-03-16')).toBe(false);
    expect(formatWeekday('2026-03-18')).toBe('Mié');
  });
});
