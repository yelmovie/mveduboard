/** DEPRECATED: 사용처 없음. 앱은 src/config/supabase.ts 사용. */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const warnIfSupabaseMissing = () => {
  if (!isSupabaseConfigured) {
    console.warn('[Supabase] 환경변수가 설정되지 않았습니다. .env.local을 확인해주세요.');
  }
};

export { SUPABASE_URL, SUPABASE_ANON_KEY };
