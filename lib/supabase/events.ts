import { isSupabaseConfigured } from '../../config/supabase';
import { supabase } from './client';

type BetaEventType =
  | 'upload_success'
  | 'upload_blocked_daily_limit'
  | 'post_created'
  | 'login_success'
  | 'join_success';

const LOCAL_EVENT_KEY = 'edu_beta_events';

export const logBetaEvent = async (eventType: BetaEventType, meta?: Record<string, unknown>) => {
  if (!isSupabaseConfigured) {
    const stored = localStorage.getItem(LOCAL_EVENT_KEY);
    const items = stored ? JSON.parse(stored) : [];
    items.push({ eventType, meta, createdAt: new Date().toISOString() });
    localStorage.setItem(LOCAL_EVENT_KEY, JSON.stringify(items));
    return;
  }

  try {
    const session = await supabase.auth.getSession();
    const userId = session.data.session?.user?.id || null;
    await supabase.from('beta_events').insert({
      event_type: eventType,
      user_id: userId,
      meta: meta || null,
    });
  } catch (error) {
    console.warn('[BetaEvent] 기록 실패', error);
  }
};
