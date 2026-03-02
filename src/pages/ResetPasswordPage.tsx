import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { getSession, updatePassword, teacherSignOut } from '../lib/supabase/auth';

const MIN_PASSWORD_LENGTH = 6;

export function ResetPasswordPage() {
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setHasRecoverySession(true);
      }
      setReady(true);
    });

    getSession()
      .then((s) => {
        if (cancelled) return;
        if (s) {
          setHasRecoverySession(true);
          setReady(true);
        }
      })
      .catch(() => {});

    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 3000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      await teacherSignOut();
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-gray-500">로딩 중…</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
            <Lock size={32} />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">비밀번호가 변경되었습니다</h1>
          <p className="text-gray-600 mb-6">새 비밀번호로 로그인해주세요.</p>
          <a
            href="/"
            className="inline-block w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center"
          >
            로그인하러 가기
          </a>
        </div>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">유효하지 않거나 만료된 링크입니다</h1>
          <p className="text-gray-600 mb-6">비밀번호 재설정 메일을 다시 요청해주세요.</p>
          <a
            href="/"
            className="inline-block w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center"
          >
            홈으로
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Lock className="text-indigo-600" size={28} />
          <h1 className="text-xl font-bold text-gray-800">새 비밀번호 설정</h1>
        </div>
        <p className="text-gray-600 text-sm mb-4">새 비밀번호를 입력하세요. (최소 {MIN_PASSWORD_LENGTH}자)</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="새 비밀번호"
            className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setError(''); }}
            placeholder="비밀번호 확인"
            className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
          />
          {error && (
            <p className="text-red-600 text-sm text-center bg-red-50 py-2 rounded-lg">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-70"
          >
            {loading ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  );
}
