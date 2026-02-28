import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle,
  Circle,
  ClipboardList,
  FileText,
  ListChecks,
  Loader2,
  MoveDown,
  MoveUp,
  Plus,
  Save,
  Settings,
  Trash2,
  Copy,
  BarChart3,
  Users,
  Eye,
  Upload,
} from 'lucide-react';
import {
  Survey,
  SurveyChoice,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyStatus,
  SurveyAnswerInput,
  checkSurveyTables,
  createOrUpdateSurvey,
  deleteSurvey,
  formatSurveyErrorMessage,
  getSurveyDetail,
  getSurveyResults,
  getMyResponsesForSurveys,
  listStudentSurveys,
  listTeacherSurveys,
  submitSurveyResponse,
} from '../src/lib/supabase/surveys';
import { generateUUID } from '../src/utils/uuid';
import { SURVEY_ATTACHMENT_MAX_BYTES, SURVEY_ALLOWED_MIME } from '../src/config/survey';

interface SurveyAppProps {
  isTeacherMode: boolean;
  student: { id: string; nickname: string } | null;
}

type ViewMode = 'list' | 'builder' | 'fill' | 'results';

type QuestionDraft = Omit<SurveyQuestion, 'id' | 'survey_id'> & {
  id: string;
  choices: Array<Omit<SurveyChoice, 'id' | 'question_id'>>;
  description?: string;
};

const QUESTION_TYPES: Array<{ id: SurveyQuestionType; label: string; icon: React.ReactNode }> = [
  { id: 'single', label: '객관식(단일)', icon: <Circle size={16} /> },
  { id: 'multiple', label: '객관식(복수)', icon: <ListChecks size={16} /> },
  { id: 'short', label: '주관식(단답)', icon: <FileText size={16} /> },
  { id: 'long', label: '주관식(서술)', icon: <ClipboardList size={16} /> },
];

const defaultSurvey = (): Partial<Survey> => ({
  title: '새 설문',
  description: '',
  status: 'draft',
  starts_at: null,
  ends_at: null,
  is_anonymous: true,
  one_response_per_user: true,
  results_visible_to_students: false,
});

const defaultQuestion = (position: number): QuestionDraft => ({
  id: generateUUID(),
  position,
  question_type: 'single',
  question_text: '질문',
  description: '',
  is_required: false,
  allow_image: false,
  choices: [
    { position: 0, option_text: '선택지 1' },
    { position: 1, option_text: '선택지 2' },
  ],
});

const formatDate = (value?: string | null) => {
  if (!value) return '미설정';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '미설정' : date.toLocaleDateString();
};

const buildCsv = (rows: string[][]) => {
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
};

const DonutChart = ({ values }: { values: number[] }) => {
  const total = values.reduce((sum, v) => sum + v, 0) || 1;
  const radius = 24;
  const stroke = 8;
  let offset = 0;
  const colors = ['#3B82F6', '#60A5FA', '#93C5FD', '#1D4ED8', '#2563EB', '#0EA5E9'];

  return (
    <svg width={64} height={64} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      {values.map((value, idx) => {
        const portion = (value / total) * 2 * Math.PI * radius;
        const dashArray = `${portion} ${2 * Math.PI * radius}`;
        const dashOffset = -offset;
        offset += portion;
        return (
          <circle
            key={`${idx}-${value}`}
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke={colors[idx % colors.length]}
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 32 32)"
          />
        );
      })}
    </svg>
  );
};

