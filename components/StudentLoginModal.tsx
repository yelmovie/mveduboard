import React, { useState } from 'react';
import { X, UserCircle } from 'lucide-react';
import * as api from '../services/boardService';
import * as studentService from '../services/studentService';
import { Participant } from '../types';
import { studentJoinWithCode } from '../src/lib/supabase/auth';
import { logBetaEvent } from '../src/lib/supabase/events';
import { generateUUID } from '../src/utils/uuid';
import { normalizeJoinCode, maskJoinCodeForLog } from '../src/lib/normalizeJoinCode';
import {
  getStudentJoinFailureMessage,
  StudentJoinFailureReason,
} from '../src/lib/studentJoinFailureReasons';
import { normalizeStudentNameForCompare } from '../src/lib/normalizeJoinCode';
import {
  isDebugJoin,
  logJoinDebug,
  setLastJoinDebugLog,
  getBuildInfo,
  getSupabaseHostPrefix,
  getAnonKeySafeHint,
  type JoinDebugLog,
} from '../src/lib/debugJoin';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/config/supabase';

interface StudentLoginModalProps {
  onClose: () => void;
  onLoginSuccess: (participant: Participant) => void;
}

export const StudentLoginModal: React.FC<StudentLoginModalProps> = ({ onClose, onLoginSuccess }) => {
  const [joinCode, setJoinCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [error, setError] = useState('');
  const [debugLog, setDebugLog] = useState<JoinDebugLog | null>(null);
  const [debugToolResult, setDebugToolResult] = useState<string>('');

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const inputName = studentName.trim();
    const code = normalizeJoinCode(joinCode);

    if (!code) {
      setError(getStudentJoinFailureMessage(StudentJoinFailureReason.CODE_EMPTY));
      return;
    }
    if (!inputName) {
      setError('학급 명부에 등록된 이름을 입력해주세요.');
      return;
    }

    const targetRpc = 'get_class_and_roster_by_join_code';
    const nameMask = (s: string) => (s.length <= 1 ? '*' : s[0] + '*'.repeat(Math.min(s.length - 1, 2)));

    if (import.meta.env.DEV) {
      console.log('[StudentLoginModal] submit', {
        inputCodeLength: joinCode.length,
        trimmedUppercased: code.length,
        codeMasked: maskJoinCodeForLog(code),
        queryTarget: 'public.classes.join_code via RPC ' + targetRpc,
      });
    }

    try {
      const roster = await studentService.fetchRosterByJoinCode(code);
      const resultExists = true;
      const rpcStudentCount = roster.length;

      if (roster.length === 0) {
        const log: JoinDebugLog = {
          rawCodeLength: joinCode.length,
          normalizedCodeMasked: maskJoinCodeForLog(code),
          rawNameLength: studentName.length,
          normalizedNameMasked: nameMask(inputName),
          targetRpc,
          resultExists,
          matchedStudentExists: false,
          failureReason: StudentJoinFailureReason.ROSTER_EMPTY,
          rpcStudentCount: 0,
        };
        setLastJoinDebugLog(log);
        setDebugLog(log);
        logJoinDebug('submit', log);
        setError(getStudentJoinFailureMessage(StudentJoinFailureReason.ROSTER_EMPTY));
        return;
      }
      const matched = roster.find((s) => normalizeStudentNameForCompare(s.name) === normalizeStudentNameForCompare(inputName));
      if (!matched) {
        const log: JoinDebugLog = {
          rawCodeLength: joinCode.length,
          normalizedCodeMasked: maskJoinCodeForLog(code),
          rawNameLength: studentName.length,
          normalizedNameMasked: nameMask(inputName),
          targetRpc,
          resultExists,
          matchedStudentExists: false,
          failureReason: StudentJoinFailureReason.STUDENT_NAME_NOT_FOUND,
          rpcStudentCount: roster.length,
        };
        setLastJoinDebugLog(log);
        setDebugLog(log);
        logJoinDebug('submit', log);
        if (import.meta.env.DEV) {
          console.warn('[StudentLoginModal] failure', {
            reason: 'STUDENT_NAME_NOT_FOUND',
            codeFound: true,
            rosterLength: roster.length,
          });
        }
        setError(getStudentJoinFailureMessage(StudentJoinFailureReason.STUDENT_NAME_NOT_FOUND));
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
      const reason = err?.message?.includes('참여 코드를 찾을 수 없습니다')
        ? StudentJoinFailureReason.CODE_NOT_FOUND
        : err?.message?.includes('확인할 수 없습니다')
          ? StudentJoinFailureReason.RPC_ERROR
          : StudentJoinFailureReason.UNKNOWN;
      const log: JoinDebugLog = {
        rawCodeLength: joinCode.length,
        normalizedCodeMasked: maskJoinCodeForLog(code),
        rawNameLength: studentName.length,
        normalizedNameMasked: nameMask(inputName),
        targetRpc,
        resultExists: false,
        matchedStudentExists: false,
        failureReason: reason,
      };
      setLastJoinDebugLog(log);
      setDebugLog(log);
      logJoinDebug('submit', log);
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

          {isDebugJoin() && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left text-sm space-y-3">
              <p className="font-bold text-amber-800">[배포 검증] ?debugJoin=1</p>
              <div className="space-y-1 font-mono text-xs">
                <p>build: {getBuildInfo().gitSha || 'not-injected'} | prod: {String(getBuildInfo().isProd)}</p>
                <p>env host: {getSupabaseHostPrefix(SUPABASE_URL)}</p>
                <p>anon key: {getAnonKeySafeHint(SUPABASE_ANON_KEY)}</p>
                {debugLog && (
                  <>
                    <p>normalized code: {debugLog.normalizedCodeMasked} | rpc: {debugLog.targetRpc}</p>
                    <p>resultExists: {String(debugLog.resultExists)} | matchedName: {String(debugLog.matchedStudentExists)} | reason: {debugLog.failureReason}</p>
                    {debugLog.rpcStudentCount != null && <p>rpcStudentCount: {debugLog.rpcStudentCount}</p>}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-amber-200 rounded text-amber-900 text-xs font-medium"
                  onClick={async () => {
                    const code = normalizeJoinCode(joinCode);
                    const r = await studentService.debugValidateCodeOnly(code);
                    setDebugToolResult(JSON.stringify(r, null, 2));
                  }}
                >
                  코드만 검증
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-amber-200 rounded text-amber-900 text-xs font-medium"
                  onClick={async () => {
                    const code = normalizeJoinCode(joinCode);
                    const roster = await studentService.fetchRosterByJoinCode(code).catch(() => []);
                    const normalizedInput = normalizeStudentNameForCompare(studentName.trim());
                    const matched = roster.find((s) => normalizeStudentNameForCompare(s.name) === normalizedInput);
                    setDebugToolResult(JSON.stringify({ rosterLength: roster.length, matched: !!matched, inputNameLength: studentName.length }, null, 2));
                  }}
                >
                  이름만 명부 매칭
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-amber-200 rounded text-amber-900 text-xs font-medium"
                  onClick={async () => {
                    const code = normalizeJoinCode(joinCode);
                    const summary = await studentService.debugGetRpcRawSummary(code);
                    setDebugToolResult(JSON.stringify(summary, null, 2));
                  }}
                >
                  RPC raw 요약
                </button>
              </div>
              {debugToolResult && <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-24">{debugToolResult}</pre>}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};