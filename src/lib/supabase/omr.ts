import { supabase } from './client';
import { getCurrentUserProfile } from './auth';
import { generateUUID } from '../../utils/uuid';

export type OmrAssignment = {
  id: string;
  class_id: string;
  created_by: string;
  title: string;
  description: string | null;
  answer_format: '1-5' | 'A-E';
  question_count: number;
  require_all_correct: boolean;
  feedback_mode: 'wrong_numbers' | 'wrong_count' | 'none';
  max_attempts: number | null;
  due_at: string | null;
  is_published: boolean;
  answer_key?: OmrAnswerKeyItem[] | null;
  created_at: string;
  updated_at: string;
};

export type OmrAnswerKeyItem =
  | { no: number; type: 'choice'; answer: number | number[] }
  | { no: number; type: 'short'; answer: string };

export type OmrAttempt = {
  id: string;
  assignment_id: string;
  class_id: string;
  user_id: string;
  attempt_no: number;
  status: 'in_progress' | 'submitted' | 'completed' | 'locked';
  score_percent: number;
  correct_count: number;
  wrong_count: number;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const TABLES = {
  assignments: 'omr_assignments',
  attempts: 'omr_attempts',
  submissionAnswers: 'omr_submission_answers',
};

const LOCAL_KEY = 'edu_omr_assignments';

const ASSIGNMENT_SELECT =
  'id, class_id, created_by, title, description, answer_format, question_count, require_all_correct, feedback_mode, max_attempts, due_at, is_published, answer_key, created_at, updated_at';

type OmrAssignmentDb = {
  id: string;
  class_id: string;
  created_by: string;
  title: string;
  description: string | null;
  answer_format: '1-5' | 'A-E';
  question_count: number;
  require_all_correct: boolean;
  feedback_mode: 'wrong_numbers' | 'wrong_count' | 'none';
  max_attempts: number | null;
  due_at: string | null;
  is_published: boolean;
  answer_key?: OmrAnswerKeyItem[] | null;
  created_at: string;
  updated_at: string;
};

export type OmrErrorInfo = {
  status?: number;
  code?: string;
  message: string;
  table?: string;
};

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
};

const getLocalKey = (classId?: string | null) => (classId ? `${LOCAL_KEY}_${classId}` : LOCAL_KEY);

const getLocalAssignments = (classId?: string | null): OmrAssignment[] => {
  const stored = localStorage.getItem(getLocalKey(classId));
  if (!stored) return [];
  try {
    return JSON.parse(stored) as OmrAssignment[];
  } catch (e) {
    console.warn('[omr] local parse failed', e);
    return [];
  }
};

const saveLocalAssignments = (list: OmrAssignment[], classId?: string | null) => {
  const key = getLocalKey(classId);
  try {
    localStorage.setItem(key, JSON.stringify(list));
    if (classId) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('[omr] local save failed', e);
  }
};

const upsertLocalAssignment = (assignment: OmrAssignment, classId?: string | null) => {
  const list = getLocalAssignments(classId);
  const next = list.some((item) => item.id === assignment.id)
    ? list.map((item) => (item.id === assignment.id ? assignment : item))
    : [assignment, ...list];
  saveLocalAssignments(next, classId);
  return assignment.id;
};

const deleteLocalAssignment = (assignmentId: string, classId?: string | null) => {
  const list = getLocalAssignments(classId);
  const next = list.filter((item) => item.id !== assignmentId);
  saveLocalAssignments(next, classId);
};

const safeGetClassId = async () => {
  try {
    const profile = await getCurrentUserProfile();
    return profile?.class_id ?? null;
  } catch (e) {
    console.warn('[omr] get profile failed', e);
    return null;
  }
};

const getProfile = async () => {
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error('프로필 정보를 확인할 수 없습니다.');
  return profile;
};

