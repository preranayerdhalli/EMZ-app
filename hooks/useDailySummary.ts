import { useCallback, useEffect, useState } from 'react';
import { db, DBDailySummary } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';

export type SummaryFeedback = 'up' | 'down';

export interface DailySummaryData {
  summaryText: string;
  capacityScore: number;
  taskCount: number;
  meetingMinutes: number;
  recommendations: Array<{ type: string; text: string }>;
  feedback: SummaryFeedback | null;
}

const DEFAULT_SUMMARY: DailySummaryData = {
  summaryText: 'Sync your health data to see your personalised energy summary.',
  capacityScore: 0.5,
  taskCount: 0,
  meetingMinutes: 0,
  recommendations: [],
  feedback: null,
};

function rowToData(row: DBDailySummary): DailySummaryData {
  return {
    summaryText:     row.summary_text,
    capacityScore:   row.capacity_score ?? 0.5,
    taskCount:       row.task_count ?? 0,
    meetingMinutes:  row.meeting_minutes ?? 0,
    recommendations: row.recommendations_json ?? [],
    feedback:        row.feedback ?? null,
  };
}

export function useDailySummary(date: string): {
  summary: DailySummaryData;
  loading: boolean;
  submitFeedback: (value: SummaryFeedback) => Promise<void>;
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
        if (!error && data) setSummary(rowToData(data as DBDailySummary));
        setLoading(false);
      });
  }, [user, date]);

  const submitFeedback = useCallback(async (value: SummaryFeedback) => {
    if (!user) return;
    // Optimistic update
    setSummary((prev) => ({ ...prev, feedback: value }));
    await db.dailySummaries()
      .update({ feedback: value, feedback_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('date', date);
  }, [user, date]);

  return { summary, loading, submitFeedback };
}
