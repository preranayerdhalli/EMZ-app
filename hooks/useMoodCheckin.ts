import { useCallback } from 'react';
import { db, invokeFunction } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';

const MOOD_SCORES: Record<string, number> = {
  '😄': 6, '🙂': 5, '😐': 4, '😕': 3, '😔': 2, '😢': 1,
};

interface CheckinInput {
  date: string;
  moodEmoji: string | null;
  notes: string;
  voiceTranscript?: string;
}

/**
 * Saves a mood check-in and triggers daily summary regeneration.
 * Fire-and-forget — callers don't need to await the summary trigger.
 */
export function useMoodCheckin(): {
  saveCheckin: (input: CheckinInput) => Promise<void>;
} {
  const { user } = useAuth();

  const saveCheckin = useCallback(async (input: CheckinInput) => {
    if (!user) return;

    const moodScore = input.moodEmoji ? (MOOD_SCORES[input.moodEmoji] ?? null) : null;

    const { error } = await db.moodCheckins().insert({
      user_id: user.id,
      date: input.date,
      checked_at: new Date().toISOString(),
      mood_emoji: input.moodEmoji,
      mood_score: moodScore,
      notes: input.notes || null,
      voice_transcript: input.voiceTranscript || null,
    });

    if (error) throw error;

    // Trigger daily summary recompute in background (don't block UI)
    invokeFunction('daily-summary', { date: input.date }).catch((e) =>
      console.warn('daily-summary trigger failed:', e),
    );
  }, [user]);

  return { saveCheckin };
}
