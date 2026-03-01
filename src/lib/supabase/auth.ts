import { supabase } from './client';
import { SUPABASE_URL } from '../../config/supabase';
import { MAX_STUDENTS_PER_CLASS } from '../../constants/limits';
import { getErrorMessage } from '../../utils/errors';
import { generateUUID } from '../../utils/uuid';

/** getSession/getUser가 실패할 때(다른 포트·도메인) localStorage에서 Supabase 세션 직접 읽기 */
const getUserIdFromStorage = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const projectRef = SUPABASE_URL ? SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0] : '';
    const key = projectRef ? `sb-${projectRef}-auth-token` : null;
    if (key) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        const user = data?.user ?? data?.currentSession?.user ?? data?.session?.user;
        if (user?.id) return user.id;
      }
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('sb-') && k?.endsWith('-auth-token')) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const data = JSON.parse(raw);
          const user = data?.user ?? data?.currentSession?.user ?? data?.session?.user;
          if (user?.id) return user.id;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return null;
};

const randomString = (length = 12) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

const generateJoinCode = (length = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
};

export const teacherSignIn = async (email: string, password: string) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(getErrorMessage(error));
  
  // After successful login, check if there's pending signup info
  // This handles Mode B: email confirmation required -> login -> create school/class
  const pendingInfoStr = localStorage.getItem('teacher_signup_pending');
  if (pendingInfoStr && data.user) {
    try {
      const pendingInfo = JSON.parse(pendingInfoStr);
      
      // Check if this is the same user
      if (pendingInfo.userId === data.user.id || pendingInfo.email === email) {
        console.log('[teacherSignIn] Found pending signup info, creating school/class');
        
        // Create school/class (idempotent)
        await createTeacherSchoolAndClass(
          data.user.id,
          pendingInfo.schoolName,
          pendingInfo.className,
          pendingInfo.displayName
        );
        
        // Clear pending info
        localStorage.removeItem('teacher_signup_pending');
        console.log('[teacherSignIn] School/class created, cleared pending info');
      }
    } catch (err) {
      console.error('[teacherSignIn] Error processing pending signup:', err);
      localStorage.setItem('teacher_onboarding_warning', '학급 설정이 필요합니다');
      // Don't fail login if this step fails
    }
  }
  
  return data;
};

/**
 * 학교/학급 생성 로직 (idempotent)
 * 이미 존재하면 기존 데이터 반환, 없으면 생성
 */