const mapDbToAssignment = (row: OmrAssignmentDb): OmrAssignment => ({
  id: row.id,
  class_id: row.class_id,
  created_by: row.created_by,
  title: row.title,
  description: row.description,
  answer_format: row.answer_format,
  question_count: row.question_count,
  require_all_correct: row.require_all_correct,
  feedback_mode: row.feedback_mode,
  max_attempts: row.max_attempts,
  due_at: row.due_at,
  is_published: row.is_published,
  answer_key: row.answer_key || [],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const buildPayload = (
  assignment: Partial<OmrAssignment>,
  profile: { class_id: string; id: string },
  answerKeys: OmrAnswerKeyItem[],
  createdBy: string
) => ({
  title: assignment.title?.trim() || 'OMR 과제',
  description: assignment.description || null,
  answer_format: assignment.answer_format || '1-5',
  question_count: assignment.question_count || 10,
  require_all_correct: assignment.require_all_correct ?? true,
  feedback_mode: assignment.feedback_mode || 'wrong_numbers',
  max_attempts: assignment.max_attempts ?? null,
  due_at: assignment.due_at || null,
  is_published: assignment.is_published ?? false,
  class_id: profile.class_id,
  created_by: createdBy,
  answer_key: answerKeys,
});

const logPayloadIfDev = (payload: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  const { answer_key, ...rest } = payload;
  console.log('[omr] upsert payload keys:', Object.keys(rest));
  if (Array.isArray(answer_key)) {
    console.log('[omr] answer_key length:', answer_key.length);
  }
};

const toOmrError = (fallback: string, error?: { status?: number; code?: string; message?: string; details?: string }) => {
  const status = typeof error?.status === 'number' ? error.status : undefined;
  const code = typeof error?.code === 'string' ? error.code : undefined;
  const message = typeof error?.message === 'string' ? error.message : fallback;
  const details = typeof error?.details === 'string' ? error.details : '';
  const composed = `${fallback} (status:${status ?? 'unknown'}, code:${code ?? 'unknown'}) - ${message}${details ? ` | ${details}` : ''}`;
  const err = new Error(composed) as Error & { status?: number; code?: string };
  err.status = status;
  err.code = code;
  return err;
};

export const formatOmrErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    console.error('[omr] error', error);
  }
  return fallback;
};

export const checkOmrTables = async (): Promise<{ ok: boolean; error?: OmrErrorInfo }> => {
  ensureClient();
  const { error } = await supabase.from(TABLES.assignments).select('id').limit(1);
  if (error) {
    const status = typeof error.status === 'number' ? error.status : undefined;
    const code = typeof error.code === 'string' ? error.code : undefined;
    const message = typeof error.message === 'string' ? error.message : '테이블 확인 실패';
    return { ok: false, error: { status, code, message, table: TABLES.assignments } };
  }
  return { ok: true };
};

export const listTeacherAssignments = async () => {
  try {
    ensureClient();
    const profile = await getProfile();
    const { data, error } = await supabase
      .from(TABLES.assignments)
      .select(ASSIGNMENT_SELECT)
      .eq('class_id', profile.class_id)
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });
    if (error) throw toOmrError('OMR 목록을 불러올 수 없습니다.', error);
    const mapped = (data || []).map((row) => mapDbToAssignment(row as OmrAssignmentDb));
    saveLocalAssignments(mapped, profile.class_id);
    if (mapped.length === 0) {
      const local = getLocalAssignments(profile.class_id);
      return local;
    }
    return mapped;
  } catch (err) {
    const classId = await safeGetClassId();
    return getLocalAssignments(classId);
  }
};

export const listStudentAssignments = async () => {
  try {
    ensureClient();
    const profile = await getProfile();
    const { data, error } = await supabase
      .from(TABLES.assignments)
      .select(ASSIGNMENT_SELECT)
      .eq('class_id', profile.class_id)
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    if (error) throw toOmrError('OMR 목록을 불러올 수 없습니다.', error);
    const mapped = (data || []).map((row) => mapDbToAssignment(row as OmrAssignmentDb));
    saveLocalAssignments(mapped, profile.class_id);
    if (mapped.length === 0) {
      const local = getLocalAssignments(profile.class_id).filter((item) => item.is_published);
      return local;
    }
    return mapped;
  } catch (err) {
    const classId = await safeGetClassId();
    return getLocalAssignments(classId).filter((item) => item.is_published);
  }
};

export const getAssignmentDetail = async (assignmentId: string, includeKey: boolean) => {
  try {
    ensureClient();
    const { data: assignment, error } = await supabase
      .from(TABLES.assignments)
      .select(ASSIGNMENT_SELECT)
      .eq('id', assignmentId)
      .maybeSingle();
    if (error || !assignment) throw toOmrError('OMR 정보를 찾을 수 없습니다.', error);

    const mapped = mapDbToAssignment(assignment as OmrAssignmentDb);
    const keys = includeKey ? mapped.answer_key || [] : [];
    return { assignment: mapped, keys };
  } catch (err) {
    const classId = await safeGetClassId();
    const local = getLocalAssignments(classId).find((item) => item.id === assignmentId);
    if (!local) throw toOmrError('OMR 정보를 찾을 수 없습니다.', err as any);
    const keys = includeKey ? local.answer_key || [] : [];
    return { assignment: local, keys };
  }
};

