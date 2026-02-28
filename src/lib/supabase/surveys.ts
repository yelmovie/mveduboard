import { supabase } from './client';
import { getCurrentUserProfile } from './auth';
import { SURVEY_ATTACHMENT_MAX_BYTES, SURVEY_ALLOWED_MIME } from '../../config/survey';
import { generateUUID } from '../../utils/uuid';

export type SurveyStatus = 'draft' | 'open' | 'closed';
export type SurveyQuestionType = 'single' | 'multiple' | 'short' | 'long';

export type Survey = {
  id: string;
  board_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: SurveyStatus;
  starts_at: string | null;
  ends_at: string | null;
  is_anonymous: boolean;
  one_response_per_user: boolean;
  results_visible_to_students: boolean;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestion = {
  id: string;
  survey_id: string;
  position: number;
  question_type: SurveyQuestionType;
  question_text: string;
  is_required: boolean;
  allow_image: boolean;
};

export type SurveyChoice = {
  id: string;
  question_id: string;
  position: number;
  option_text: string;
};

export type SurveyAnswerInput = {
  questionId: string;
  type: SurveyQuestionType;
  required: boolean;
  choiceIds?: string[];
  textAnswer?: string;
  attachmentFile?: File | null;
};

export type SurveyErrorInfo = {
  status?: number;
  code?: string;
  message: string;
  table?: string;
};

const TABLES = {
  surveys: 'surveys',
  questions: 'survey_questions',
  options: 'survey_options',
  responses: 'survey_responses',
  answers: 'survey_answers',
  attachments: 'survey_attachments',
};

const ensureClient = () => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
};

const getProfile = async () => {
  const profile = await getCurrentUserProfile();
  if (!profile) throw new Error('프로필 정보를 확인할 수 없습니다.');
  return profile;
};

const toSurveyError = (fallback: string, error?: { status?: number; code?: string; message?: string }) => {
  const status = typeof error?.status === 'number' ? error.status : undefined;
  const code = typeof error?.code === 'string' ? error.code : undefined;
  const message = typeof error?.message === 'string' ? error.message : fallback;
  const composed = `${fallback} (status:${status ?? 'unknown'}, code:${code ?? 'unknown'}) - ${message}`;
  const err = new Error(composed) as Error & { status?: number; code?: string };
  err.status = status;
  err.code = code;
  return err;
};

const LS_LOCAL_KEY = 'edu_surveys_local_store';
type LocalSurveyStore = {
  surveys: Survey[];
  questions: SurveyQuestion[];
  options: SurveyChoice[];
  responses: Array<{ id: string; survey_id: string; user_id: string; submitted_at: string }>;
  answers: Array<{ id: string; response_id: string; question_id: string; choice_id: string | null; text_answer: string | null }>;
};

const getLocalStore = (): LocalSurveyStore => {
  const stored = localStorage.getItem(LS_LOCAL_KEY);
  if (!stored) {
    return { surveys: [], questions: [], options: [], responses: [], answers: [] };
  }
  try {
    const parsed = JSON.parse(stored) as LocalSurveyStore;
    return {
      surveys: Array.isArray(parsed.surveys) ? parsed.surveys : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      options: Array.isArray(parsed.options) ? parsed.options : [],
      responses: Array.isArray(parsed.responses) ? parsed.responses : [],
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
    };
  } catch {
    return { surveys: [], questions: [], options: [], responses: [], answers: [] };
  }
};

const saveLocalStore = (store: LocalSurveyStore) => {
  localStorage.setItem(LS_LOCAL_KEY, JSON.stringify(store));
};

const getScopeId = (profile: { class_id?: string | null }) => profile.class_id || 'local';

const isRlsError = (error?: { status?: number; code?: string; message?: string }) => {
  if (!error) return false;
  if (error.code === '42501') return true;
  if (error.status === 401 || error.status === 403) return true;
  if (error.message?.includes('row-level security')) return true;
  return false;
};