export const createTeacherSchoolAndClass = async (
  userId: string,
  schoolName: string,
  className: string,
  displayName?: string
): Promise<{ joinCode: string; schoolId: string; classId: string }> => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');

  console.log('[createTeacherSchoolAndClass] Starting for userId:', userId);

  // Check if profile already exists (idempotent check)
  const { data: existingProfile, error: profileError, count: profileCount } = await supabase
    .from('profiles')
    .select('id, school_id, class_id, role', { count: 'exact' })
    .eq('id', userId)
    .maybeSingle();
  console.log('[createTeacherSchoolAndClass] profile rows count:', profileCount ?? 0);
  if (profileError) {
    console.error('[createTeacherSchoolAndClass] profile select error:', {
      code: profileError.code,
      message: profileError.message,
      details: profileError.details,
    });
  }

  if (existingProfile && existingProfile.role === 'teacher' && existingProfile.class_id) {
    // Profile exists, get join code
    const klass = await getClassById(existingProfile.class_id);
    if (klass) {
      console.log('[createTeacherSchoolAndClass] Profile exists, returning existing join code');
      return {
        joinCode: klass.join_code,
        schoolId: existingProfile.school_id || '',
        classId: existingProfile.class_id,
      };
    }
  }

  // Step 2: Find or create school (upsert pattern)
  let school: { id: string };
  
  // Use maybeSingle() to avoid 406 when no row exists
  const { data: existingSchool, error: lookupError } = await supabase
    .from('schools')
    .select('id')
    .eq('name', schoolName)
    .maybeSingle();
  
  // Log lookup result
  if (lookupError) {
    console.error('[createTeacherSchoolAndClass] school lookup error:', {
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
      hint: lookupError.hint
    });
  }
  
  if (existingSchool) {
    school = existingSchool;
    console.log('[createTeacherSchoolAndClass] Using existing school:', school.id);
  } else {
    const { data: newSchool, error: schoolError } = await supabase
      .from('schools')
      .insert({ id: generateUUID(), name: schoolName })
      .select('id')
      .single();
    
    // Log insert error details
    if (schoolError) {
      console.error('[createTeacherSchoolAndClass] school insert error:', {
        code: schoolError.code,
        message: schoolError.message,
        details: schoolError.details,
        hint: schoolError.hint
      });
      
      // Handle different error types
      if (schoolError.code === 'PGRST116' || schoolError.message?.includes('404')) {
        throw new Error('학교 테이블에 접근할 수 없습니다. 데이터베이스 스키마를 확인해주세요.');
      }
      if (schoolError.code === '42501' || schoolError.message?.includes('permission') || schoolError.message?.includes('policy')) {
        throw new Error('데이터베이스 권한 오류입니다. RLS 정책을 확인해주세요.');
      }
      throw new Error(`학교 정보 저장 실패: ${getErrorMessage(schoolError)}`);
    }
    if (!newSchool) throw new Error('학교 정보를 생성할 수 없습니다.');
    school = newSchool;
    console.log('[createTeacherSchoolAndClass] Created new school:', school.id);
  }

  // Step 3: Create class with join code
  let createdClass: { id: string; join_code: string } | null = null;
  // Grade is required by DB schema (NOT NULL). Use selected value if available, otherwise default to 1.
  // Default is allowed as a safe fallback to avoid insert failure.
  const pendingInfoStr = localStorage.getItem('teacher_signup_pending');
  const pendingInfo = pendingInfoStr ? (() => {
    try {
      return JSON.parse(pendingInfoStr) as { grade?: unknown };
    } catch {
      return null;
    }
  })() : null;
  const gradeFromPending =
    typeof pendingInfo?.grade === 'number' ? pendingInfo.grade : undefined;
  const gradeFromClassName = (() => {
    const match = className.match(/(\d+)\s*학년/);
    if (!match) return undefined;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const classNoFromClassName = (() => {
    const match = className.match(/(\d+)\s*반/);
    if (!match) return undefined;
    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : undefined;
  })();
  const grade: number = gradeFromPending ?? gradeFromClassName ?? 1; // default 1 when no selection
  const classNo: number = classNoFromClassName ?? 1; // default 1 when no selection
  // created_by is NOT NULL in DB, so require a valid session user
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (!sessionUserId || sessionUserId !== userId) {
    throw new Error('세션을 확인할 수 없습니다. 다시 로그인해주세요.');
  }
  for (let i = 0; i < 5; i += 1) {
    const joinCode = generateJoinCode();

    const { data: existingClass, count: classCount } = await supabase
      .from('classes')
      .select('id, join_code', { count: 'exact' })
      .eq('school_id', school.id)
      .eq('grade', grade)
      .eq('class_no', classNo)
      .eq('created_by', sessionUserId)
      .maybeSingle();
    console.log('[createTeacherSchoolAndClass] class rows count:', classCount ?? 0);

    if (existingClass?.id) {
      // Do not update join_code here; reuse existing class on signup flow.
      createdClass = existingClass;
      console.log('Found existing class -> updating join_code');
      break;
    }

    const classInsertPayload = {
      id: generateUUID(),
      school_id: school.id,
      name: className,
      grade,
      class_no: classNo,
      created_by: sessionUserId,
      join_code: joinCode,
      join_code_created_at: new Date().toISOString(),
    };
    const { data: klass, error: classError } = await supabase
      .from('classes')
      .insert(classInsertPayload)
      .select('id, join_code')
      .single();

    if (!classError) {
      createdClass = klass;
      console.log('Inserted new class');
      break;
    }
    // If duplicate key on class (race), reuse existing instead of retry
    if (classError.code === '23505') {
      const { data: racedClass, count: racedCount } = await supabase
        .from('classes')
        .select('id, join_code', { count: 'exact' })
        .eq('school_id', school.id)
        .eq('grade', grade)
        .eq('class_no', classNo)
        .eq('created_by', sessionUserId)
        .maybeSingle();
      console.log('[createTeacherSchoolAndClass] raced class rows count:', racedCount ?? 0);
      if (racedClass?.id) {
        createdClass = racedClass;
        console.log('Found existing class -> updating join_code');
        break;
      }
      // Otherwise assume join_code collision and retry
      continue;
    }
    if (classError.code === 'PGRST116' || classError.message?.includes('404')) {
      throw new Error('학급 테이블에 접근할 수 없습니다. 데이터베이스 스키마를 확인해주세요.');
    }
    if (classError.code === '42501' || classError.message?.includes('permission') || classError.message?.includes('policy')) {
      throw new Error('데이터베이스 권한 오류입니다. RLS 정책을 확인해주세요.');
    }
    throw new Error(`학급 생성 실패: ${getErrorMessage(classError)}`);
  }

  if (!createdClass) throw new Error('학급 코드를 생성할 수 없습니다. (중복 코드 시도 5회 초과)');

  // Step 4: Create or update profile
  if (!existingProfile) {
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      role: 'teacher',
      school_id: school.id,
      class_id: createdClass.id,
      display_name: displayName || '선생님',
    });
    
    // Log profile insert error details
    if (profileError) {
      console.error('[createTeacherSchoolAndClass] profile insert error:', {
        code: profileError.code,
        message: profileError.message,
        details: profileError.details,
        hint: profileError.hint
      });
      
      if (profileError.code === 'PGRST116' || profileError.message?.includes('404')) {
        throw new Error('프로필 테이블에 접근할 수 없습니다. 데이터베이스 스키마를 확인해주세요.');
      }
      if (profileError.code === '42501' || profileError.message?.includes('permission') || profileError.message?.includes('policy')) {
        throw new Error('데이터베이스 권한 오류입니다. RLS 정책을 확인해주세요.');
      }
      throw new Error(`프로필 생성 실패: ${getErrorMessage(profileError)}`);
    }
    console.log('[createTeacherSchoolAndClass] Created new profile');
  } else if (!existingProfile.class_id || !existingProfile.school_id) {
    // 프로필은 있으나 학교/학급이 연결되지 않은 경우(예: 로그인 시 생성 실패) 업데이트
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        school_id: school.id,
        class_id: createdClass.id,
        display_name: displayName || '선생님',
      })
      .eq('id', userId);
    if (profileUpdateError) {
      console.error('[createTeacherSchoolAndClass] profile update error:', profileUpdateError);
      throw new Error(`프로필 연결 실패: ${getErrorMessage(profileUpdateError)}`);
    }
    console.log('[createTeacherSchoolAndClass] Updated existing profile with school/class');
  } else {
    console.log('[createTeacherSchoolAndClass] Profile already exists, skipped');
  }

  return {
    joinCode: createdClass.join_code,
    schoolId: school.id,
    classId: createdClass.id,
  };
};