export const SurveyApp: React.FC<SurveyAppProps> = ({ isTeacherMode, student }) => {
  const [view, setView] = useState<ViewMode>('list');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tableCheckError, setTableCheckError] = useState('');
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  // Builder state
  const [surveyDraft, setSurveyDraft] = useState<Partial<Survey>>(defaultSurvey());
  const [questions, setQuestions] = useState<QuestionDraft[]>([defaultQuestion(0)]);
  const [saving, setSaving] = useState(false);

  // Fill state
  const [fillSurvey, setFillSurvey] = useState<Survey | null>(null);
  const [fillQuestions, setFillQuestions] = useState<SurveyQuestion[]>([]);
  const [fillChoices, setFillChoices] = useState<SurveyChoice[]>([]);
  const [answerMap, setAnswerMap] = useState<Record<string, SurveyAnswerInput>>({});
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [validationError, setValidationError] = useState('');

  // Results state
  const [resultData, setResultData] = useState<ReturnType<typeof getSurveyResults> extends Promise<infer R> ? R : never | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [textPage, setTextPage] = useState<Record<string, number>>({});

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const refreshList = async () => {
    setLoading(true);
    setError('');
    try {
      const data = isTeacherMode ? await listTeacherSurveys() : await listStudentSurveys();
      setSurveys(data);
      if (!isTeacherMode) {
        const ids = await getMyResponsesForSurveys(data.map((s) => s.id));
        setCompletedIds(ids);
      }
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '설문을 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const run = async () => {
      const check = await checkSurveyTables();
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

  const handleCreate = () => {
    setSurveyDraft(defaultSurvey());
    setQuestions([defaultQuestion(0)]);
    setActiveSurveyId(null);
    setView('builder');
  };

  const handleEdit = async (surveyId: string) => {
    setLoading(true);
    setError('');
    try {
      const detail = await getSurveyDetail(surveyId);
      setSurveyDraft(detail.survey);
      const questionDrafts: QuestionDraft[] = detail.questions.map((q) => ({
        id: q.id,
        position: q.position,
        question_type: q.question_type,
        question_text: q.question_text,
        is_required: q.is_required,
        allow_image: q.allow_image,
        description: '',
        choices: detail.choices
          .filter((c) => c.question_id === q.id)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ position: c.position, option_text: c.option_text })),
      }));
      setQuestions(questionDrafts.length ? questionDrafts : [defaultQuestion(0)]);
      setActiveSurveyId(surveyId);
      setView('builder');
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '설문을 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (surveyId: string) => {
    if (!confirm('설문을 삭제할까요?')) return;
    setLoading(true);
    setError('');
    try {
      await deleteSurvey(surveyId);
      await refreshList();
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '설문을 삭제할 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSurvey = async () => {
    if (!surveyDraft.title?.trim()) {
      setError('설문 제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payloadQuestions = questions.map((q, index) => ({
        position: index,
        question_type: q.question_type,
        question_text: q.question_text,
        is_required: q.is_required,
        allow_image: q.allow_image,
        choices: q.choices?.map((c, idx) => ({ position: idx, option_text: c.option_text })),
      }));
      const result = await createOrUpdateSurvey(
        { ...surveyDraft, id: activeSurveyId || undefined } as Partial<Survey>,
        payloadQuestions
      );
      setActiveSurveyId(result.surveyId);
      await refreshList();
      setView('list');
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '설문을 저장할 수 없습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFill = async (surveyId: string) => {
    setLoading(true);
    setError('');
    try {
      const detail = await getSurveyDetail(surveyId);
      setFillSurvey(detail.survey);
      setFillQuestions(detail.questions);
      setFillChoices(detail.choices);
      setAnswerMap({});
      setSubmitState('idle');
      setValidationError('');
      setView('fill');
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '설문을 불러올 수 없습니다.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResults = async (surveyId: string) => {
    setResultLoading(true);
    setError('');
    setView('results');
    try {
      const data = await getSurveyResults(surveyId);
      setResultData(data);
    } catch (err: any) {
      setError(formatSurveyErrorMessage(err, '결과를 불러올 수 없습니다.'));
    } finally {
      setResultLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!fillSurvey) return;
    const requiredMissing = fillQuestions.some((q) => {
      if (!q.is_required) return false;
      const answer = answerMap[q.id];
      if (!answer) return true;
      if (q.question_type === 'single' || q.question_type === 'multiple') {
        return !answer.choiceIds || answer.choiceIds.length === 0;
      }
      return !answer.textAnswer?.trim();
    });
    if (requiredMissing) {
      setValidationError('필수 문항을 확인해주세요.');
      return;
    }
    setSubmitState('submitting');
    setValidationError('');
    try {
      const payload = fillQuestions.map((q) => ({
        questionId: q.id,
        type: q.question_type,
        required: q.is_required,
        choiceIds: answerMap[q.id]?.choiceIds || [],
        textAnswer: answerMap[q.id]?.textAnswer || '',
        attachmentFile: answerMap[q.id]?.attachmentFile || null,
      }));
      await submitSurveyResponse(fillSurvey.id, payload, fillSurvey.one_response_per_user);
      setSubmitState('success');
      await refreshList();
    } catch (err: any) {
      setValidationError(formatSurveyErrorMessage(err, '제출에 실패했습니다.'));
      setSubmitState('idle');
    }
  };

  const handleExportCsv = () => {
    if (!resultData) return;
    const rows: string[][] = [['문항', '선택지', '응답 수']];
    resultData.questions.forEach((q) => {
      const qChoices = resultData.choices.filter((c) => c.question_id === q.id);
      const answers = resultData.answers.filter((a) => a.question_id === q.id);
      if (q.question_type === 'single' || q.question_type === 'multiple') {
        qChoices.forEach((choice) => {
          const count = answers.filter((a) => a.choice_id === choice.id).length;
          rows.push([q.question_text, choice.option_text, String(count)]);
        });
      } else {
        const count = answers.filter((a) => a.text_answer).length;
        rows.push([q.question_text, '주관식', String(count)]);
      }
    });
    const blob = new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `설문결과_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const isTeacher = isTeacherMode;

  return (
    <div className="min-h-full bg-slate-50 text-slate-800 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900/90 text-white flex items-center justify-center">
              <ClipboardList size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold">설문 게시판</h1>
              <p className="text-sm text-slate-500">설문에 응답하세요.</p>
            </div>
          </div>
          {view === 'list' && isTeacher && (
            <button
              onClick={handleCreate}
              className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800"
            >
              <Plus size={16} /> 새 설문 만들기
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
            {!isTeacherMode && surveys.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Bell size={18} />
                  </div>
                  <div>
                    <p className="font-bold text-amber-800">새 설문 알림</p>
                    <p className="text-sm text-amber-700">진행 중인 설문에 참여해 주세요.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {surveys
                    .filter((s) => s.status === 'open' && !completedIds.includes(s.id))
                    .slice(0, 3)
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => handleOpenFill(s.id)}
                        className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-bold hover:bg-amber-700"
                      >
                        {s.title}
                      </button>
                    ))}
                </div>
              </div>
            )}
            {surveys.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
                설문이 없습니다.
              </div>
            ) : (
              surveys.map((surveyItem) => {
                const isClosed = surveyItem.status === 'closed';
                const submitted = completedIds.includes(surveyItem.id);
                return (
                  <div key={surveyItem.id} className="bg-white/80 backdrop-blur border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${surveyItem.status === 'open' ? 'bg-emerald-50 text-emerald-700' : surveyItem.status === 'draft' ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'}`}>
                          {surveyItem.status === 'open' ? '진행중' : surveyItem.status === 'draft' ? '초안' : '마감'}
                        </span>
                        {submitted && <span className="px-2 py-1 rounded text-xs font-bold bg-blue-50 text-blue-700">제출 완료</span>}
                      </div>
                      <h3 className="text-lg font-bold">{surveyItem.title}</h3>
                      <p className="text-sm text-slate-500">{surveyItem.description || '설명 없음'}</p>
                      <div className="text-xs text-slate-400 flex items-center gap-2">
                        <Calendar size={14} /> {formatDate(surveyItem.starts_at)} ~ {formatDate(surveyItem.ends_at)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isTeacher ? (
                        <>
                          <button onClick={() => handleEdit(surveyItem.id)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-100">편집</button>
                          <button onClick={() => handleOpenResults(surveyItem.id)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold hover:bg-slate-100 flex items-center gap-1"><BarChart3 size={14}/> 결과</button>
                          <button onClick={() => handleDelete(surveyItem.id)} className="px-3 py-2 rounded-lg border border-rose-200 text-rose-600 text-sm font-bold hover:bg-rose-50">삭제</button>
                        </>
                      ) : (
                        <button
                          disabled={isClosed || submitted}
                          onClick={() => handleOpenFill(surveyItem.id)}
                          className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold disabled:bg-slate-300"
                        >
                          {submitted ? '제출 완료' : isClosed ? '마감된 설문입니다' : '응답하기'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {view === 'builder' && isTeacher && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <input
                  value={surveyDraft.title || ''}
                  onChange={(e) => setSurveyDraft({ ...surveyDraft, title: e.currentTarget.value })}
                  className="w-full text-xl font-bold outline-none bg-transparent"
                  placeholder="설문 제목"
                />
                <textarea
                  value={surveyDraft.description || ''}
                  onChange={(e) => setSurveyDraft({ ...surveyDraft, description: e.currentTarget.value })}
                  className="w-full text-sm text-slate-600 outline-none bg-slate-50 rounded-lg p-3"
                  placeholder="설문 설명"
                />
                <div className="flex flex-wrap gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <span className="text-slate-500">상태</span>
                    <select
                      value={surveyDraft.status || 'draft'}
                      onChange={(e) => setSurveyDraft({ ...surveyDraft, status: e.currentTarget.value as SurveyStatus })}
                      className="border border-slate-200 rounded-lg px-2 py-1"
                    >
                      <option value="draft">초안</option>
                      <option value="open">진행중</option>
                      <option value="closed">마감</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-500">시작</span>
                    <input
                      type="datetime-local"
                      value={surveyDraft.starts_at?.slice(0, 16) || ''}
                      onChange={(e) => setSurveyDraft({ ...surveyDraft, starts_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                      className="border border-slate-200 rounded-lg px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-500">종료</span>
                    <input
                      type="datetime-local"
                      value={surveyDraft.ends_at?.slice(0, 16) || ''}
                      onChange={(e) => setSurveyDraft({ ...surveyDraft, ends_at: e.currentTarget.value ? new Date(e.currentTarget.value).toISOString() : null })}
                      className="border border-slate-200 rounded-lg px-2 py-1"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <label className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={Boolean(surveyDraft.is_anonymous)} onChange={(e) => setSurveyDraft({ ...surveyDraft, is_anonymous: e.currentTarget.checked })} />
                    익명
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={Boolean(surveyDraft.one_response_per_user)} onChange={(e) => setSurveyDraft({ ...surveyDraft, one_response_per_user: e.currentTarget.checked })} />
                    1인 1회
                  </label>
                  <label className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                    <input type="checkbox" checked={Boolean(surveyDraft.results_visible_to_students)} onChange={(e) => setSurveyDraft({ ...surveyDraft, results_visible_to_students: e.currentTarget.checked })} />
                    결과 공개
                  </label>
                </div>
              </div>

              {questions.map((q, index) => (
                <div
                  key={q.id}
                  ref={(el) => {
                    questionRefs.current[q.id] = el;
                  }}
                  className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      {QUESTION_TYPES.find((t) => t.id === q.question_type)?.icon}
                      <select
                        value={q.question_type}
                        onChange={(e) => {
                          const next = [...questions];
                          next[index].question_type = e.currentTarget.value as SurveyQuestionType;
                          if (next[index].question_type === 'short' || next[index].question_type === 'long') {
                            next[index].choices = [];
                          } else if (next[index].choices.length === 0) {
                            next[index].choices = [
                              { position: 0, option_text: '선택지 1' },
                              { position: 1, option_text: '선택지 2' },
                            ];
                          }
                          setQuestions(next);
                        }}
                        className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
                      >
                        {QUESTION_TYPES.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (index === 0) return;
                          const next = [...questions];
                          const temp = next[index - 1];
                          next[index - 1] = next[index];
                          next[index] = temp;
                          setQuestions(next.map((item, idx) => ({ ...item, position: idx })));
                        }}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                        title="위로"
                      >
                        <MoveUp size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (index === questions.length - 1) return;
                          const next = [...questions];
                          const temp = next[index + 1];
                          next[index + 1] = next[index];
                          next[index] = temp;
                          setQuestions(next.map((item, idx) => ({ ...item, position: idx })));
                        }}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                        title="아래로"
                      >
                        <MoveDown size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const dup = { ...q, id: generateUUID() };
                          const next = [...questions];
                          next.splice(index + 1, 0, dup);
                          setQuestions(next.map((item, idx) => ({ ...item, position: idx })));
                        }}
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200"
                        title="복제"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => {
                          const next = questions.filter((item) => item.id !== q.id);
                          setQuestions(next.map((item, idx) => ({ ...item, position: idx })));
                        }}
                        className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <input
                    value={q.question_text}
                    onChange={(e) => {
                      const next = [...questions];
                      next[index].question_text = e.currentTarget.value;
                      setQuestions(next);
                    }}
                    className="w-full text-lg font-bold outline-none bg-transparent"
                    placeholder="질문 제목"
                  />
                  <textarea
                    value={q.description || ''}
                    onChange={(e) => {
                      const next = [...questions];
                      next[index].description = e.currentTarget.value;
                      setQuestions(next);
                    }}
                    className="w-full text-sm text-slate-600 outline-none bg-slate-50 rounded-lg p-3"
                    placeholder="질문 설명"
                  />
                  {(q.question_type === 'single' || q.question_type === 'multiple') && (
                    <div className="space-y-2">
                      {q.choices.map((choice, cIdx) => (
                        <div key={`${q.id}-${cIdx}`} className="flex items-center gap-2">
                          <span className="text-slate-400">{q.question_type === 'single' ? <Circle size={14} /> : <CheckCircle size={14} />}</span>
                          <input
                            value={choice.option_text}
                            onChange={(e) => {
                              const next = [...questions];
                              next[index].choices[cIdx].option_text = e.currentTarget.value;
                              setQuestions(next);
                            }}
                            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm"
                            placeholder="선택지"
                          />
                          <button
                            onClick={() => {
                              const next = [...questions];
                              next[index].choices = next[index].choices.filter((_, idx) => idx !== cIdx);
                              setQuestions(next);
                            }}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const next = [...questions];
                          next[index].choices.push({ position: next[index].choices.length, option_text: `선택지 ${next[index].choices.length + 1}` });
                          setQuestions(next);
                        }}
                        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                      >
                        <Plus size={14} /> 선택지 추가
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.is_required}
                        onChange={(e) => {
                          const next = [...questions];
                          next[index].is_required = e.currentTarget.checked;
                          setQuestions(next);
                        }}
                      />
                      필수
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={q.allow_image}
                        onChange={(e) => {
                          const next = [...questions];
                          next[index].allow_image = e.currentTarget.checked;
                          setQuestions(next);
                        }}
                      />
                      사진 첨부 허용
                    </label>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <button
                  onClick={() => setQuestions([...questions, defaultQuestion(questions.length)])}
                  className="bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-600 flex items-center gap-2"
                >
                  <Plus size={16} /> 문항 추가
                </button>
                <button
                  onClick={handleSaveSurvey}
                  disabled={saving}
                  className="bg-slate-900 text-white rounded-xl px-4 py-2 font-bold flex items-center gap-2 disabled:opacity-60"
                >
                  <Save size={16} /> 저장
                </button>
                <button
                  onClick={() => setView('list')}
                  className="border border-slate-200 rounded-xl px-4 py-2 font-bold text-slate-500"
                >
                  목록으로
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 h-fit sticky top-6">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-600 mb-3">
                <Settings size={16} /> 목차
              </div>
              <div className="space-y-2 text-sm">
                {questions.map((q) => (
                  <button
                    key={`outline-${q.id}`}
                    onClick={() => questionRefs.current[q.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="w-full text-left px-2 py-1 rounded-lg hover:bg-slate-100"
                  >
                    {q.question_text || '질문'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'fill' && fillSurvey && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {(() => {
              const now = Date.now();
              const startAt = fillSurvey.starts_at ? new Date(fillSurvey.starts_at).getTime() : null;
              const endAt = fillSurvey.ends_at ? new Date(fillSurvey.ends_at).getTime() : null;
              const isOpen =
                fillSurvey.status === 'open' &&
                (!startAt || startAt <= now) &&
                (!endAt || endAt >= now);
              return (
                <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{fillSurvey.title}</h2>
              <p className="text-sm text-slate-500">{fillSurvey.description || '설명 없음'}</p>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Calendar size={14} /> {formatDate(fillSurvey.starts_at)} ~ {formatDate(fillSurvey.ends_at)}
              </div>
            </div>

            {submitState === 'success' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-emerald-700 text-center font-bold">
                제출 완료
              </div>
            ) : (
              <div className="space-y-4">
                {!isOpen && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm font-bold">
                    마감된 설문입니다.
                  </div>
                )}
                {fillQuestions.map((q, idx) => {
                  const choices = fillChoices.filter((c) => c.question_id === q.id);
                  const answer = answerMap[q.id];
                  return (
                    <div key={q.id} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Q{idx + 1}</span>
                        <h3 className="font-bold">{q.question_text}</h3>
                        {q.is_required && <span className="text-xs text-rose-500 font-bold">필수</span>}
                      </div>
                      {(q.question_type === 'single' || q.question_type === 'multiple') && (
                        <div className="space-y-2">
                          {choices.map((choice) => {
                            const selected = answer?.choiceIds?.includes(choice.id) || false;
                            return (
                              <label key={choice.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type={q.question_type === 'single' ? 'radio' : 'checkbox'}
                                  name={q.id}
                                  checked={selected}
                                  onChange={(e) => {
                                    const current = answer?.choiceIds || [];
                                    const next =
                                      q.question_type === 'single'
                                        ? e.currentTarget.checked
                                          ? [choice.id]
                                          : []
                                        : e.currentTarget.checked
                                          ? [...current, choice.id]
                                          : current.filter((id) => id !== choice.id);
                                    setAnswerMap({
                                      ...answerMap,
                                      [q.id]: {
                                        questionId: q.id,
                                        type: q.question_type,
                                        required: q.is_required,
                                        choiceIds: next,
                                      },
                                    });
                                  }}
                                />
                                {choice.option_text}
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {(q.question_type === 'short' || q.question_type === 'long') && (
                        <textarea
                          className="w-full border border-slate-200 rounded-xl p-3 text-sm"
                          rows={q.question_type === 'short' ? 2 : 5}
                          placeholder={q.question_type === 'short' ? '답변을 입력하세요.' : '자유롭게 작성하세요.'}
                          value={answer?.textAnswer || ''}
                          onChange={(e) =>
                            setAnswerMap({
                              ...answerMap,
                              [q.id]: {
                                questionId: q.id,
                                type: q.question_type,
                                required: q.is_required,
                                textAnswer: e.currentTarget.value,
                              },
                            })
                          }
                        />
                      )}
                      {q.allow_image && (
                        <div className="space-y-2">
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <Upload size={14} />
                            이미지 파일만 업로드 가능 (최대 {Math.round(SURVEY_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB)
                          </div>
                          <input
                            type="file"
                            accept={SURVEY_ALLOWED_MIME.join(',')}
                            onChange={(e) => {
                              const file = e.currentTarget.files?.[0] || null;
                              setAnswerMap({
                                ...answerMap,
                                [q.id]: {
                                  questionId: q.id,
                                  type: q.question_type,
                                  required: q.is_required,
                                  choiceIds: answer?.choiceIds || [],
                                  textAnswer: answer?.textAnswer || '',
                                  attachmentFile: file,
                                },
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
                {validationError && <div className="text-sm text-rose-600">{validationError}</div>}
                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitState === 'submitting' || !isOpen}
                    className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold disabled:bg-slate-300"
                  >
                    {submitState === 'submitting' ? '제출 중...' : '제출'}
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
                </>
              );
            })()}
          </div>
        )}

        {view === 'results' && isTeacher && (
          <div className="space-y-4">
            {resultLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="animate-spin" size={18} /> 결과 불러오는 중...
              </div>
            )}
            {!resultLoading && resultData && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">{resultData.survey.title}</h2>
                    <p className="text-sm text-slate-500">총 응답 {resultData.responses.length}건</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExportCsv} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2">
                      <Download size={16} /> CSV 내보내기
                    </button>
                    <button onClick={() => setView('list')} className="border border-slate-200 rounded-lg px-4 py-2 font-bold text-slate-500">
                      목록으로
                    </button>
                  </div>
                </div>
                {resultData.questions.map((q, idx) => {
                  const answers = resultData.answers.filter((a: any) => a.question_id === q.id);
                  const choices = resultData.choices.filter((c) => c.question_id === q.id);
                  const total = answers.length || 1;
                  const textAnswers = answers.filter((a: any) => a.text_answer);
                  const page = textPage[q.id] || 1;
                  const pageSize = 10;
                  const totalPages = Math.max(1, Math.ceil(textAnswers.length / pageSize));
                  const pagedText = textAnswers.slice((page - 1) * pageSize, page * pageSize);
                  return (
                    <div key={q.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Q{idx + 1}</span>
                        <h3 className="font-bold">{q.question_text}</h3>
                      </div>
                      {(q.question_type === 'single' || q.question_type === 'multiple') && (
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
                          <div className="space-y-2">
                            {choices.map((choice) => {
                              const count = answers.filter((a: any) => a.choice_id === choice.id).length;
                              const percent = Math.round((count / total) * 100);
                              return (
                                <div key={choice.id} className="space-y-1">
                                  <div className="flex justify-between text-sm">
                                    <span>{choice.option_text}</span>
                                    <span>{count}명 ({percent}%)</span>
                                  </div>
                                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center">
                            <DonutChart values={choices.map((choice) => answers.filter((a: any) => a.choice_id === choice.id).length)} />
                          </div>
                        </div>
                      )}
                      {(q.question_type === 'short' || q.question_type === 'long') && (
                        <div className="space-y-2">
                          {textAnswers.length === 0 ? (
                            <p className="text-sm text-slate-400">응답이 없습니다.</p>
                          ) : (
                            <>
                              <ul className="text-sm text-slate-600 list-disc pl-4 space-y-1">
                                {pagedText.map((a: any) => (
                                  <li key={a.id}>{a.text_answer}</li>
                                ))}
                              </ul>
                              {totalPages > 1 && (
                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                  <button
                                    onClick={() => setTextPage({ ...textPage, [q.id]: Math.max(1, page - 1) })}
                                    className="px-2 py-1 rounded border border-slate-200"
                                  >
                                    이전
                                  </button>
                                  <span>
                                    {page}/{totalPages}
                                  </span>
                                  <button
                                    onClick={() => setTextPage({ ...textPage, [q.id]: Math.min(totalPages, page + 1) })}
                                    className="px-2 py-1 rounded border border-slate-200"
                                  >
                                    다음
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
