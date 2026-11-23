import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './format';

describe('date formatting', () => {
  it('runs on a UTC host, as production does', () => {
    // Guards the assertions below: on a machine set to IST they would pass even
    // without the fix they exist to protect.
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toMatch(/^(Etc\/)?UTC$/);
  });

  it('shows auction times in India time, not the host zone', () => {
    // 05:30 UTC is 11:00 in Kolkata.
    expect(formatDateTime('2026-12-10T05:30:00Z')).toMatch(/11:00\s?am/i);
  });

  it('rolls the calendar date at midnight IST, not midnight UTC', () => {
    // 20:00 UTC on 1 December is already 2 December in India.
    expect(formatDate('2026-12-01T20:00:00Z')).toBe(formatDate('2026-12-02T06:00:00Z'));
    expect(formatDate('2026-12-01T20:00:00Z')).not.toBe(formatDate('2026-12-01T06:00:00Z'));
  });
});
