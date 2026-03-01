import { createClient } from '@supabase/supabase-js';
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  warnMissingSupabaseEnv,
} from '../../config/supabase';

warnMissingSupabaseEnv();

const projectRef = SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] : '';
export const AUTH_STORAGE_KEY = projectRef ? `sb-${projectRef}-auth-token` : '';

const storage = typeof window !== 'undefined' ? window.localStorage : undefined;

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: storage ?? undefined,
        storageKey: AUTH_STORAGE_KEY || undefined,
      },
    })
  : null;

if (supabase && typeof window !== 'undefined') {
  console.log('[supabase client] projectRef:', projectRef, 'storageKey:', AUTH_STORAGE_KEY || '(default)');
}
