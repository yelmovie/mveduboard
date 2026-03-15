import React, { useState } from 'react';
import { X, UserCircle } from 'lucide-react';
import * as api from '../services/boardService';
import * as studentService from '../services/studentService';
import { Participant } from '../types';
import { studentJoinWithCode } from '../src/lib/supabase/auth';
import { logBetaEvent } from '../src/lib/supabase/events';
import { generateUUID } from '../src/utils/uuid';

interface StudentLoginModalProps {
  onClose: () => void;
  onLoginSuccess: (participant: Participant) => void;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({ onClose, onLoginSuccess }) => {
  const [joinCode, setJoinCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const inputName = studentName.trim();
      const code = joinCode.trim().toUpperCase();
      if (!code) {
        setError('참여 코드를 입력해주세요.');
        return;
      }
      if (!inputName) {
        setError('학급 명부에 등록된 이름을 입력해주세요.');
        return;
      }
      const roster = await studentService.fetchRosterByJoinCode(code);
      if (roster.length === 0) {
        setError('학급 명부가 등록되지 않았습니다. 선생님께 문의해주세요.');
        return;
      }
      const normalize = (value: string) => value.replace(/\s+/g, '');
      const matched = roster.find((s) => normalize(s.name) === normalize(inputName));
      if (!matched) {
        setError('학급 명부에 없는 이름입니다. 정확한 이름을 입력해주세요.');
        return;
      }
      const displayName = matched.name;
      try {
        const joinResult = await studentJoinWithCode(code, displayName);
        const newParticipant: Participant = {
          id: joinResult.userId,
          nickname: displayName,
          session_hash: generateUUID(),
        };
        localStorage.setItem('edu_participant_session', JSON.stringify(newParticipant));
        await logBetaEvent('join_success');
        onLoginSuccess(newParticipant);
        onClose();
        return;
      } catch (supabaseError: any) {
        try {
          // 이미 참여 코드·명부 검증 완료된 상태에서 Supabase 가입만 실패한 경우 로컬 세션으로 입장 허용
          const p = await api.joinBoard(code, displayName, { skipCodeCheck: true });
          if (p) {
            await logBetaEvent('join_success');
            onLoginSuccess(p);
            onClose();
            return;
          }
        } catch {
          // Fallback: local session for offline/권한 제한 상황
          const fallbackParticipant: Participant = {
            id: generateUUID(),
            nickname: displayName,
            session_hash: generateUUID(),
          };
          localStorage.setItem('edu_participant_session', JSON.stringify(fallbackParticipant));
          await logBetaEvent('join_success');
          onLoginSuccess(fallbackParticipant);
          onClose();
        }
      }
    } catch (err: any) {
      setError(err.message || '참여 실패');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-md border-b-4 border-indigo-200 animate-fade-in-up">
        <div className="p-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-3xl">
          <h2 className="font-hand text-xl text-indigo-900 font-bold flex items-center gap-2">
            <UserCircle /> 학생 로그인
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleJoin} className="p-8 space-y-6">
          <div className="text-center mb-4">
             <p className="text-gray-500 text-sm">선생님이 알려주신 코드를 입력하세요</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">참여 코드</label>
            <input 
              type="text" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="예: 123456"
              className="w-full text-center text-2xl tracking-widest p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 uppercase"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">내 이름 (학급 명부)</label>
            <input 
              type="text" 
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="예: 김민수"
              className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95">
            입장하기 🚀
          </button>
        </form>
      </div>
    </div>
  );
};