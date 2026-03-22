import { formatDistanceToNow, format, differenceInDays, parseISO } from 'date-fns';

export function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return '—';
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return '';
  }
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try {
    const target = parseISO(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return differenceInDays(target, now);
  } catch {
    return null;
  }
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Operating states for Talaria Transportation */
export const STATES = ['PA', 'OH', 'MD', 'NJ', 'MO', 'WV', 'UT', 'NV'] as const;
export type TalariaState = typeof STATES[number];

export const GROUP_COLORS = [
  '#579bfc', '#fdab3d', '#00c875', '#e2445c',
  '#a25ddc', '#0086c0', '#ff642e', '#c4c4c4',
];

export const PERSON_COLORS = [
  '#579bfc', '#00c875', '#fdab3d', '#e2445c',
  '#a25ddc', '#0086c0', '#ff642e', '#037f4c',
  '#9d50dd', '#225091',
];

/** Pick a consistent color for a person by their ID or name */
export function personColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return PERSON_COLORS[Math.abs(hash) % PERSON_COLORS.length];
}

/** Determine if a hex color is light (for text contrast) */
export function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}
