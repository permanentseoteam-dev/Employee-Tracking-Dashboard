import { useEffect, useState } from 'react';
import { dataService } from '../services/dataService';
import type { BreakScheduleConfig } from '../types/roles';
import { DEFAULT_BREAK_SCHEDULE } from '../types/roles';
import { mergeBreakSchedule } from '../utils/breakSchedule';

export function useBreakSchedule(): {
  schedule: BreakScheduleConfig;
  loading: boolean;
  reload: () => Promise<void>;
} {
  const [schedule, setSchedule] = useState<BreakScheduleConfig>(() => mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE));
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const cfg = await dataService.getBreakScheduleConfig();
      setSchedule(mergeBreakSchedule(cfg));
    } catch {
      setSchedule(mergeBreakSchedule(DEFAULT_BREAK_SCHEDULE));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    const onUpdated = () => {
      reload();
    };
    window.addEventListener('stitch:break_schedule_updated', onUpdated);
    return () => window.removeEventListener('stitch:break_schedule_updated', onUpdated);
  }, []);

  return { schedule, loading, reload };
}