export const createOrUpdateAssignment = async (
  assignment: Partial<OmrAssignment>,
  answerKeys: OmrAnswerKeyItem[]
) => {
  let profile: { class_id: string; id: string } | null = null;
  let userId: string | null = null;
  try {
    ensureClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.id) {
      throw new Error('로그인 후 저장할 수 있습니다.');
    }
    userId = userData.user.id;
    profile = await getProfile();
    const payload = buildPayload(assignment, profile, answerKeys, userId);
    logPayloadIfDev(payload);

    let assignmentId = assignment.id;
    if (assignmentId) {
      const { data, error } = await supabase
        .from(TABLES.assignments)
        .upsert({ ...payload, id: assignmentId }, { onConflict: 'id' })
        .select(ASSIGNMENT_SELECT)
        .maybeSingle();
      if (error || !data) throw toOmrError('OMR 과제를 저장할 수 없습니다.', error);
      const mapped = mapDbToAssignment(data as OmrAssignmentDb);
      upsertLocalAssignment(mapped, profile.class_id);
      return mapped.id as string;
    }

    const { data, error } = await supabase
      .from(TABLES.assignments)
      .upsert(payload, { onConflict: 'id' })
      .select(ASSIGNMENT_SELECT)
      .maybeSingle();
    if (error || !data) throw toOmrError('OMR 과제를 저장할 수 없습니다.', error);
    const mapped = mapDbToAssignment(data as OmrAssignmentDb);
    upsertLocalAssignment(mapped, profile.class_id);
    return mapped.id as string;
  } catch (err) {
    const classId = profile?.class_id ?? (await safeGetClassId());
    const now = new Date().toISOString();
    const localList = getLocalAssignments(classId);
    const existing = assignment.id ? localList.find((item) => item.id === assignment.id) : undefined;
    const localAssignment: OmrAssignment = {
      id: assignment.id ?? generateUUID(),
      class_id: classId ?? 'local',
      created_by: assignment.created_by || userId || 'local',
      title: assignment.title?.trim() || 'OMR 과제',
      description: assignment.description ?? null,
      answer_format: assignment.answer_format ?? '1-5',
      question_count: assignment.question_count ?? 10,
      require_all_correct: assignment.require_all_correct ?? true,
      feedback_mode: assignment.feedback_mode ?? 'wrong_numbers',
      max_attempts: assignment.max_attempts ?? null,
      due_at: assignment.due_at ?? null,
      is_published: assignment.is_published ?? false,
      answer_key: answerKeys,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };
    return upsertLocalAssignment(localAssignment, classId);
  }
};

export const deleteAssignment = async (assignmentId: string) => {
  try {
    ensureClient();
    const { error } = await supabase.from(TABLES.assignments).delete().eq('id', assignmentId);
    if (error) throw toOmrError('OMR 과제를 삭제할 수 없습니다.', error);
  } finally {
    const classId = await safeGetClassId();
    deleteLocalAssignment(assignmentId, classId);
  }
};

export const submitOmrAnswers = async (assignmentId: string, answers: string[]) => {
  ensureClient();
  const { data, error } = await supabase.rpc('omr_submit_answers', {
    p_assignment_id: assignmentId,
    p_answers: answers,
  });
  if (error) throw toOmrError('채점에 실패했습니다.', error);
  return data;
};

export const listSubmissions = async (assignmentId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(TABLES.attempts)
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
      console.warn('[omr] omr_attempts 테이블이 없습니다. Supabase에 031_omr_attempts.sql 마이그레이션을 적용해주세요.');
      return [];
    }
    throw toOmrError('제출 현황을 불러올 수 없습니다.', error);
  }
  return (data || []) as OmrAttempt[];
};

export const listSubmissionAnswers = async (assignmentId: string) => {
  ensureClient();
  const { data, error } = await supabase
    .from(TABLES.submissionAnswers)
    .select('*')
    .eq('assignment_id', assignmentId);
  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache'))) {
      console.warn('[omr] omr_submission_answers 테이블이 없습니다. Supabase 마이그레이션을 적용해주세요.');
      return [];
    }
    throw toOmrError('문항 분석을 불러올 수 없습니다.', error);
  }
  return data || [];
};

export const listMySubmissions = async (assignmentIds: string[]) => {
  ensureClient();
  if (assignmentIds.length === 0) return [];
  const { data: user } = await supabase.auth.getUser();
  const userId = user.user?.id;
  if (!userId) return [];
  const { data, error } = await supabase
    .from(TABLES.attempts)
    .select('*')
    .eq('user_id', userId)
    .in('assignment_id', assignmentIds);
  if (error && (error.code === 'PGRST205' || (error.message && error.message.includes('schema cache')))) {
    console.warn('[omr] omr_attempts 테이블이 없습니다.');
    return [];
  }
  return (data || []) as OmrAttempt[];
};
