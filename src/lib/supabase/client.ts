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

const storage =
  typeof window !== 'undefined' && window.localStorage
    ? {
        getItem: (key: string) => window.localStorage.getItem(key),
        setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
        removeItem: (key: string) => window.localStorage.removeItem(key),
      }
    : undefined;

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
  const urlForLog = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') : '';
  console.log('[supabase client] supabaseUrl:', urlForLog, 'projectRef:', projectRef, 'storageKey:', AUTH_STORAGE_KEY || '(default)');
}
