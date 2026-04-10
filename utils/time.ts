/**
 * Shared time-formatting utilities used across calendar and home screen.
 */

/** "9:00 AM" — padded minutes, space before period */
export function fmtTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const period = h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "9 AM" / "12 PM" — compact, no minutes, for hour-grid labels */
export function hourLabel(h: number): string {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

/** "9am" / "9:30am" — compact, no space before period, used on home screen */
export function fmtTimeCompact(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const period = h >= 12 ? 'pm' : 'am';
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}
