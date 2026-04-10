import { useEffect, useState, useCallback } from 'react';
import { db, DBTask, DBCalendarEvent } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';
import { CalendarItem, TaskBlock, SyncedEvent } from '@/constants/calendarTypes';

/**
 * Fetches tasks + synced calendar events for a given date from Supabase.
 * Provides addTask, updateTask, deleteTask, markCompleted helpers.
 */
export function useCalendarItems(date: string): {
  items: CalendarItem[];
  loading: boolean;
  addTask: (task: Omit<TaskBlock, 'id'>) => Promise<void>;
  updateTask: (taskId: string, changes: Partial<TaskBlock>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  markCompleted: (taskId: string, completed: boolean) => Promise<void>;
  refresh: () => void;
} {
  const { user } = useAuth();
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    Promise.all([
      db.tasks()
        .select('*, subtasks(*)')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('completed', false)
        .order('start_minutes', { ascending: true, nullsFirst: false }),
      db.calendarEvents()
        .select('*')
        .eq('user_id', user.id)
        .eq('date', date)
        .eq('is_deleted', false)
        .order('start_minutes', { ascending: true }),
    ]).then(([tasksRes, eventsRes]) => {
      const calItems: CalendarItem[] = [];

      if (tasksRes.data) {
        (tasksRes.data as (DBTask & { subtasks: any[] })[]).forEach((row) => {
          if (row.start_minutes == null) return; // skip unscheduled tasks
          const block: TaskBlock = {
            id: row.id,
            title: row.title,
            startMinutes: row.start_minutes,
            endMinutes: row.end_minutes ?? row.start_minutes + row.duration_minutes,
            date: row.date,
            workType: row.work_type,
            priority: row.priority,
            isRecovery: row.is_recovery,
            completed: row.completed,
            subtasks: row.subtasks?.map((s: any) => ({
              title: s.title,
              durationMinutes: s.duration_minutes,
            })),
          };
          calItems.push({ type: 'task', data: block });
        });
      }

      if (eventsRes.data) {
        (eventsRes.data as DBCalendarEvent[]).forEach((row) => {
          if (row.is_all_day) return; // skip all-day events for timeline
          const event: SyncedEvent = {
            id: row.id,
            title: row.title,
            startMinutes: row.start_minutes,
            endMinutes: row.end_minutes,
            date: row.date,
            source: row.source,
          };
          calItems.push({ type: 'event', data: event });
        });
      }

      // Sort combined items by start time
      calItems.sort((a, b) => {
        const aStart = a.type === 'task' ? a.data.startMinutes : a.data.startMinutes;
        const bStart = b.type === 'task' ? b.data.startMinutes : b.data.startMinutes;
        return aStart - bStart;
      });

      setItems(calItems);
      setLoading(false);
    });
  }, [user, date, tick]);

  async function addTask(task: Omit<TaskBlock, 'id'>) {
    if (!user) return;
    await db.tasks().insert({
      user_id: user.id,
      title: task.title,
      work_type: task.workType,
      priority: task.priority,
      date: task.date,
      start_minutes: task.startMinutes,
      end_minutes: task.endMinutes,
      duration_minutes: task.endMinutes - task.startMinutes,
      is_recovery: task.isRecovery ?? false,
      completed: false,
      flexibility: 'today',
      is_procrastinated: false,
    });
    refresh();
  }

  async function updateTask(taskId: string, changes: Partial<TaskBlock>) {
    if (!user) return;
    const dbChanges: Record<string, unknown> = {};
    if (changes.title !== undefined) dbChanges.title = changes.title;
    if (changes.workType !== undefined) dbChanges.work_type = changes.workType;
    if (changes.priority !== undefined) dbChanges.priority = changes.priority;
    if (changes.startMinutes !== undefined) dbChanges.start_minutes = changes.startMinutes;
    if (changes.endMinutes !== undefined) dbChanges.end_minutes = changes.endMinutes;
    if (changes.completed !== undefined) dbChanges.completed = changes.completed;
    dbChanges.updated_at = new Date().toISOString();

    await db.tasks().update(dbChanges).eq('id', taskId).eq('user_id', user.id);
    refresh();
  }

  async function deleteTask(taskId: string) {
    if (!user) return;
    await db.tasks().delete().eq('id', taskId).eq('user_id', user.id);
    refresh();
  }

  async function markCompleted(taskId: string, completed: boolean) {
    await updateTask(taskId, { completed });
  }

  return { items, loading, addTask, updateTask, deleteTask, markCompleted, refresh };
}