const createOrUpdateSurveyLocal = async (
  profile: { id: string; class_id?: string | null },
  survey: Partial<Survey>,
  questions: Array<Omit<SurveyQuestion, 'id' | 'survey_id'> & { id?: string; choices: Omit<SurveyChoice, 'id' | 'question_id'>[] }>
) => {
  const store = getLocalStore();
  const now = new Date().toISOString();
  const boardId = getScopeId(profile);
  let surveyId = survey.id;
  if (!surveyId) {
    surveyId = generateUUID();
    store.surveys.push({
      id: surveyId,
      board_id: boardId,
      created_by: profile.id,
      title: survey.title?.trim() || '새 설문',
      description: survey.description || null,
      status: (survey.status || 'draft') as SurveyStatus,
      starts_at: survey.starts_at || null,
      ends_at: survey.ends_at || null,
      is_anonymous: Boolean(survey.is_anonymous),
      one_response_per_user: Boolean(survey.one_response_per_user),
      results_visible_to_students: Boolean(survey.results_visible_to_students),
      created_at: now,
      updated_at: now,
    });
  } else {
    store.surveys = store.surveys.map((s) =>
      s.id === surveyId
        ? {
            ...s,
            title: survey.title?.trim() || s.title,
            description: survey.description || null,
            status: (survey.status || s.status) as SurveyStatus,
            starts_at: survey.starts_at || null,
            ends_at: survey.ends_at || null,
            is_anonymous: Boolean(survey.is_anonymous),
            one_response_per_user: Boolean(survey.one_response_per_user),
            results_visible_to_students: Boolean(survey.results_visible_to_students),
            updated_at: now,
          }
        : s
    );
  }

  store.questions = store.questions.filter((q) => q.survey_id !== surveyId);
  store.options = store.options.filter((o) => !store.questions.some((q) => q.id === o.question_id));

  const insertedQuestions: SurveyQuestion[] = [];
  questions.forEach((q, idx) => {
    const qId = generateUUID();
    const questionRow: SurveyQuestion = {
      id: qId,
      survey_id: surveyId!,
      position: q.position ?? idx,
      question_type: q.question_type,
      question_text: q.question_text,
      is_required: q.is_required,
      allow_image: q.allow_image,
    };
    insertedQuestions.push(questionRow);
    store.questions.push(questionRow);
    if (q.choices?.length) {
      q.choices.forEach((c, cIdx) => {
        store.options.push({
          id: generateUUID(),
          question_id: qId,
          position: c.position ?? cIdx,
          option_text: c.option_text,
        });
      });
    }
  });

  saveLocalStore(store);
  return { surveyId, questions: insertedQuestions };
};

