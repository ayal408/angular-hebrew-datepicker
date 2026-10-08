import {
  daysOfHebrewMonth, formatHebrew, fromIso, gematria, hebrewParts, monthsOfHebrewYear, sameMonthInYear,
  startOfHebrewMonth, toIso,
} from './hebrew-date';

describe('hebrew-date', () => {
  it('writes gematria with geresh / gershayim and the 15/16 exceptions', () => {
    expect(gematria(1)).toBe('א׳');
    expect(gematria(15)).toBe('ט״ו');
    expect(gematria(16)).toBe('ט״ז');
    expect(gematria(28)).toBe('כ״ח');
    expect(gematria(30)).toBe('ל׳');
    expect(gematria(5787)).toBe('תשפ״ז');
  });

  it('converts Gregorian dates to Hebrew dates', () => {
    expect(formatHebrew(fromIso('2026-09-12')!)).toBe('א׳ בתשרי תשפ״ז'); // Rosh Hashana 5787
    expect(formatHebrew(fromIso('2026-10-09')!)).toBe('כ״ח בתשרי תשפ״ז');
    expect(hebrewParts(fromIso('2027-03-15')!).month).toBe('אדר ב׳');
  });

  it('round-trips ISO strings and rejects invalid ones', () => {
    expect(toIso(fromIso('2026-02-28')!)).toBe('2026-02-28');
    expect(fromIso('2026-02-30')).toBeNull();
    expect(fromIso('not a date')).toBeNull();
  });

  it('lists 13 months in a leap year and 12 otherwise', () => {
    expect(monthsOfHebrewYear(fromIso('2026-10-09')!).length).toBe(13); // 5787
    expect(monthsOfHebrewYear(fromIso('2027-10-09')!).length).toBe(12); // 5788
  });

  it('gives each month 29 or 30 days, starting on day 1', () => {
    for (const month of monthsOfHebrewYear(fromIso('2026-10-09')!)) {
      const days = daysOfHebrewMonth(month);
      expect([29, 30]).toContain(days.length);
      expect(hebrewParts(days[0]).day).toBe(1);
    }
  });

  it('maps Adar II to plain Adar when the target year is not a leap year', () => {
    const adar2 = startOfHebrewMonth(fromIso('2027-03-15')!);
    const target = sameMonthInYear(adar2, 5788);
    expect(hebrewParts(target)).toEqual({ day: 1, month: 'אדר', year: 5788 });
  });
});

