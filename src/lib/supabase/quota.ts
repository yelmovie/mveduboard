import { supabase } from './client';
import { DAILY_IMAGE_LIMIT } from '../../constants/limits';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

export const checkAndIncrementDailyQuota = async (userId: string) => {
  if (!supabase) {
    return { allowed: false, reason: 'not_configured' as const };
  }

  const today = getTodayKey();
  const { data: existing, error: selectError } = await supabase
    .from('upload_quota_daily')
    .select('count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle();

  if (selectError) {
    return { allowed: false, reason: 'query_failed' as const };
  }

  const currentCount = existing?.count ?? 0;
  if (currentCount >= DAILY_IMAGE_LIMIT) {
    return { allowed: false, reason: 'limit' as const, currentCount };
  }

  const { error: upsertError } = await supabase.from('upload_quota_daily').upsert(
    {
      user_id: userId,
      day: today,
      count: currentCount + 1,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,day' }
  );

  if (upsertError) {
    return { allowed: false, reason: 'upsert_failed' as const };
  }

  return { allowed: true, nextCount: currentCount + 1 };
};