export type SignUpResult = 
  | { success: true; joinCode: string; requiresEmailConfirmation: false }
  | { success: true; requiresEmailConfirmation: true };

export const teacherSignUp = async (
  email: string,
  password: string,
  schoolName: string,
  className: string,
  displayName: string
): Promise<SignUpResult> => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  
  // Step 1: Create auth user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  
  // Log signup result
  console.log('[teacherSignUp] signUp result:', {
    user: signUpData.user?.id,
    session: !!signUpData.session,
    error: signUpError ? { code: signUpError.code, message: signUpError.message } : null
  });
  
  if (signUpError) throw new Error(getErrorMessage(signUpError));
  const userId = signUpData.user?.id;
  if (!userId) throw new Error('사용자 정보를 확인할 수 없습니다.');

  // Step 1.5: Check session after signup
  const { data: sessionData } = await supabase.auth.getSession();
  console.log('[teacherSignUp] session after signUp:', {
    hasSession: !!sessionData.session,
    userId: sessionData.session?.user?.id
  });

  // Mode A: If session exists (email confirmation disabled), create school/class immediately
  if (sessionData.session) {
    console.log('[teacherSignUp] Mode A: Session exists, creating school/class immediately');
    const result = await createTeacherSchoolAndClass(userId, schoolName, className, displayName);
    return { success: true, joinCode: result.joinCode, requiresEmailConfirmation: false };
  }

  // Mode B: No session (email confirmation required), store info and return
  console.log('[teacherSignUp] Mode B: No session, email confirmation required');
  
  // Store school/class info in localStorage for later use after login
  const pendingInfo = {
    userId,
    schoolName,
    className,
    displayName,
    email,
  };
  localStorage.setItem('teacher_signup_pending', JSON.stringify(pendingInfo));
  console.log('[teacherSignUp] Stored pending signup info');

  return { success: true, requiresEmailConfirmation: true };
};

