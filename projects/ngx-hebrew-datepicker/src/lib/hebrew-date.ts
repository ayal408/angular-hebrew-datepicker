/**
 * Hebrew-calendar helpers built on the browser's own ICU data
 * (Intl 'he-u-ca-hebrew'), so no calendar library is needed. Leap years
 * (Adar I / Adar II) come straight from ICU.
 *
 * Every Date here is a UTC-noon date for one calendar day, which keeps day
 * arithmetic clear of DST and time-zone edges. Values cross the public API
 * as ISO strings (YYYY-MM-DD).
 */

const DAY_MS = 86_400_000;

const partsFormat = new Intl.DateTimeFormat('he-u-ca-hebrew', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

export interface HebrewParts {
  day: number;
  /** Hebrew month name as ICU spells it, e.g. "תשרי", "אדר ב׳". */
  month: string;
  year: number;
}

export function fromIso(iso: string | null | undefined): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCMonth() === m - 1 ? date : null;
}

export function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

const partsCache = new Map<number, HebrewParts>();

export function hebrewParts(date: Date): HebrewParts {
  const key = date.getTime();
  const cached = partsCache.get(key);
  if (cached) return cached;
  let day = 0, month = '', year = 0;
  for (const part of partsFormat.formatToParts(date)) {
    if (part.type === 'day') day = Number(part.value);
    else if (part.type === 'month') month = part.value;
    else if (part.type === 'year') year = Number(part.value);
  }
  const parts = { day, month, year };
  if (partsCache.size > 4000) partsCache.clear();
  partsCache.set(key, parts);
  return parts;
}

export function startOfHebrewMonth(date: Date): Date {
  return addDays(date, 1 - hebrewParts(date).day);
}

export function nextHebrewMonth(monthStart: Date): Date {
  // Hebrew months have 29 or 30 days, so day 31 is always in the next month.
  return startOfHebrewMonth(addDays(monthStart, 30));
}

export function prevHebrewMonth(monthStart: Date): Date {
  return startOfHebrewMonth(addDays(monthStart, -1));
}

/** Every day of the Hebrew month that starts at monthStart. */
export function daysOfHebrewMonth(monthStart: Date): Date[] {
  const { month } = hebrewParts(monthStart);
  const days: Date[] = [];
  for (let d = monthStart; hebrewParts(d).month === month; d = addDays(d, 1)) days.push(d);
  return days;
}

/** First day of each month of the Hebrew year containing `date` (Tishrei first). */
export function monthsOfHebrewYear(date: Date): Date[] {
  const year = hebrewParts(date).year;
  let start = startOfHebrewMonth(date);
  while (hebrewParts(prevHebrewMonth(start)).year === year) start = prevHebrewMonth(start);
  const months: Date[] = [];
  for (let m = start; hebrewParts(m).year === year; m = nextHebrewMonth(m)) months.push(m);
  return months;
}

/**
 * The month named like `monthStart` in `targetYear`. A month that the
 * target year doesn't have (Adar I/II vs. plain Adar) falls back to the
 * nearest month.
 */
export function sameMonthInYear(monthStart: Date, targetYear: number): Date {
  const { month, year } = hebrewParts(monthStart);
  let guess = startOfHebrewMonth(addDays(monthStart, Math.round((targetYear - year) * 365.2468)));
  const months = monthsOfHebrewYear(guess);
  const exact = months.find((m) => hebrewParts(m).month === month);
  if (exact) return exact;
  // Adar in a non-leap year <-> Adar I / II in a leap year.
  const adar = months.find((m) => hebrewParts(m).month.startsWith('אדר'));
  return adar ?? guess;
}

const ONES = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
const HUNDREDS = ['', 'ק', 'ר', 'ש', 'ת', 'תק', 'תר', 'תש', 'תת', 'תתק'];

/** Hebrew-letter numeral (gematria) for 1..999, with geresh/gershayim. */
export function gematria(value: number): string {
  let n = value % 1000;
  let letters = HUNDREDS[Math.floor(n / 100)];
  n %= 100;
  if (n === 15) letters += 'טו';
  else if (n === 16) letters += 'טז';
  else letters += TENS[Math.floor(n / 10)] + ONES[n % 10];
  if (letters.length === 1) return letters + '׳';
  return letters.slice(0, -1) + '״' + letters.slice(-1);
}

/** e.g. "כ״ח בתשרי תשפ״ז" */
export function formatHebrew(date: Date): string {
  const { day, month, year } = hebrewParts(date);
  return `${gematria(day)} ב${month} ${gematria(year)}`;
}

export function formatGregorian(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getUTCFullYear()}`;
}
