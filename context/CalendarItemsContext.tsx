import React, { createContext, useCallback, useContext, useState } from 'react';
import type { CalendarItem, TaskBlock } from '@/constants/calendarTypes';

type CalendarItemsContextValue = {
  items: CalendarItem[];
  setItems: React.Dispatch<React.SetStateAction<CalendarItem[]>>;
  markTaskCompleted: (taskId: string) => void;
};

const CalendarItemsContext = createContext<CalendarItemsContextValue | null>(null);

const todayStr = () => new Date().toISOString().slice(0, 10);

const DEFAULT_ITEMS: CalendarItem[] = [
  {
    type: 'event',
    data: {
      id: 'e1',
      title: 'Team standup',
      startMinutes: 9 * 60,
      endMinutes: 9 * 60 + 30,
      date: todayStr(),
      source: 'google',
    },
  },
  {
    type: 'task',
    data: {
      id: 't1',
      title: 'Conduct research for penguin growth',
      startMinutes: 10 * 60,
      endMinutes: 12 * 60,
      date: todayStr(),
      workType: 'deep',
      priority: 'high',
    },
  },
  {
    type: 'task',
    data: {
      id: 't2',
      title: 'Review emails',
      startMinutes: 14 * 60,
      endMinutes: 14 * 60 + 30,
      date: todayStr(),
      workType: 'admin',
      priority: 'low',
    },
  },
  {
    type: 'task',
    data: {
      id: 't3',
      title: 'Plan next sprint',
      startMinutes: 15 * 60,
      endMinutes: 16 * 60,
      date: todayStr(),
      workType: 'admin',
      priority: 'medium',
    },
  },
  {
    type: 'task',
    data: {
      id: 't_recovery_1',
      title: 'Calm your nervous system',
      startMinutes: 13 * 60 + 30,
      endMinutes: 14 * 60,
      date: todayStr(),
      workType: 'recovery',
      priority: 'low',
    },
  },
  {
    type: 'task',
    data: {
      id: 't4',
      title: 'Sort out rental lease',
      startMinutes: 1080,
      endMinutes: 1125,
      date: todayStr(),
      workType: 'admin',
      priority: 'low',
    },
  },
  {
    type: 'task',
    data: {
      id: 't5',
      title: 'Intro to Calculus',
      startMinutes: 16 * 60,
      endMinutes: 17 * 60,
      date: todayStr(),
      workType: 'learning',
      priority: 'medium',
    },
  },
];

export function CalendarItemsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CalendarItem[]>(() => DEFAULT_ITEMS);

  const markTaskCompleted = useCallback((taskId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.type === 'task' && item.data.id === taskId
          ? { ...item, data: { ...item.data, completed: true } }
          : item
      )
    );
  }, []);

  return (
    <CalendarItemsContext.Provider value={{ items, setItems, markTaskCompleted }}>
      {children}
    </CalendarItemsContext.Provider>
  );
}

export function useCalendarItems(): CalendarItemsContextValue {
  const ctx = useContext(CalendarItemsContext);
  if (!ctx) throw new Error('useCalendarItems must be used within CalendarItemsProvider');
  return ctx;
}
