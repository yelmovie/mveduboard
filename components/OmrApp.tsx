import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  Copy,
  FileText,
  ListChecks,
  Loader2,
  Minus,
  Plus,
  Save,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import {
  OmrAssignment,
  OmrAnswerKeyItem,
  checkOmrTables,
  createOrUpdateAssignment,
  deleteAssignment,
  formatOmrErrorMessage,
  getAssignmentDetail,
  listMySubmissions,
  listStudentAssignments,
  listSubmissionAnswers,
  listSubmissions,
  listTeacherAssignments,
  submitOmrAnswers,
} from '../src/lib/supabase/omr';
import { getSession } from '../src/lib/supabase/auth';
import { OMR_QUESTION_MAX, OMR_QUESTION_MIN } from '../src/config/omr';
import * as studentService from '../services/studentService';

interface OmrAppProps {
  isTeacherMode: boolean;
  student: { id: string; nickname: string } | null;
}

type View = 'list' | 'builder' | 'student' | 'results';

const ANSWER_FORMATS = [
  { id: '1-5', label: '1~5' },
  { id: 'A-E', label: 'A~E' },
] as const;

const FEEDBACK_MODES = [
  { id: 'wrong_numbers', label: '틀린 번호 공개' },
  { id: 'wrong_count', label: '틀린 개수만 공개' },
  { id: 'none', label: '메시지만 표시' },
] as const;

const PASS_SCORE_PERCENT = 90;

const buildChoices = (format: '1-5' | 'A-E') =>
  format === '1-5' ? ['1', '2', '3', '4', '5'] : ['A', 'B', 'C', 'D', 'E'];

const createDefaultKeys = (count: number): OmrAnswerKeyItem[] => {
  return Array.from({ length: count }).map((_, idx) => ({
    no: idx + 1,
    type: 'choice',
    answer: [1],
  }));
};

const normalizeKeys = (count: number, existing?: OmrAnswerKeyItem[] | null) => {
  if (!existing || existing.length === 0) return createDefaultKeys(count);
  const map = new Map(existing.map((k) => [k.no, k]));
  return Array.from({ length: count }).map((_, idx) => {
    const no = idx + 1;
    return map.get(no) || { no, type: 'choice', answer: [1] };
  });
};

