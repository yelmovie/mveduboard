import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { isSupabaseConfigured } from '../../config/supabase';
import { getLocalBetaEvents } from '../../lib/supabase/events';

export const HealthDebugPage: React.FC = () => {
  const [sessionStatus, setSessionStatus] = useState('확인 중...');
  const [profileStatus, setProfileStatus] = useState('확인 중...');
  const [eventCount, setEventCount] = useState<number | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!supabase) {
        setSessionStatus('Supabase 미설정');
        setProfileStatus('Supabase 미설정');
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const hasSession = Boolean(sessionData.session);
      setSessionStatus(hasSession ? '로그인됨' : '로그인 안됨');

      const { error: profileError } = await supabase.from('profiles').select('id').limit(1);
      setProfileStatus(profileError ? `실패: ${profileError.message}` : '성공');

      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { count } = await supabase
        .from('beta_events')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', since.toISOString());
      setEventCount(count ?? null);
    };
    run();
  }, []);

  const localEvents = getLocalBetaEvents();

  return (
    <div className="min-h-screen bg-[#FEF9E7] p-8 font-sans text-[#78350F]">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl border-2 border-[#FCD34D] p-8">
        <h1 className="text-2xl font-bold mb-6">/debug/health</h1>
        <div className="space-y-3 text-sm">
          <div>env loaded: {isSupabaseConfigured ? '✅' : '❌'}</div>
          <div>session: {sessionStatus}</div>
          <div>db query (profiles): {profileStatus}</div>
          <div>beta events (db, last 7 days): {eventCount ?? '확인 불가'}</div>
          <div>beta events (local): {localEvents.length}</div>
        </div>
      </div>
    </div>
  );
};