export const teacherSignOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

export const resendSignupConfirmation = async (email: string) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) throw new Error(getErrorMessage(error));
  return true;
};

export const studentJoinWithCode = async (joinCode: string, displayName: string) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  const normalized = joinCode.trim().toUpperCase();
  const { data: klass, error: classError } = await supabase
    .from('classes')
    .select('id, school_id, join_code')
    .eq('join_code', normalized)
    .single();
  if (classError || !klass) throw new Error('참여 코드가 올바르지 않습니다.');

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('class_id', klass.id);

  if ((count ?? 0) >= MAX_STUDENTS_PER_CLASS) {
    throw new Error('현재 학급 인원이 가득 찼습니다.');
  }

  const email = `student+${randomString(10)}@example.local`;
  const password = randomString(16);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });
  if (signUpError) throw new Error(getErrorMessage(signUpError));

  const userId = signUpData.user?.id;
  if (!userId) throw new Error('학생 계정을 생성할 수 없습니다.');

  const { error: profileError } = await supabase.from('profiles').insert({
    id: userId,
    role: 'student',
    school_id: klass.school_id,
    class_id: klass.id,
    display_name: displayName,
  });
  if (profileError) throw new Error(getErrorMessage(profileError));

  await supabase.auth.signInWithPassword({ email, password });
  return { userId, classId: klass.id, schoolId: klass.school_id };
};

export const getSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const getCurrentUserProfile = async () => {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  let userId = userData.user?.id;
  if (!userId) {
    const session = await getSession();
    userId = session?.user?.id ?? undefined;
  }
  if (!userId) {
    userId = getUserIdFromStorage() ?? undefined;
  }
  if (!userId) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('[getCurrentUserProfile] Error:', error);
    return null;
  }
  return data;
};

export const getTeacherProfileDetails = async () => {
  if (!supabase) return null;
  const profile = await getCurrentUserProfile();
  if (!profile || profile.role !== 'teacher') return null;

  const { data: klass } = await supabase
    .from('classes')
    .select('id, name, school_id')
    .eq('id', profile.class_id)
    .maybeSingle();

  const { data: school } = await supabase
    .from('schools')
    .select('id, name')
    .eq('id', profile.school_id)
    .maybeSingle();

  return {
    displayName: profile.display_name || '',
    schoolName: school?.name || '',
    className: klass?.name || '',
  };
};