export const OmrApp: React.FC<OmrAppProps> = ({ isTeacherMode, student }) => {
  const [view, setView] = useState<View>('list');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tableCheckError, setTableCheckError] = useState('');
  const [assignments, setAssignments] = useState<OmrAssignment[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mySubmissions, setMySubmissions] = useState<Record<string, any>>({});

  // Builder
  const [draft, setDraft] = useState<Partial<OmrAssignment>>({
    title: 'OMR 과제',
    description: '',
    answer_format: '1-5',
    question_count: 10,
    require_all_correct: true,
    feedback_mode: 'wrong_numbers',
    max_attempts: null,
    due_at: null,
    is_published: false,
  });
  const [answerKeys, setAnswerKeys] = useState<OmrAnswerKeyItem[]>(createDefaultKeys(10));
  const [saving, setSaving] = useState(false);

  // Student fill
  const [studentAssignment, setStudentAssignment] = useState<OmrAssignment | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{ mode: string; wrongNumbers?: number[]; wrongCount?: number; message: string } | null>(null);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'completed'>('idle');
  const [isAuthed, setIsAuthed] = useState<boolean>(true);

  // Results
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionAnswers, setSubmissionAnswers] = useState<any[]>([]);

  const isChoiceAnswerFilled = (answer: OmrAnswerKeyItem['answer']) => {
    if (Array.isArray(answer)) return answer.length > 0;
    return Number.isFinite(Number(answer)) && Number(answer) > 0;
  };

  const toChoiceArray = (answer: OmrAnswerKeyItem['answer']) => {
    if (Array.isArray(answer)) return answer;
    const num = Number(answer);
    return Number.isFinite(num) && num > 0 ? [num] : [];
  };

  const normalizeShortAnswer = (value: string) => value.replace(/\s+/g, '').trim();

  const evaluateLocally = (assignment: OmrAssignment, submitted: string[]) => {
    const keys = assignment.answer_key || [];
    if (keys.length === 0) {
      throw new Error('정답이 등록되지 않았습니다. 선생님께 문의해주세요.');
    }
    const wrongNumbers: number[] = [];
    let correctCount = 0;
    keys.forEach((key, idx) => {
      const answer = submitted[idx] || '';
      let isCorrect = false;
      if (key.type === 'short') {
        isCorrect = normalizeShortAnswer(answer) === normalizeShortAnswer(String(key.answer || ''));
      } else {
        const expected = toChoiceArray(key.answer);
        const got = parseAnswerSet(answer);
        isCorrect = expected.length === got.length && expected.every((v) => got.includes(v));
      }
      if (isCorrect) {
        correctCount += 1;
      } else {
        wrongNumbers.push(key.no);
      }
    });
    const total = assignment.question_count || keys.length || submitted.length;
    const scorePercent = Math.round((correctCount / total) * 100);
    const passed = scorePercent >= PASS_SCORE_PERCENT;
    const message = passed
      ? `점수 ${scorePercent}점입니다. 통과했습니다.`
      : `점수 ${scorePercent}점입니다. ${PASS_SCORE_PERCENT}점 이상이어야 통과합니다.`;
    return {
      status: passed ? 'completed' : 'submitted',
      mode: assignment.feedback_mode,
      wrongNumbers,
      wrongCount: wrongNumbers.length,
      score_percent: scorePercent,
      message,
    };
  };

  const toggleChoiceValue = (idx: number, value: number) => {
    const next = [...answerKeys];
    const current = toChoiceArray(next[idx].answer);
    const exists = current.includes(value);
    const updated = exists ? current.filter((v) => v !== value) : [...current, value];
    next[idx] = { ...next[idx], type: 'choice', answer: updated };
    setAnswerKeys(next);
  };

  const parseAnswerSet = (value: string) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);

  const serializeAnswerSet = (values: number[]) =>
    values
      .slice()
      .sort((a, b) => a - b)
      .join(',');

  const refreshList = async () => {
    setLoading(true);
    setError('');
    try {
      const list = isTeacherMode ? await listTeacherAssignments() : await listStudentAssignments();
      setAssignments(list);
      if (!isTeacherMode) {
        const myList = await listMySubmissions(list.map((a) => a.id));
        const map: Record<string, any> = {};
        myList.forEach((sub) => {
          if (!map[sub.assignment_id] || map[sub.assignment_id].attempt_no < sub.attempt_no) {
            map[sub.assignment_id] = sub;
          }
        });
        setMySubmissions(map);
      }
    } catch (err: any) {
      setError(formatOmrErrorMessage(err, 'OMR 목록을 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      try {
        await studentService.preloadClassId();
        await studentService.fetchRosterFromDb();
      } catch {}
      const check = await checkOmrTables();
      if (!check.ok && check.error) {
        const { status, code, table, message } = check.error;
        const isMissing = status === 404 || code === '42P01';
        const label = isMissing ? 'DB 테이블 미생성' : 'DB 접근 오류';
        setTableCheckError(
          `${label}: ${table} (status:${status ?? 'unknown'}, code:${code ?? 'unknown'}) - ${message}`
        );
      } else {
        setTableCheckError('');
      }
      await refreshList();
    };
    run();
  }, [isTeacherMode]);

  useEffect(() => {
    const run = async () => {
      const session = await getSession();
      setIsAuthed(!!session);
    };
    run();
  }, []);

  const handleNew = () => {
    setActiveId(null);
    setDraft({
      title: 'OMR 과제',
      description: '',
      answer_format: '1-5',
      question_count: 10,
      require_all_correct: true,
      feedback_mode: 'wrong_numbers',
      max_attempts: null,
      due_at: null,
      is_published: false,
    });
    setAnswerKeys(createDefaultKeys(10));
    setView('builder');
  };

  const handleEdit = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const detail = await getAssignmentDetail(id, true);
      setActiveId(id);
      setDraft(detail.assignment);
      setAnswerKeys(
        normalizeKeys(detail.assignment.question_count, detail.assignment.answer_key || detail.keys || [])
      );
      setView('builder');
    } catch (err: any) {
      setError(formatOmrErrorMessage(err, 'OMR 정보를 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    const session = await getSession();
    if (!session) {
      setError('로그인 후 저장할 수 있습니다.');
      return;
    }
    if (!draft.title?.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    const invalid = answerKeys.some((k) => {
      if (k.type === 'choice') return !isChoiceAnswerFilled(k.answer);
      return !k.answer || !String(k.answer).trim();
    });
    if (invalid) {
      setError('정답을 모두 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createOrUpdateAssignment(
        { ...draft, id: activeId || undefined, is_published: publish },
        answerKeys
      );
      setView('list');
      await refreshList();
    } catch (err: any) {
      console.error('[omr] save failed', err);
      setError('저장에 실패했습니다. 로그인 상태와 권한을 확인해주세요.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('OMR 과제를 삭제할까요?')) return;
    setLoading(true);
    setError('');
    try {
      await deleteAssignment(id);
      await refreshList();
    } catch (err: any) {
      setError(formatOmrErrorMessage(err, '삭제할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStudent = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const detail = await getAssignmentDetail(id, true);
      setStudentAssignment(detail.assignment);
      setAnswers(Array.from({ length: detail.assignment.question_count }).map(() => ''));
      setFeedback(null);
      setSubmitState('idle');
      setView('student');
    } catch (err: any) {
      setError(formatOmrErrorMessage(err, 'OMR 정보를 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!studentAssignment) return;
    if (answers.some((a) => !a)) {
      setError('모든 문항을 선택해주세요.');
      return;
    }
    setSubmitState('submitting');
    setError('');
    try {
      const res = await submitOmrAnswers(studentAssignment.id, answers);
      const score = Number(res?.score_percent ?? 0);
      const passed = Number.isFinite(score) && score >= PASS_SCORE_PERCENT;
      const message = passed
        ? `점수 ${score}점입니다. 통과했습니다.`
        : `점수 ${score}점입니다. ${PASS_SCORE_PERCENT}점 이상이어야 통과합니다.`;
      setFeedback({
        mode: res?.mode ?? 'wrong_numbers',
        wrongNumbers: res?.wrong_numbers ?? undefined,
        wrongCount: res?.wrong_count ?? undefined,
        message,
      });
      setSubmitState(passed ? 'completed' : 'idle');
      await refreshList();
    } catch (err: any) {
      try {
        const local = evaluateLocally(studentAssignment, answers);
        setFeedback(local);
        setSubmitState(local.status === 'completed' ? 'completed' : 'idle');
      } catch (fallbackError: any) {
        setError(formatOmrErrorMessage(fallbackError, '제출에 실패했습니다.'));
        setSubmitState('idle');
      }
    }
  };

  const handleOpenResults = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const detail = await getAssignmentDetail(id, true);
      const subs = await listSubmissions(id);
      const ans = await listSubmissionAnswers(id);
      setStudentAssignment(detail.assignment);
      setAnswerKeys(normalizeKeys(detail.assignment.question_count, detail.assignment.answer_key || detail.keys || []));
      setSubmissions(subs);
      setSubmissionAnswers(ans);
      setView('results');
    } catch (err: any) {
      setError(formatOmrErrorMessage(err, '결과를 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const roster = studentService.getRoster().map((s) => ({ id: s.id, name: `${s.number}. ${s.name}` }));

  const summary = useMemo(() => {
    if (!studentAssignment) return null;
    const total = submissions.length || 1;
    const completed = submissions.filter((s) => s.status === 'completed').length;
    const avg = submissions.reduce((acc, s) => acc + Number(s.score_percent || 0), 0) / total;
    const bins = [0, 20, 40, 60, 80, 100];
    const histogram = bins.slice(0, -1).map((b, idx) => {
      const upper = bins[idx + 1];
      const count = submissions.filter((s) => s.score_percent >= b && s.score_percent < upper + 1).length;
      return { range: `${b}-${upper}`, count };
    });
    return { completed, avg: Math.round(avg), histogram };
  }, [submissions, studentAssignment]);

  const itemStats = useMemo(() => {
    if (!studentAssignment) return [];
    const choiceLabels = buildChoices(studentAssignment.answer_format);
    const choiceValues = choiceLabels.map((_, idx) => String(idx + 1));
    return answerKeys.map((key) => {
      const answersForQ = submissionAnswers.filter((a) => a.q_no === key.no);
      const correct = answersForQ.filter((a) => a.is_correct).length;
      const total = answersForQ.length || 1;
      if (key.type === 'short') {
        return {
          qNo: key.no,
          correctRate: Math.round((correct / total) * 100),
          wrongRate: 100 - Math.round((correct / total) * 100),
          topWrong: '-',
        };
      }
      const counts = choiceValues.map((v) => answersForQ.filter((a) => a.chosen_choice === v).length);
      const wrongChoices = counts
        .map((c, idx) => ({ choice: choiceLabels[idx], count: c }))
        .sort((a, b) => b.count - a.count);
      return {
        qNo: key.no,
        correctRate: Math.round((correct / total) * 100),
        wrongRate: 100 - Math.round((correct / total) * 100),
        topWrong: wrongChoices[0]?.choice || '-',
      };
    });
  }, [answerKeys, submissionAnswers, studentAssignment]);

  const studentKeyMap = useMemo(() => {
    const map = new Map<number, OmrAnswerKeyItem>();
    if (studentAssignment?.answer_key) {
      studentAssignment.answer_key.forEach((k) => map.set(k.no, k));
    }
    return map;
  }, [studentAssignment]);

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h1 className="text-xl font-bold">OMR 답안지 입력</h1>
              <p className="text-sm text-slate-500">정답 입력과 채점을 간편하게 관리합니다.</p>
            </div>
          </div>
          {view === 'list' && isTeacherMode && (
            <button
              onClick={handleNew}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800"
            >
              <Plus size={16} /> 새 OMR 만들기
            </button>
          )}
        </header>

        {tableCheckError && (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm">
            {tableCheckError}
          </div>
        )}
        {error && <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
        {loading && (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={18} /> 불러오는 중...
          </div>
        )}

        {!loading && view === 'list' && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                OMR 과제가 없습니다.
              </div>
            ) : (
              assignments.map((item) => {
                const my = mySubmissions[item.id];
                return (
                  <div key={item.id} className="bg-white/80 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {item.is_published ? '공개' : '초안'}
                        </span>
                        {my && (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700">
                            {my.status === 'completed' ? '완료' : '미완료'}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold">{item.title}</h3>
                      <p className="text-sm text-slate-500">{item.description || '설명 없음'}</p>
                      {item.due_at && (
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <Calendar size={14} /> {new Date(item.due_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isTeacherMode ? (
                        <>
                          <button onClick={() => handleEdit(item.id)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-100">편집</button>
                          <button onClick={() => handleOpenResults(item.id)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-100 flex items-center gap-1"><BarChart3 size={14}/> 결과</button>
                          <button onClick={() => handleDelete(item.id)} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50">삭제</button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleOpenStudent(item.id)}
                          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold"
                        >
                          답안 입력
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'builder' && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
              <input
                className="w-full text-xl font-bold outline-none bg-transparent"
                placeholder="제목"
                value={draft.title || ''}
                onChange={(e) => setDraft({ ...draft, title: e.currentTarget.value })}
              />
              <textarea
                className="w-full text-sm text-slate-600 outline-none bg-slate-50 rounded-lg p-3"
                placeholder="설명"
                value={draft.description || ''}
                onChange={(e) => setDraft({ ...draft, description: e.currentTarget.value })}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">문항 수</span>
                  <input
                    type="number"
                    min={OMR_QUESTION_MIN}
                    max={OMR_QUESTION_MAX}
                    value={draft.question_count || 10}
                    onChange={(e) => {
                      const count = Math.max(OMR_QUESTION_MIN, Math.min(OMR_QUESTION_MAX, Number(e.currentTarget.value)));
                      setDraft({ ...draft, question_count: count });
                      setAnswerKeys(normalizeKeys(count, answerKeys));
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1 w-24"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">형식</span>
                  <select
                    value={draft.answer_format || '1-5'}
                    onChange={(e) => {
                      const format = e.currentTarget.value as '1-5' | 'A-E';
                      setDraft({ ...draft, answer_format: format });
                      setAnswerKeys(normalizeKeys(draft.question_count || 10, answerKeys));
                    }}
                    className="border border-slate-200 rounded-lg px-2 py-1"
                  >
                    {ANSWER_FORMATS.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">마감</span>
                  <input
                    type="datetime-local"
                    value={draft.due_at?.slice(0, 16) || ''}
                    onChange={(e) => setDraft({ ...draft, due_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                    className="border border-slate-200 rounded-lg px-2 py-1"
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.require_all_correct ?? true}
                    onChange={(e) => setDraft({ ...draft, require_all_correct: e.currentTarget.checked })}
                  />
                  전체 정답 필수
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">피드백</span>
                  <select
                    value={draft.feedback_mode || 'wrong_numbers'}
                    onChange={(e) => setDraft({ ...draft, feedback_mode: e.currentTarget.value as any })}
                    className="border border-slate-200 rounded-lg px-2 py-1"
                  >
                    {FEEDBACK_MODES.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-500">응시 제한</span>
                  <input
                    type="number"
                    min={1}
                    placeholder="무제한"
                    value={draft.max_attempts ?? ''}
                    onChange={(e) => setDraft({ ...draft, max_attempts: e.currentTarget.value ? Number(e.currentTarget.value) : null })}
                    className="border border-slate-200 rounded-lg px-2 py-1 w-24"
                  />
                </label>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold">정답 입력</div>
                <div className="text-xs text-slate-400">객관식은 복수 정답 선택 가능</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {answerKeys.map((k) => (
                  <div key={k.no} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-slate-500">Q{k.no}</span>
                    <select
                      value={k.type}
                      onChange={(e) => {
                        const next = [...answerKeys];
                        const type = e.currentTarget.value as 'choice' | 'short';
                        next[k.no - 1] =
                          type === 'choice'
                            ? { no: k.no, type: 'choice', answer: k.type === 'choice' ? (toChoiceArray(k.answer).length ? toChoiceArray(k.answer) : [1]) : [1] }
                            : { no: k.no, type: 'short', answer: k.type === 'short' ? (k.answer || '') : '' };
                        setAnswerKeys(next);
                      }}
                      className="border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="choice">객관식</option>
                      <option value="short">주관식</option>
                    </select>
                    {k.type === 'choice' ? (
                      <div className="flex flex-wrap gap-2">
                        {buildChoices(draft.answer_format || '1-5').map((c, idx) => {
                          const value = idx + 1;
                          const selected = toChoiceArray(k.answer).includes(value);
                          return (
                            <button
                              key={`${k.no}-${c}`}
                              type="button"
                              onClick={() => toggleChoiceValue(k.no - 1, value)}
                              className={`px-3 py-1 rounded-lg border text-xs font-bold ${
                                selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        value={String(k.answer || '')}
                        onChange={(e) => {
                          const next = [...answerKeys];
                          next[k.no - 1] = { no: k.no, type: 'short', answer: e.currentTarget.value };
                          setAnswerKeys(next);
                        }}
                        className="border border-slate-200 rounded-lg px-2 py-1 flex-1"
                        placeholder="정답 텍스트"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => handleSave(false), 0);
                }}
                disabled={saving || !isAuthed}
                className="bg-slate-900 text-white rounded-xl px-4 py-2 font-bold flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={16} /> 저장
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => handleSave(true), 0);
                }}
                disabled={saving || !isAuthed}
                className="bg-emerald-600 text-white rounded-xl px-4 py-2 font-bold flex items-center gap-2 disabled:opacity-60"
              >
                <CheckCircle size={16} /> 저장 & 공개
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                className="border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-500"
              >
                목록으로
              </button>
            </div>
            {!isAuthed && (
              <div className="text-sm text-rose-500">로그인 후 저장할 수 있습니다.</div>
            )}
          </div>
        )}

        {view === 'student' && studentAssignment && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
              <h2 className="text-2xl font-bold">{studentAssignment.title}</h2>
              <p className="text-sm text-slate-500">{studentAssignment.description || '설명 없음'}</p>
              {studentAssignment.due_at && (
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <Calendar size={14} /> {new Date(studentAssignment.due_at).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {answers.map((val, idx) => {
                const keyInfo = studentKeyMap.get(idx + 1);
                const isShort = keyInfo?.type === 'short';
                const selectedValues = parseAnswerSet(val);
                return (
                  <div key={`ans-${idx}`} className="flex flex-col gap-2">
                    <div className="text-sm font-bold text-slate-600">Q{idx + 1}</div>
                    {isShort ? (
                      <input
                        value={val}
                        onChange={(e) => {
                          const next = [...answers];
                          next[idx] = e.currentTarget.value;
                          setAnswers(next);
                        }}
                        className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="정답 입력"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {buildChoices(studentAssignment.answer_format).map((c, cIdx) => {
                          const choiceValue = cIdx + 1;
                          const selected = selectedValues.includes(choiceValue);
                          return (
                            <button
                              key={`${idx}-${c}`}
                              type="button"
                              onClick={() => {
                                const next = [...answers];
                                const nextSet = selected
                                  ? selectedValues.filter((v) => v !== choiceValue)
                                  : [...selectedValues, choiceValue];
                                next[idx] = serializeAnswerSet(nextSet);
                                setAnswers(next);
                              }}
                              className={`px-3 py-1 rounded-lg border text-xs font-bold ${
                                selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'
                              }`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {feedback && (
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-sm">
                {feedback.message}
                {feedback.mode === 'wrong_numbers' && feedback.wrongNumbers && (
                  <div className="mt-2 text-slate-600">틀린 번호: {feedback.wrongNumbers.join(', ')}</div>
                )}
                {feedback.mode === 'wrong_count' && typeof feedback.wrongCount === 'number' && (
                  <div className="mt-2 text-slate-600">틀린 개수: {feedback.wrongCount}개</div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={submitState === 'submitting' || submitState === 'completed'}
                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold disabled:bg-slate-300"
              >
                {submitState === 'completed' ? '완료됨' : submitState === 'submitting' ? '채점 중...' : '제출'}
              </button>
              <button
                onClick={() => setView('list')}
                className="border border-slate-200 rounded-xl px-6 py-3 font-bold text-slate-500"
              >
                목록으로
              </button>
            </div>
          </div>
        )}

        {view === 'results' && studentAssignment && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">{studentAssignment.title}</h2>
                <p className="text-sm text-slate-500">제출 {summary?.completed || 0}명</p>
              </div>
              <button onClick={() => setView('list')} className="border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-500">
                목록으로
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-sm text-slate-500">평균 점수</div>
                <div className="text-3xl font-bold">{summary?.avg ?? 0}%</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 md:col-span-2">
                <div className="text-sm text-slate-500 mb-2">분포</div>
                <div className="flex items-end gap-2 h-24">
                  {summary?.histogram.map((b) => (
                    <div key={b.range} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-blue-500/70 rounded-t" style={{ height: `${b.count * 10 + 8}px` }} />
                      <span className="text-xs text-slate-500">{b.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="font-bold mb-3">제출 현황</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 mb-2">완료</div>
                  <ul className="space-y-1">
                    {roster
                      .filter((r) => submissions.some((s) => s.user_id === r.id && s.status === 'completed'))
                      .map((r) => (
                        <li key={`done-${r.id}`} className="text-slate-700">{r.name}</li>
                      ))}
                  </ul>
                </div>
                <div>
                  <div className="text-slate-500 mb-2">미완료</div>
                  <ul className="space-y-1">
                    {roster
                      .filter((r) => !submissions.some((s) => s.user_id === r.id && s.status === 'completed'))
                      .map((r) => (
                        <li key={`todo-${r.id}`} className="text-slate-700">{r.name}</li>
                      ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="font-bold mb-3">문항 분석</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {itemStats.map((item) => (
                  <div key={`q-${item.qNo}`} className="border border-slate-200 rounded-xl p-3">
                    <div className="font-bold mb-1">Q{item.qNo}</div>
                    <div className="text-slate-500">정답률 {item.correctRate}% / 오답률 {item.wrongRate}%</div>
                    <div className="text-slate-500">최다 오답: {item.topWrong}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
