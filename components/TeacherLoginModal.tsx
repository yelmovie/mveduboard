
import React, { useState, useEffect } from 'react';
import { X, Lock, LogIn, UserPlus } from 'lucide-react';
import { logBetaEvent } from '../src/lib/supabase/events';
import { teacherSignIn, teacherSignUp, resendSignupConfirmation, getSession } from '../src/lib/supabase/auth';

interface TeacherLoginModalProps {
  onClose: () => void;
  onLoginSuccess: () => void;
  isSignup?: boolean;
}

export const TeacherLoginModal: React.FC<TeacherLoginModalProps> = ({ onClose, onLoginSuccess, isSignup = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [className, setClassName] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requiresEmailConfirmation, setRequiresEmailConfirmation] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    // Handle Supabase email confirmation errors from URL
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    const raw = `${hash}&${search}`;
    if (raw.includes('error=access_denied') && raw.includes('otp_expired')) {
      setError('인증 링크가 만료되었습니다. 인증 메일을 다시 보내주세요.');
      setShowResendButton(true);
      // Clean up URL to avoid repeat
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('LOGIN_CLICK', { isSignup, email: email ? `${email.slice(0, 2)}***` : '' });
    setError('');
    setSuccessMessage('');
    setRequiresEmailConfirmation(false);
    setShowResendButton(false);

    try {
      if (isSignup) {
        if (!teacherName.trim() || !schoolName.trim() || !className.trim()) {
          setError('성함, 학교명, 학급명을 입력해주세요.');
          return;
        }
        const result = await teacherSignUp(
          email,
          password,
          schoolName.trim(),
          className.trim(),
          teacherName.trim()
        );
        
        if (result.requiresEmailConfirmation) {
          // Mode B: Email confirmation required
          setSuccessMessage('가입 완료! 이메일 인증 후 로그인하면 학급이 생성됩니다.');
          setRequiresEmailConfirmation(true);
          return; // Don't close modal, show success message and login button
        } else {
          // Mode A: Immediate success — 세션 검증 후에만 대시보드 진입
          const session = await getSession();
          if (!session) {
            setError('세션이 저장되지 않았습니다. 개발자도구(F12) → Network 탭에서 /auth/v1/token 요청의 status(200/401 등)를 확인해주세요.');
            return;
          }
          await logBetaEvent('login_success');
          onLoginSuccess();
          onClose();
        }
      } else {
        console.log('LOGIN_CLICK → teacherSignIn(비밀번호 로그인) 호출 직전');
        await teacherSignIn(email, password);
        const session = await getSession();
        if (!session) {
          setError('세션이 저장되지 않았습니다. 개발자도구(F12) → Network 탭에서 /auth/v1/token 요청의 status(200/401 등)를 확인해주세요.');
          return;
        }
        await logBetaEvent('login_success');
        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      const errorMessage = err.message || '로그인에 실패했습니다.';
      // Handle rate limit errors specifically
      if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || errorMessage.includes('요청이 너무 많습니다')) {
        setError('요청이 너무 많습니다. 1분 후 다시 시도해주세요.');
      } else if (
        errorMessage.includes('Email not confirmed') ||
        errorMessage.includes('이메일 인증') ||
        errorMessage.includes('otp_expired') ||
        errorMessage.includes('access_denied')
      ) {
        setError('이메일 인증이 필요합니다. 받은 편지함에서 인증을 완료해주세요.');
        setShowResendButton(true);
      } else {
        setError(errorMessage);
      }
      console.error('Login error:', err);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    try {
      await resendSignupConfirmation(email.trim());
      setSuccessMessage('인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.');
      setError('');
    } catch (err: any) {
      setError(err.message || '인증 메일 재전송에 실패했습니다.');
    }
  };

  const handleSwitchToLogin = () => {
    setRequiresEmailConfirmation(false);
    setSuccessMessage('');
    setError('');
    // Trigger parent to switch to login mode
    // For now, just close and let user click login button
    onClose();
  };

  const handleGoogleLogin = () => {
      setIsGoogleLoading(true);
      // Simulate network request for Google OAuth
      setTimeout(() => {
          setIsGoogleLoading(false);
          logBetaEvent('login_success');
          onLoginSuccess();
          onClose();
      }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-b-8 border-indigo-100 animate-fade-in-up overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
          <h2 className="font-hand text-xl text-indigo-900 font-bold flex items-center gap-2">
            {isSignup ? <UserPlus size={20} /> : <Lock size={20} />} 
            {isSignup ? '선생님 회원가입' : '선생님 로그인'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1 rounded-full shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="text-center">
             <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-inner">
                {isSignup ? <UserPlus size={36} /> : <LogIn size={36} />}
             </div>
             <p className="text-gray-500 text-sm font-medium">
                 {isSignup ? '새로운 학급을 만들어보세요' : '선생님 계정으로 시작하세요'}
             </p>
          </div>

          {/* Google Login Button */}
          <button 
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading}
            className="w-full bg-white border border-gray-300 text-gray-700 font-bold py-3 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isGoogleLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent"></div>
            ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
            )}
            <span>
                {isGoogleLoading 
                    ? (isSignup ? '가입 처리 중...' : '로그인 중...') 
                    : (isSignup ? 'Google 계정으로 가입하기' : 'Google 계정으로 시작하기')
                }
            </span>
          </button>

          <p className="text-xs text-gray-400 text-center">
            로그인 오류 시: F12 → Network 탭에서 <code className="bg-gray-100 px-1 rounded">/auth/v1/token</code> 또는 <code className="bg-gray-100 px-1 rounded">/auth/v1/authorize</code> 요청의 status(200/401 등)를 확인하세요.
          </p>
          <div className="flex items-center gap-3">
              <div className="h-px bg-gray-200 flex-1"></div>
              <span className="text-xs text-gray-400 font-medium">또는 비밀번호로 시작</span>
              <div className="h-px bg-gray-200 flex-1"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <input 
                type="email" 
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                }}
                placeholder="이메일 입력"
                className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-sans"
                required
                />
            </div>
            <div>
                <input 
                type="password" 
                value={password}
                onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                }}
                placeholder="비밀번호 입력"
                className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-mono placeholder:font-sans"
                required
                />
            </div>

            {isSignup && (
              <>
                <div>
                    <input 
                    type="text" 
                    value={teacherName}
                    onChange={(e) => {
                        setTeacherName(e.target.value);
                        setError('');
                    }}
                    placeholder="성함 (예: 김민수)"
                    className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-sans"
                    required
                    />
                </div>
                <div>
                    <input 
                    type="text" 
                    value={schoolName}
                    onChange={(e) => {
                        setSchoolName(e.target.value);
                        setError('');
                    }}
                    placeholder="학교명 (예: 나봄초등학교)"
                    className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-sans"
                    required
                    />
                </div>
                <div>
                    <input 
                    type="text" 
                    value={className}
                    onChange={(e) => {
                        setClassName(e.target.value);
                        setError('');
                    }}
                    placeholder="학급명 (예: 3학년 2반)"
                    className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-sans"
                    required
                    />
                </div>
              </>
            )}
            
            {error && <p className="text-red-500 text-sm text-center font-bold bg-red-50 py-2 rounded-lg animate-pulse">{error}</p>}
            {showResendButton && (
              <button
                type="button"
                onClick={handleResendConfirmation}
                className="w-full h-12 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50 hover:shadow transition-all"
              >
                인증 메일 다시 보내기
              </button>
            )}
            
            {successMessage && !requiresEmailConfirmation && (
              <p className="text-green-600 text-sm text-center font-bold bg-green-50 py-2 rounded-lg">{successMessage}</p>
            )}

            {requiresEmailConfirmation ? (
              <div className="space-y-3">
                <p className="text-indigo-600 text-sm text-center font-bold bg-indigo-50 py-3 rounded-lg">
                  {successMessage}
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToLogin}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 text-lg flex items-center justify-center gap-2"
                >
                  <LogIn size={18} />
                  로그인하러 가기
                </button>
              </div>
            ) : (
              <button
                type="submit"
                onClick={() => console.log('LOGIN_CLICK (버튼 onClick)')}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 text-lg"
              >
                  {isSignup ? '가입 완료' : '로그인'}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