const DEBUG_AUTH = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export const updateTeacherProfile = async ({
  displayName,
  schoolName,
  className,
}: {
  displayName: string;
  schoolName: string;
  className: string;
}) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');

  // 1) userId 확보: 세션 → getUser → localStorage → (실패 시) 짧은 대기 후 getSession 재시도 (세션 재수화 레이스 대응)
  let session = await getSession();
  let userId: string | null | undefined = session?.user?.id;
  if (!userId) {
    const { data: userData } = await supabase.auth.getUser();
    userId = userData.user?.id ?? undefined;
    if (DEBUG_AUTH) {
      console.log('[updateTeacherProfile] getSession user:', session?.user?.id ?? null, 'getUser user:', userData?.user?.id ?? null);
    }
  }
  if (!userId) {
    userId = getUserIdFromStorage();
  }
  if (!userId) {
    await new Promise((r) => setTimeout(r, 150));
    session = await getSession();
    userId = session?.user?.id ?? undefined;
    if (!userId) {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id ?? undefined;
    }
    if (!userId) userId = getUserIdFromStorage();
  }
  if (!userId) {
    const storageKeys: string[] = [];
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith('sb-') && k?.endsWith('-auth-token')) storageKeys.push(k);
      }
    }
    if (DEBUG_AUTH) {
      console.error('[updateTeacherProfile] userId null — session:', !!session, 'session?.user?.id:', session?.user?.id ?? null, 'storage keys:', storageKeys);
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const noStorageOnOrigin = storageKeys.length === 0 && origin;
    const message = noStorageOnOrigin
      ? `현재 주소(${origin})에는 저장된 로그인 정보가 없습니다. 다른 주소(예: localhost)에서 로그인하셨을 수 있습니다. 아래 "이 페이지에서 다시 로그인"을 눌러 지금 주소로 로그인해주세요.`
      : '로그인 정보를 확인할 수 없습니다. 이 페이지에서 다시 로그인해주세요.';
    const err = new Error(message) as Error & { code?: string };
    err.code = noStorageOnOrigin ? 'SESSION_NOT_ON_ORIGIN' : 'SESSION_UNKNOWN';
    throw err;
  }
  if (DEBUG_AUTH) console.log('[updateTeacherProfile] userId:', userId);

  // 2) userId로 프로필 직접 조회 (getCurrentUserProfile이 null이어도 저장 가능하도록)
  const { data: profile, error: profileFetchError } = await supabase
    .from('profiles')
    .select('id, role, school_id, class_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileFetchError) {
    if (DEBUG_AUTH) console.error('[updateTeacherProfile] supabase error:', profileFetchError, profileFetchError?.code, profileFetchError?.message, profileFetchError?.details);
    throw new Error('프로필을 불러오지 못했습니다. 다시 시도해주세요.');
  }

  // 3) 프로필 없음 또는 학교/학급 미연결 → 학교·학급 생성(및 프로필 생성·연결)
  if (!profile || profile.role !== 'teacher' || !profile.class_id || !profile.school_id) {
    await createTeacherSchoolAndClass(userId, schoolName, className, displayName);
    return;
  }

  // 4) 기존 프로필·학교·학급 수정
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', profile.id);
  if (profileError) {
    if (DEBUG_AUTH) console.error('[updateTeacherProfile] supabase error:', profileError, profileError?.code, profileError?.message, profileError?.details);
    throw new Error(getErrorMessage(profileError, '프로필 수정에 실패했습니다.'));
  }

  const { error: schoolError } = await supabase
    .from('schools')
    .update({ name: schoolName })
    .eq('id', profile.school_id);
  if (schoolError) {
    if (DEBUG_AUTH) console.error('[updateTeacherProfile] supabase error:', schoolError, schoolError?.code, schoolError?.message, schoolError?.details);
    throw new Error(getErrorMessage(schoolError, '학교 정보 수정에 실패했습니다.'));
  }

  const { error: classError } = await supabase
    .from('classes')
    .update({ name: className })
    .eq('id', profile.class_id);
  if (classError) {
    if (DEBUG_AUTH) console.error('[updateTeacherProfile] supabase error:', classError, classError?.code, classError?.message, classError?.details);
    throw new Error(getErrorMessage(classError, '학급 정보 수정에 실패했습니다.'));
  }
};

export const getClassById = async (classId: string) => {
  if (!supabase) return null;
  const { data } = await supabase
    .from('classes')
    .select('id, join_code, grade, class_no, school_id')
    .eq('id', classId)
    .single();
  return data;
};

