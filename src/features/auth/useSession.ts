import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { getErrorMessage } from '../../utils/errors';

export const useSession = () => {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) {
        setError(getErrorMessage(sessionError));
      }
      setSession(data.session);
      setUser(data.session?.user || null);
      setLoading(false);
    };
    init();

    if (supabase) {
      const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user || null);
      });
      return () => {
        mounted = false;
        listener.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  return { session, user, loading, error };
};
