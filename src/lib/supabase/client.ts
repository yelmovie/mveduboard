import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  warnMissingSupabaseEnv,
} from '../../config/supabase';

warnMissingSupabaseEnv();

const projectRef = SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] : '';
const authStorageKey = projectRef ? `sb-${projectRef}-auth-token` : undefined;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        ...(authStorageKey && { storageKey: authStorageKey }),
      },
    })
  : null;