export const regenerateJoinCode = async (classId: string) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  let newCode = generateJoinCode();
  const { data, error } = await supabase
    .from('classes')
    .update({ join_code: newCode, join_code_created_at: new Date().toISOString() })
    .eq('id', classId)
    .select('join_code')
    .single();
  if (error) throw new Error(getErrorMessage(error));
  return data.join_code;
};

export const regenerateJoinCodeByClassKey = async (
  schoolId: string,
  grade: number,
  classNo: number
) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');

  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (!sessionUserId) throw new Error('세션을 확인할 수 없습니다. 다시 로그인해주세요.');

  const { data: existingClass, count } = await supabase
    .from('classes')
    .select('id, join_code', { count: 'exact' })
    .eq('school_id', schoolId)
    .eq('grade', grade)
    .eq('class_no', classNo)
    .eq('created_by', sessionUserId)
    .maybeSingle();

  console.log('[regenerateJoinCodeByClassKey] select rows count:', count ?? 0);
  if ((count ?? 0) > 1) {
    throw new Error('학급 데이터가 중복되어 있습니다. 관리자에게 문의해주세요.');
  }
  if (!existingClass?.id) {
    throw new Error('반이 없습니다. 먼저 반 생성이 필요합니다.');
  }

  for (let i = 0; i < 5; i += 1) {
    const newCode = generateJoinCode();
    const { data: updatedRows, error } = await supabase
      .from('classes')
      .update({ join_code: newCode, join_code_created_at: new Date().toISOString() })
      .eq('id', existingClass.id)
      .eq('created_by', sessionUserId)
      .select('id, join_code');

    const updatedClass = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (!error && updatedClass) return updatedClass;
    console.error('[regenerateJoinCodeByClassKey] update error:', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    if (error.code === '23505' || error.message?.includes('unique')) {
      continue;
    }
    if (
      error.code === 'PGRST116' ||
      error.message?.includes('Cannot coerce') ||
      error.message?.includes('No rows')
    ) {
      console.error('[regenerateJoinCodeByClassKey] RLS or where condition mismatch');
      throw new Error('학급 코드 갱신이 차단되었습니다. RLS 또는 조건을 확인해주세요.');
    }
    throw new Error(getErrorMessage(error));
  }

  throw new Error('학급 코드 갱신에 실패했습니다. (중복 코드 시도 5회 초과)');
};

export const regenerateJoinCodeByClassId = async (
  classId: string,
  userId: string
) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  if (!classId) {
    console.warn('[regenerateJoinCodeByClassId] missing classId');
    return null;
  }

  const { data: existingClass, count } = await supabase
    .from('classes')
    .select('id, join_code, created_by', { count: 'exact' })
    .eq('id', classId)
    .eq('created_by', userId)
    .maybeSingle();

  console.log('[regenerateJoinCodeByClassId] select rows count:', count ?? 0);
  if ((count ?? 0) > 1) {
    console.warn('[regenerateJoinCodeByClassId] duplicate classId rows', { classId });
    return null;
  }
  if (!existingClass?.id) {
    console.warn('[regenerateJoinCodeByClassId] class not found or no permission', { classId });
    return null;
  }

  for (let i = 0; i < 5; i += 1) {
    const newCode = generateJoinCode();
    // Use primary key and return array to avoid 406 when 0 rows match
    const { data: updatedRows, error } = await supabase
      .from('classes')
      .update({ join_code: newCode, join_code_created_at: new Date().toISOString() })
      .eq('id', existingClass.id)
      .eq('created_by', userId)
      .select('id, join_code');

    const updatedClass = Array.isArray(updatedRows) ? updatedRows[0] : null;
    if (!error && updatedClass) return updatedClass;
    if (error) {
      console.error('[regenerateJoinCodeByClassId] update error', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        classId,
      });
    } else {
      console.warn('[regenerateJoinCodeByClassId] no rows updated', { classId });
    }
    if (error?.code === '23505' || error?.message?.includes('unique')) {
      continue;
    }
    return null;
  }

  return null;
};