const listTeacherSurveysLocal = (profile: { id: string; class_id?: string | null }) => {
  const store = getLocalStore();
  const boardId = getScopeId(profile);
  return store.surveys
    .filter((s) => s.board_id === boardId && s.created_by === profile.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const listStudentSurveysLocal = (profile: { class_id?: string | null }) => {
  const store = getLocalStore();
  const boardId = getScopeId(profile);
  return store.surveys
    .filter((s) => s.board_id === boardId && s.status === 'open')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const getSurveyDetailLocal = (surveyId: string) => {
  const store = getLocalStore();
  const survey = store.surveys.find((s) => s.id === surveyId);
  if (!survey) throw new Error('설문 정보를 찾을 수 없습니다.');
  const questions = store.questions.filter((q) => q.survey_id === surveyId).sort((a, b) => a.position - b.position);
  const questionIds = questions.map((q) => q.id);
  const choices = store.options.filter((o) => questionIds.includes(o.question_id)).sort((a, b) => a.position - b.position);
  return { survey, questions, choices };
};

const deleteSurveyLocal = (surveyId: string) => {
  const store = getLocalStore();
  const questionIds = store.questions.filter((q) => q.survey_id === surveyId).map((q) => q.id);
  store.surveys = store.surveys.filter((s) => s.id !== surveyId);
  store.questions = store.questions.filter((q) => q.survey_id !== surveyId);
  store.options = store.options.filter((o) => !questionIds.includes(o.question_id));
  store.responses = store.responses.filter((r) => r.survey_id !== surveyId);
  store.answers = store.answers.filter((a) => !store.responses.some((r) => r.id === a.response_id));
  saveLocalStore(store);
};

const getMyResponsesForSurveysLocal = (surveyIds: string[], userId: string) => {
  const store = getLocalStore();
  return store.responses.filter((r) => r.user_id === userId && surveyIds.includes(r.survey_id)).map((r) => r.survey_id);
};

const submitSurveyResponseLocal = async (
  profile: { id: string; class_id?: string | null },
  surveyId: string,
  answers: SurveyAnswerInput[],
  oneResponsePerUser: boolean
) => {
  const store = getLocalStore();
  if (oneResponsePerUser) {
    const existing = store.responses.find((r) => r.survey_id === surveyId && r.user_id === profile.id);
    if (existing) throw new Error('이미 제출한 설문입니다.');
  }
  const responseId = generateUUID();
  store.responses.push({
    id: responseId,
    survey_id: surveyId,
    user_id: profile.id,
    submitted_at: new Date().toISOString(),
  });
  answers.forEach((answer) => {
    if (answer.type === 'single' || answer.type === 'multiple') {
      const choices = answer.choiceIds || [];
      choices.forEach((choiceId) => {
        store.answers.push({
          id: generateUUID(),
          response_id: responseId,
          question_id: answer.questionId,
          choice_id: choiceId,
          text_answer: null,
        });
      });
    } else {
      const text = answer.textAnswer?.trim() || '';
      store.answers.push({
        id: generateUUID(),
        response_id: responseId,
        question_id: answer.questionId,
        choice_id: null,
        text_answer: text || null,
      });
    }
  });
  saveLocalStore(store);
  return responseId;
};

const getSurveyResultsLocal = (surveyId: string) => {
  const store = getLocalStore();
  const survey = store.surveys.find((s) => s.id === surveyId);
  if (!survey) throw new Error('설문 정보를 찾을 수 없습니다.');
  const questions = store.questions.filter((q) => q.survey_id === surveyId).sort((a, b) => a.position - b.position);
  const questionIds = questions.map((q) => q.id);
  const choices = store.options.filter((o) => questionIds.includes(o.question_id)).sort((a, b) => a.position - b.position);
  const responses = store.responses.filter((r) => r.survey_id === surveyId);
  const responseIds = responses.map((r) => r.id);
  const answers = store.answers.filter((a) => responseIds.includes(a.response_id));
  return { survey, questions, choices, responses, answers };
};

export const formatSurveyErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

export const checkSurveyTables = async (): Promise<{ ok: boolean; error?: SurveyErrorInfo }> => {
  ensureClient();
  const tables = [TABLES.surveys, TABLES.questions, TABLES.options];
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      const status = typeof error.status === 'number' ? error.status : undefined;
      const code = typeof error.code === 'string' ? error.code : undefined;
      const message = typeof error.message === 'string' ? error.message : '테이블 확인 실패';
      return {
        ok: false,
        error: {
          status,
          code,
          message,
          table,
        },
      };
    }
  }
  return { ok: true };
};

const matchesMime = (mime: string) => {
  if (!mime) return false;
  return SURVEY_ALLOWED_MIME.some((allowed) => {
    if (allowed.endsWith('/*')) {
      const prefix = allowed.replace('/*', '');
      return mime.startsWith(prefix);
    }
    return mime === allowed;
  });
};

const validateAttachment = (file: File) => {
  if (file.size > SURVEY_ATTACHMENT_MAX_BYTES) {
    throw new Error(`파일 용량은 최대 ${Math.round(SURVEY_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB까지 가능합니다.`);
  }
  if (!matchesMime(file.type)) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
};

export const listTeacherSurveys = async () => {
  const profile = await getProfile();
  try {
    ensureClient();
    const { data, error } = await supabase
      .from(TABLES.surveys)
      .select('*')
      .eq('board_id', profile.class_id)
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (isRlsError(error)) return listTeacherSurveysLocal(profile);
      throw toSurveyError('설문 목록을 불러올 수 없습니다.', error);
    }
    return (data || []) as Survey[];
  } catch (err: any) {
    return listTeacherSurveysLocal(profile);
  }
};

