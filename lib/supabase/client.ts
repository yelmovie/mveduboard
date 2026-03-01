/** DEPRECATED: 사용처 없음. 앱은 src/lib/supabase/client.ts 단일 소스 사용. 삭제 시 grep 사용처 0건 확인. */
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config/supabase';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
