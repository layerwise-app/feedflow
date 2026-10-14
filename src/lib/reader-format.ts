import { DAY_MS, HOUR_MS } from './reader-model.ts';

// Display helpers shared by the reader, the demo, and the landing page.

const MONOGRAM_COLORS = ['#2340E0', '#B4462E', '#6B4FA0', '#9A6410', '#2F4256', '#A8365F'];

export function feedColor(name: string) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return MONOGRAM_COLORS[hash % MONOGRAM_COLORS.length];
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Cached en-US date formatter. Pass 'UTC' while hydrating so server and client render the same text. */
function dateFormatter(parts: 'short' | 'long' | 'year', timeZone?: string) {
  const key = `${parts}|${timeZone ?? ''}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    const options: Intl.DateTimeFormatOptions = parts === 'year'
      ? { year: 'numeric', timeZone }
      : { month: 'short', day: 'numeric', ...(parts === 'long' ? { year: 'numeric' } : {}), timeZone };
    formatter = new Intl.DateTimeFormat('en-US', options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

/** Compact age for story lists: "now", "12m", "5h", "3d", then a date. */
export function formatStoryAge(timestamp: number | undefined, now: number, fallback = '', timeZone?: string) {
  if (timestamp === undefined) return fallback;
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return 'now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / 60_000)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  if (elapsed < 7 * DAY_MS) return `${Math.floor(elapsed / DAY_MS)}d`;
  const date = new Date(timestamp);
  const year = dateFormatter('year', timeZone);
  const sameYear = year.format(date) === year.format(new Date(now));
  return dateFormatter(sameYear ? 'short' : 'long', timeZone).format(date);
}

/** Readable age for metadata such as "Fetched 5 min ago". */
export function formatAgo(timestamp: number | undefined, now: number, timeZone?: string) {
  if (timestamp === undefined) return 'Never';
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return 'Just now';
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / 60_000)} min ago`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)} h ago`;
  const days = Math.floor(elapsed / DAY_MS);
  return days === 1 ? 'Yesterday' : days < 7 ? `${days} days ago` : dateFormatter('long', timeZone).format(new Date(timestamp));
}

export function formatLongDate(timestamp: number | undefined, fallback = '', timeZone?: string) {
  return timestamp === undefined ? fallback : dateFormatter('long', timeZone).format(new Date(timestamp));
}