export const listStudentSurveys = async () => {
  const profile = await getProfile();
  try {
    ensureClient();
    const { data, error } = await supabase
      .from(TABLES.surveys)
      .select('*')
      .eq('board_id', profile.class_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false });
    if (error) {
      if (isRlsError(error)) return listStudentSurveysLocal(profile);
      throw toSurveyError('설문 목록을 불러올 수 없습니다.', error);
    }
    return (data || []) as Survey[];
  } catch (err: any) {
    return listStudentSurveysLocal(profile);
  }
};

export const getSurveyDetail = async (surveyId: string) => {
  try {
    ensureClient();
    const { data: survey, error: surveyError } = await supabase
      .from(TABLES.surveys)
      .select('*')
      .eq('id', surveyId)
      .maybeSingle();
    if (surveyError || !survey) {
      if (isRlsError(surveyError || undefined)) return getSurveyDetailLocal(surveyId);
      throw toSurveyError('설문 정보를 찾을 수 없습니다.', surveyError);
    }

    const { data: questions, error: questionError } = await supabase
      .from(TABLES.questions)
      .select('*')
      .eq('survey_id', surveyId)
      .order('position', { ascending: true });
    if (questionError) {
      if (isRlsError(questionError)) return getSurveyDetailLocal(surveyId);
      throw toSurveyError('문항을 불러올 수 없습니다.', questionError);
    }

    const questionIds = (questions || []).map((q) => q.id);
    const { data: choices } = questionIds.length
      ? await supabase.from(TABLES.options).select('*').in('question_id', questionIds).order('position')
      : { data: [] as SurveyChoice[] };

    return {
      survey: survey as Survey,
      questions: (questions || []) as SurveyQuestion[],
      choices: (choices || []) as SurveyChoice[],
    };
  } catch (err: any) {
    return getSurveyDetailLocal(surveyId);
  }
};

