const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** true일 때만 auth 관련 상세 로그 출력(토큰/세션 정보 노출 방지) */
export const isAuthDebug = (): boolean =>
  Boolean(import.meta.env.DEV || import.meta.env.VITE_DEBUG_AUTH);

/** dev 전용: URL/ANON 존재·길이만 로그 (값은 절대 출력 금지) */
const logEnvGuard = () => {
  if (import.meta.env.DEV) {
    console.log('[supabase env] URL exists:', !!SUPABASE_URL, 'ANON key length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);
  }
};

const warnMissingSupabaseEnv = () => {
  logEnvGuard();
  if (!isSupabaseConfigured) {
    const msg = 'Supabase 환경변수가 설정되지 않았습니다. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인하세요.';
    if (import.meta.env.DEV) {
      throw new Error(msg);
    }
    console.warn('[Supabase]', msg);
  }
};

export { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured, warnMissingSupabaseEnv };
