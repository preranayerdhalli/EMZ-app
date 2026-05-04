import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';

export interface WeekDayStat {
  day: string;          // 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  bodyBattery: number;  // 0-1
  recovery: number;     // 0-1
  workload: number;     // 0-1
}

const FALLBACK_WEEK: WeekDayStat[] = [
  { day: 'Mon', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Tue', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Wed', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Thu', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Fri', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Sat', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
  { day: 'Sun', bodyBattery: 0.50, recovery: 0.50, workload: 0.50 },
];

/** Returns Monday's date (YYYY-MM-DD) for the week containing the given date */
export function getWeekMonday(date?: Date): string {
  const d = date ?? new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return mon.toISOString().slice(0, 10);
}

export function useWeeklyStats(weekStart?: string): {
  weekData: WeekDayStat[];
  loading: boolean;
  refresh: () => void;
} {
  const { user } = useAuth();
  const [weekData, setWeekData] = useState<WeekDayStat[]>(FALLBACK_WEEK);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const monday = weekStart ?? getWeekMonday();

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      try {
        const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/weekly-stats?weekStart=${monday}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data: WeekDayStat[] = await res.json();
          if (Array.isArray(data) && data.length === 7) setWeekData(data);
        }
      } catch { /* Network error — keep fallback */ }

      setLoading(false);
    })();
  }, [user, monday, tick]);

  return { weekData, loading, refresh: () => setTick((t) => t + 1) };
}
