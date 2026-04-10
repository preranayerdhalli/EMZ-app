/**
 * Calendar screen types — aligned with .cursor/rules and spec.
 */
import { palette } from './theme';

export type DayLoad = 'heavy' | 'good' | 'neutral';

export type WorkType = 'deep' | 'creative' | 'admin' | 'chore' | 'recovery' | 'learning' | 'social';

export type Priority = 'high' | 'medium' | 'low';

export type CalendarSource = 'google' | 'microsoft' | 'apple';

export type DayViewMode = 'your-day' | 'suggested-day';

export interface DayLoadDots {
  morning: boolean;
  afternoon: boolean;
  evening: boolean;
}

export interface SyncedEvent {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  date: string; // YYYY-MM-DD
  source: CalendarSource;
}

export interface TaskBlock {
  id: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  date: string;
  workType: WorkType;
  priority: Priority;
  isRecovery?: boolean;
  completed?: boolean;
  /** For "Putting This Off" tasks shown on home */
  subtasks?: { title: string; durationMinutes: number }[];
}

export type CalendarItem = 
  | { type: 'event'; data: SyncedEvent }
  | { type: 'task'; data: TaskBlock };

export const WORK_TYPE_BORDER: Record<WorkType, string> = {
  deep: '#FF8A3D',     // warm orange
  creative: '#2F5D8C', // deep blue (creative signal, premium)
  admin: '#B8B0A6',    // warm grey (neutral, non-corporate)
  chore: '#6FA66A',    // moss green
  recovery: palette.accentYellow,
  learning: '#D48A6A', // clay / terracotta
  social: '#FFB36B',   // apricot
};

/**
 * Shared work-type gradients for charts and chips.
 * Keep this as the single source of truth for “type color language”.
 */
export const WORK_TYPE_GRADIENT: Record<WorkType, [string, string]> = {
  deep: ['#FF8A3D', '#FFB86C'],
  creative: ['#2F5D8C', '#73A7D1'],
  admin: ['#B8B0A6', '#D6CFC6'],
  chore: ['#6FA66A', '#A5D66F'],
  recovery: [palette.accentYellow, '#FFE88A'],
  learning: ['#D48A6A', '#F0B08F'],
  social: ['#FFB36B', '#FFD1A3'],
};

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  deep: 'Deep Work',
  creative: 'Creative',
  admin: 'Admin',
  chore: 'Chore',
  recovery: 'Recovery',
  learning: 'Learning',
  social: 'Social',
};

export const SOURCE_LABEL: Record<CalendarSource, string> = {
  google: 'G',
  microsoft: 'M',
  apple: 'A',
};

/** Full name for calendar source (e.g. in Day view). */
export const SOURCE_NAME: Record<CalendarSource, string> = {
  google: 'Google',
  microsoft: 'Outlook',
  apple: 'iCloud',
};

/** Single colour for all synced calendar events (read-only). */
export const CALENDAR_EVENT_COLOR = {
  bg: 'rgba(58,51,43,0.55)',
  border: 'rgba(255,215,0,0.55)',
} as const;
