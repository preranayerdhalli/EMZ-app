import { useEffect, useState } from 'react';
import { db, DBDailySummary } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';

export interface DailySummaryData {
  summaryText: string;
  capacityScore: number;       // 0-1
  taskCount: number;
  meetingMinutes: number;
  recommendations: Array<{ type: string; text: string }>;
}

const DEFAULT_SUMMARY: DailySummaryData = {
  summaryText: 'Sync your health data to see your personalised energy summary.',
  capacityScore: 0.5,
  taskCount: 0,
  meetingMinutes: 0,
  recommendations: [],
};

export function useDailySummary(date: string): {
  summary: DailySummaryData;
  loading: boolean;
} {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DailySummaryData>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    db.dailySummaries()
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const row = data as DBDailySummary;
          setSummary({
            summaryText: row.summary_text,
            capacityScore: row.capacity_score ?? 0.5,
            taskCount: row.task_count ?? 0,
            meetingMinutes: row.meeting_minutes ?? 0,
            recommendations: row.recommendations_json ?? [],
          });
        }
        setLoading(false);
      });
  }, [user, date]);

  return { summary, loading };
}
