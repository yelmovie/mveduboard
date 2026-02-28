import { supabase } from './client';
import { generateUUID } from '../../utils/uuid';

type BetaEventName =
  | 'upload_success'
  | 'upload_blocked_daily_limit'
  | 'post_created'
  | 'login_success'
  | 'join_success';

const LS_KEY = 'edu_beta_events_local';
const LS_DISABLED_KEY = 'edu_beta_events_disabled';
const BETA_EVENTS_ENABLED = String(import.meta.env.VITE_BETA_EVENTS_ENABLED || '').toLowerCase() === 'true';

// generateUUID is imported from utils (uuid v4)

export const logBetaEvent = async (eventName: BetaEventName) => {
  if (!supabase) {
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Array<{
      name: BetaEventName;
      at: string;
    }>;
    existing.push({ name: eventName, at: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
    return { stored: 'local' as const };
  }
  if (!BETA_EVENTS_ENABLED) {
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Array<{
      name: BetaEventName;
      at: string;
    }>;
    existing.push({ name: eventName, at: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
    return { stored: 'local' as const };
  }
  if (localStorage.getItem(LS_DISABLED_KEY) === '1') {
    return { stored: 'local' as const };
  }

  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user?.id;
  if (!userId) {
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Array<{
      name: BetaEventName;
      at: string;
    }>;
    existing.push({ name: eventName, at: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
    return { stored: 'local' as const };
  }

  try {
    const { error } = await supabase.from('beta_events').insert({
      id: generateUUID(),
      user_id: userId,
      event_name: eventName,
      created_at: new Date().toISOString(),
    });
    if (error) {
      if (error.message?.includes('relation') || error.message?.includes('404')) {
        localStorage.setItem(LS_DISABLED_KEY, '1');
        return { stored: 'local' as const };
      }
      throw error;
    }
    return { stored: 'db' as const };
  } catch {
    const existing = JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Array<{
      name: BetaEventName;
      at: string;
    }>;
    existing.push({ name: eventName, at: new Date().toISOString() });
    localStorage.setItem(LS_KEY, JSON.stringify(existing));
    return { stored: 'local' as const };
  }
};

export const getLocalBetaEvents = () => {
  return JSON.parse(localStorage.getItem(LS_KEY) || '[]') as Array<{ name: BetaEventName; at: string }>;
};