export const createOrUpdateSurvey = async (
  survey: Partial<Survey>,
  questions: Array<Omit<SurveyQuestion, 'id' | 'survey_id'> & { id?: string; choices: Omit<SurveyChoice, 'id' | 'question_id'>[] }>
) => {
  const profile = await getProfile();
  const payload = {
    title: survey.title?.trim() || '새 설문',
    description: survey.description || null,
    status: (survey.status || 'draft') as SurveyStatus,
    starts_at: survey.starts_at || null,
    ends_at: survey.ends_at || null,
    is_anonymous: Boolean(survey.is_anonymous),
    one_response_per_user: Boolean(survey.one_response_per_user),
    results_visible_to_students: Boolean(survey.results_visible_to_students),
    board_id: profile.class_id,
    created_by: profile.id,
  };

  try {
    ensureClient();
    let surveyId = survey.id;
    const isNew = !surveyId;
    if (!surveyId) {
      const { data, error } = await supabase.from(TABLES.surveys).insert(payload).select('*').maybeSingle();
      if (error || !data) {
        if (isRlsError(error || undefined)) return createOrUpdateSurveyLocal(profile, payload, questions);
        throw toSurveyError('설문을 저장할 수 없습니다.', error);
      }
      surveyId = data.id;
    } else {
      const { error } = await supabase.from(TABLES.surveys).update(payload).eq('id', surveyId);
      if (error) {
        if (isRlsError(error)) return createOrUpdateSurveyLocal(profile, payload, questions);
        throw toSurveyError('설문을 저장할 수 없습니다.', error);
      }
    }

    const { data: existingQuestions } = await supabase
      .from(TABLES.questions)
      .select('id')
      .eq('survey_id', surveyId);

    const existingQuestionIds = (existingQuestions || []).map((q) => q.id);
    const insertedQuestions: SurveyQuestion[] = [];
    const insertedQuestionIds: string[] = [];
    try {
      for (const q of questions) {
        const { data: qRow, error: qError } = await supabase
          .from(TABLES.questions)
          .insert({
            survey_id: surveyId,
            position: q.position,
            question_type: q.question_type,
            question_text: q.question_text,
            is_required: q.is_required,
            allow_image: q.allow_image,
          })
          .select('*')
          .maybeSingle();
        if (qError || !qRow) throw toSurveyError('문항을 저장할 수 없습니다.', qError);
        insertedQuestions.push(qRow as SurveyQuestion);
        insertedQuestionIds.push(qRow.id);

        if (q.choices?.length) {
          const choiceRows = q.choices.map((c, idx) => ({
            question_id: qRow.id,
            position: c.position ?? idx,
            option_text: c.option_text,
          }));
          const { error: cError } = await supabase.from(TABLES.options).insert(choiceRows);
          if (cError) throw toSurveyError('선택지를 저장할 수 없습니다.', cError);
        }
      }
    } catch (err) {
      if (insertedQuestionIds.length) {
        await supabase.from(TABLES.options).delete().in('question_id', insertedQuestionIds);
        await supabase.from(TABLES.questions).delete().in('id', insertedQuestionIds);
      }
      if (isNew && surveyId) {
        await supabase.from(TABLES.surveys).delete().eq('id', surveyId);
      }
      throw err;
    }

    if (existingQuestionIds.length) {
      await supabase.from(TABLES.options).delete().in('question_id', existingQuestionIds);
      await supabase.from(TABLES.questions).delete().in('id', existingQuestionIds);
    }

    return { surveyId, questions: insertedQuestions };
  } catch (err: any) {
    return createOrUpdateSurveyLocal(profile, payload, questions);
  }
};

export const deleteSurvey = async (surveyId: string) => {
  try {
    ensureClient();
    const { error } = await supabase.from(TABLES.surveys).delete().eq('id', surveyId);
    if (error) {
      if (isRlsError(error)) {
        deleteSurveyLocal(surveyId);
        return;
      }
      throw toSurveyError('설문을 삭제할 수 없습니다.', error);
    }
  } catch {
    deleteSurveyLocal(surveyId);
  }
};

export const getMyResponse = async (surveyId: string, userId: string) => {
  try {
    ensureClient();
    const { data, error } = await supabase
      .from(TABLES.responses)
      .select('*')
      .eq('survey_id', surveyId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error && isRlsError(error)) return null;
    return data || null;
  } catch {
    return null;
  }
};

export const getMyResponsesForSurveys = async (surveyIds: string[]) => {
  const { data: userData } = await supabase?.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId || surveyIds.length === 0) return [];
  try {
    ensureClient();
    const { data, error } = await supabase
      .from(TABLES.responses)
      .select('survey_id')
      .eq('user_id', userId)
      .in('survey_id', surveyIds);
    if (error && isRlsError(error)) return getMyResponsesForSurveysLocal(surveyIds, userId);
    return (data || []).map((row) => row.survey_id as string);
  } catch {
    return getMyResponsesForSurveysLocal(surveyIds, userId);
  }
};

