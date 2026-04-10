import { useEffect, useState } from 'react';
import { db, DBEnergyForecast, EnergyLevel, WorkType } from '@/services/supabase';
import { useAuth } from '@/context/AuthContext';

export interface HourlyEnergyData {
  energyLevel: EnergyLevel;
  suggestedWorkType: WorkType;
  isMicroBreak: boolean;
}

/**
 * Returns energy forecast for every hour of a given date.
 * Falls back to a moderate-energy default when no data is synced yet.
 */
export function useEnergy(date: string): {
  energyByHour: Record<number, HourlyEnergyData>;
  loading: boolean;
} {
  const { user } = useAuth();
  const [energyByHour, setEnergyByHour] = useState<Record<number, HourlyEnergyData>>(
    buildFallback(),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    setLoading(true);
    db.energyForecasts()
      .select('hour, energy_level, suggested_work_type, is_micro_break')
      .eq('user_id', user.id)
      .eq('date', date)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          const map: Record<number, HourlyEnergyData> = {};
          (data as DBEnergyForecast[]).forEach((row) => {
            map[row.hour] = {
              energyLevel: row.energy_level,
              suggestedWorkType: row.suggested_work_type,
              isMicroBreak: row.is_micro_break,
            };
          });
          setEnergyByHour(map);
        }
        // If no data yet, keep fallback values
        setLoading(false);
      });
  }, [user, date]);

  return { energyByHour, loading };
}

/** Moderate fallback used before first health sync */
function buildFallback(): Record<number, HourlyEnergyData> {
  const fallback: Record<number, HourlyEnergyData> = {};
  for (let h = 7; h <= 21; h++) {
    fallback[h] = { energyLevel: 'moderate', suggestedWorkType: 'admin', isMicroBreak: false };
  }
  return fallback;
}
