import React, { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { requestPasswordReset } from '../src/lib/supabase/auth';

interface ResetPasswordRequestModalProps {
  onClose: () => void;
}

export const ResetPasswordRequestModal: React.FC<ResetPasswordRequestModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage('이메일을 입력해주세요.');
      setIsError(true);
      return;
    }
    setLoading(true);
    setMessage('');
    setIsError(false);
    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message);
      setIsError(!result.ok);
      if (result.ok) setEmail('');
    } catch {
      setMessage('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setIsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border-b-8 border-indigo-100 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50">
          <h2 className="font-hand text-xl text-indigo-900 font-bold flex items-center gap-2">
            <Mail size={20} /> 비밀번호 재설정
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-1 rounded-full shadow-sm">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-4">
          <p className="text-gray-600 text-sm">
            가입 시 사용한 이메일을 입력하시면, 재설정 링크를 보내드립니다.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setMessage(''); }}
              placeholder="이메일 주소"
              className="w-full text-center text-lg p-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none transition-all font-sans"
              required
              autoComplete="email"
            />
            {message && (
              <p className={`text-sm text-center py-2 rounded-lg ${isError ? 'text-red-600 bg-red-50' : 'text-green-700 bg-green-50'}`}>
                {message}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-12 border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-70"
              >
                {loading ? '전송 중…' : '메일 보내기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