export const submitSurveyResponse = async (
  surveyId: string,
  answers: SurveyAnswerInput[],
  oneResponsePerUser: boolean
) => {
  const profile = await getProfile();
  try {
    ensureClient();
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error('사용자 정보를 확인할 수 없습니다.');

    if (oneResponsePerUser) {
      const existing = await getMyResponse(surveyId, userId);
      if (existing) throw new Error('이미 제출한 설문입니다.');
    }

    const { data: responseRow, error: responseError } = await supabase
      .from(TABLES.responses)
      .insert({
        survey_id: surveyId,
        class_id: profile.class_id,
        user_id: userId,
        submitted_at: new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();
    if (responseError || !responseRow) {
      if (isRlsError(responseError || undefined)) {
        return submitSurveyResponseLocal(profile, surveyId, answers, oneResponsePerUser);
      }
      throw toSurveyError('응답을 저장할 수 없습니다.', responseError);
    }

    for (const answer of answers) {
      let primaryAnswerId: string | null = null;

      if (answer.type === 'single' || answer.type === 'multiple') {
        const choices = answer.choiceIds || [];
        if (choices.length === 0 && answer.required) {
          throw new Error('필수 문항을 확인해주세요.');
        }
        for (let i = 0; i < choices.length; i += 1) {
          const { data: row, error } = await supabase
            .from(TABLES.answers)
            .insert({
              response_id: responseRow.id,
              question_id: answer.questionId,
              choice_id: choices[i],
              text_answer: null,
            })
            .select('id')
            .maybeSingle();
          if (error || !row) throw toSurveyError('응답을 저장할 수 없습니다.', error);
          if (i === 0) primaryAnswerId = row.id;
        }
      } else {
        const text = answer.textAnswer?.trim() || '';
        if (!text && answer.required) {
          throw new Error('필수 문항을 확인해주세요.');
        }
        const { data: row, error } = await supabase
          .from(TABLES.answers)
          .insert({
            response_id: responseRow.id,
            question_id: answer.questionId,
            choice_id: null,
            text_answer: text || null,
          })
          .select('id')
          .maybeSingle();
        if (error || !row) throw toSurveyError('응답을 저장할 수 없습니다.', error);
        primaryAnswerId = row.id;
      }

      if (answer.attachmentFile && primaryAnswerId) {
        validateAttachment(answer.attachmentFile);
        const file = answer.attachmentFile;
        const ext = file.name.split('.').pop() || 'png';
        const path = `survey/${surveyId}/${responseRow.id}/${answer.questionId}/${primaryAnswerId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('survey-attachments').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw toSurveyError('파일 업로드에 실패했습니다.', uploadError);
        const { error: attachError } = await supabase.from(TABLES.attachments).insert({
          answer_id: primaryAnswerId,
          storage_path: path,
          mime_type: file.type,
          size: file.size,
        });
        if (attachError) throw toSurveyError('파일 정보를 저장할 수 없습니다.', attachError);
      }
    }

    return responseRow.id as string;
  } catch (err: any) {
    return submitSurveyResponseLocal(profile, surveyId, answers, oneResponsePerUser);
  }
};

export const getSurveyResults = async (surveyId: string) => {
  try {
    ensureClient();
    const { data: survey, error: surveyError } = await supabase
      .from(TABLES.surveys)
      .select('*')
      .eq('id', surveyId)
      .maybeSingle();
    if (surveyError || !survey) {
      if (isRlsError(surveyError || undefined)) return getSurveyResultsLocal(surveyId);
      throw toSurveyError('설문 정보를 찾을 수 없습니다.', surveyError);
    }

    const { data: questions } = await supabase
      .from(TABLES.questions)
      .select('*')
      .eq('survey_id', surveyId)
      .order('position', { ascending: true });
    const questionIds = (questions || []).map((q) => q.id);
    const { data: choices } = questionIds.length
      ? await supabase.from(TABLES.options).select('*').in('question_id', questionIds).order('position')
      : { data: [] as SurveyChoice[] };

    const { data: responses } = await supabase
      .from(TABLES.responses)
      .select('id, user_id, submitted_at')
      .eq('survey_id', surveyId);
    const responseIds = (responses || []).map((r) => r.id);

    const { data: answers } = responseIds.length
      ? await supabase.from(TABLES.answers).select('*').in('response_id', responseIds)
      : { data: [] as any[] };

    return {
      survey: survey as Survey,
      questions: (questions || []) as SurveyQuestion[],
      choices: (choices || []) as SurveyChoice[],
      responses: responses || [],
      answers: answers || [],
    };
  } catch {
    return getSurveyResultsLocal(surveyId);
  }
};
