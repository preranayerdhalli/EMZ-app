/**
 * Recharge Windows library — music suggestions and box-breathing prompts.
 * URLs will be wired to backend storage; field is reserved for future use.
 */

export type MusicSuggestion = {
  id: string;
  title: string;
  mood: string;
  durationMin: number;
};

export type BreathingSuggestion = {
  id: string;
  pattern: string;
  intent: string;
  durationMin: number;
};

export const MUSIC_SUGGESTIONS: MusicSuggestion[] = [
  { id: 'm1', title: 'Lo-fi Chill Beats',     mood: 'Focus · Calm',          durationMin: 15 },
  { id: 'm2', title: 'Nature Sounds',          mood: 'Grounding · Restore',   durationMin: 20 },
  { id: 'm3', title: 'Binaural Alpha Waves',   mood: 'Deep Focus · Reset',    durationMin: 20 },
  { id: 'm4', title: 'Soft Ambient Piano',     mood: 'Calm · Recharge',       durationMin: 10 },
  { id: 'm5', title: 'Rain & White Noise',     mood: 'Soothe · Decompress',   durationMin: 15 },
  { id: 'm6', title: 'Meditation Flow',        mood: 'Mindful · Restore',     durationMin: 10 },
];

export const BREATHING_SUGGESTIONS: BreathingSuggestion[] = [
  { id: 'b1', pattern: '4 · 4 · 4 · 4', intent: 'Release tension, reset your mind',           durationMin: 5 },
  { id: 'b2', pattern: '4 · 4 · 4 · 4', intent: 'Ground yourself before the next sprint',     durationMin: 5 },
  { id: 'b3', pattern: '4 · 4 · 4 · 4', intent: 'Clear your head, restore your energy',       durationMin: 5 },
  { id: 'b4', pattern: '4 · 4 · 4 · 4', intent: 'Calm the nervous system, find your center',  durationMin: 5 },
  { id: 'b5', pattern: '4 · 4 · 4 · 4', intent: 'Soften your focus, breathe through the pressure', durationMin: 5 },
  { id: 'b6', pattern: '4 · 4 · 4 · 4', intent: 'Slow down to speed up — reset now',          durationMin: 5 },
];
