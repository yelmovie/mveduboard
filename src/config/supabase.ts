const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** true일 때만 auth 관련 상세 로그 출력(토큰/세션 정보 노출 방지) */
export const isAuthDebug = (): boolean =>
  Boolean(import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH);

const warnMissingSupabaseEnv = () => {
  if (import.meta.env.DEV) {
    console.log('[supabase] url set?', !!SUPABASE_URL, 'anon set?', !!SUPABASE_ANON_KEY);
  }
  if (!isSupabaseConfigured) {
    console.warn(
      '[Supabase] 환경변수가 설정되지 않았습니다. VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 확인하세요.'
    );
  }
};

export { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured, warnMissingSupabaseEnv };
