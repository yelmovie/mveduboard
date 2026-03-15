
import { ClassStudent } from '../types';
import { generateUUID } from '../src/utils/uuid';
import { supabase } from '../src/lib/supabase/client';

const LS_KEY = 'edu_class_roster';
const MAX_STUDENTS = 30;

// Helper to get class-specific localStorage key
const getClassRosterKey = (classId?: string | null): string => {
  if (classId) {
    return `${LS_KEY}_${classId}`;
  }
  // Fallback to old key for backward compatibility
  return LS_KEY;
};

const DEFAULT_ROSTER: string[] = [
  '권훈도', '김윤다', '김형시', '김유지', '박한주',
  '김후강', '김아보', '김율은', '남재승', '박준하',
  '반원진', '배호윤', '유선미', '이연가', '이율가',
  '이연도', '이준서', '이승민', '장미재', '이준호',
  '장서윤', '정수빈', '정우진', '조미수', '최서연',
  '한지우', '강민재', '고은아', '노하윤', '문서준'
];

// Cache for class_id to avoid repeated async calls
let cachedClassId: string | null | undefined = undefined;
let classIdPromise: Promise<string | null> | null = null;

// Get current user's class_id from Supabase profile (with caching)
const getCurrentClassId = (): string | null => {
  // Return cached value if available
  if (cachedClassId !== undefined) {
    return cachedClassId;
  }
  
  // If promise is already in flight, return null (will be set on next call)
  if (classIdPromise) {
    return null;
  }
  
  // Start async fetch and cache result
  classIdPromise = (async () => {
    try {
      const { getCurrentUserProfile } = await import('../src/lib/supabase/auth');
      const profile = await getCurrentUserProfile();
      const classId = profile?.class_id || null;
      cachedClassId = classId;
      return classId;
    } catch {
      cachedClassId = null;
      return null;
    } finally {
      classIdPromise = null;
    }
  })();
  
  // For synchronous call, return null (will be populated on next call)
  return null;
};

// Preload classId (call this on app init or login)
export const preloadClassId = async (): Promise<string | null> => {
  if (cachedClassId !== undefined) {
    return cachedClassId;
  }
  if (classIdPromise) {
    return await classIdPromise;
  }
  classIdPromise = (async () => {
    try {
      const { getCurrentUserProfile } = await import('../src/lib/supabase/auth');
      const profile = await getCurrentUserProfile();
      const classId = profile?.class_id || null;
      cachedClassId = classId;
      return classId;
    } catch {
      cachedClassId = null;
      return null;
    } finally {
      classIdPromise = null;
    }
  })();
  return await classIdPromise;
};

// Clear cache (call on logout or account switch)
export const clearRosterCache = () => {
  cachedClassId = undefined;
  classIdPromise = null;
};

// Synchronous version (for backward compatibility)
export const normalizeRoster = (students: ClassStudent[]): ClassStudent[] => {
  const sanitized = students.map((s) => ({
    ...s,
    number: Number.isFinite(s.number) ? s.number : 0,
  }));
  const sorted = sanitized.sort((a, b) => (a.number || 0) - (b.number || 0));
  const used = new Set<number>();
  const available = Array.from({ length: MAX_STUDENTS }, (_, i) => i + 1);
  const result: ClassStudent[] = [];
  for (const student of sorted) {
    const desired = student.number;
    let assigned: number | undefined;
    if (desired && desired >= 1 && desired <= MAX_STUDENTS && !used.has(desired)) {
      assigned = desired;
    } else {
      assigned = available.find((n) => !used.has(n));
    }
    if (!assigned) {
      continue;
    }
    used.add(assigned);
    result.push({ ...student, number: assigned });
  }
  return result;
};

export const getRoster = (): ClassStudent[] => {
  try {
    const classId = getCurrentClassId();
    const key = getClassRosterKey(classId);

    const stored = localStorage.getItem(key);
    if (stored) {
      const students: ClassStudent[] = JSON.parse(stored);
      if (Array.isArray(students)) return normalizeRoster(students);
    }

    // 기존 키(edu_class_roster)에 데이터 있으면 마이그레이션
    const oldStored = localStorage.getItem(LS_KEY);
    if (oldStored) {
      const students: ClassStudent[] = JSON.parse(oldStored);
      if (Array.isArray(students)) {
        const normalized = normalizeRoster(students);
        if (classId) saveRoster(normalized); // classId 있으면 새 키로 저장
        return normalized;
      }
    }
  } catch {
    // localStorage 손상 또는 파싱 오류 시 빈 배열 반환
  }
  return [];
};

export const saveRoster = (students: ClassStudent[]) => {
  const normalized = normalizeRoster(students);
  const classId = getCurrentClassId();
  const key = getClassRosterKey(classId);
  localStorage.setItem(key, JSON.stringify(normalized));
};

export const updateStudent = (id: string, name: string, number: number) => {
    const roster = getRoster();
    const updated = roster.map(s => s.id === id ? { ...s, name, number } : s);
    saveRoster(updated);
};

export const addStudent = (name: string, number?: number) => {
  const roster = getRoster();
  const nextNum = number || (roster.length > 0 ? Math.max(...roster.map(s => s.number)) + 1 : 1);
  const newStudent: ClassStudent = {
    id: generateUUID(),
    number: nextNum,
    name
  };
  saveRoster([...roster, newStudent]);
  return newStudent;
};

export const removeStudent = (id: string) => {
    const roster = getRoster();
    const updated = roster.filter(s => s.id !== id);
    saveRoster(updated);
};

export const saveRosterToDb = async (students: ClassStudent[], classId: string) => {
  if (!supabase) throw new Error('Supabase 환경변수가 필요합니다.');
  if (!classId) throw new Error('학급 정보를 찾을 수 없습니다.');
  const normalized = normalizeRoster(students);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('세션을 확인할 수 없습니다. 다시 로그인해주세요.');

  const { error: deleteError, count: deletedCount } = await supabase
    .from('students')
    .delete({ count: 'exact' })
    .eq('class_id', classId)
    .eq('created_by', userId);
  if (deleteError) {
    console.error('[studentService] delete failed', {
      code: deleteError.code,
      message: deleteError.message,
    });
    throw new Error(`삭제 실패: ${deleteError.message}`);
  }
  console.info(`[studentService] deleted ${deletedCount ?? '?'} rows before insert`);

  const payload = normalized.map((s, idx) => ({
    class_id: classId,
    name: s.name,
    student_no: s.number ?? idx + 1,
    gender: s.gender ?? null,
    created_by: userId,
  }));
  const { error: insertError } = await supabase.from('students').insert(payload);
  if (insertError) {
    console.error('[studentService] insert failed', {
      code: insertError.code,
      message: insertError.message,
    });
    throw new Error(`저장 실패: ${insertError.message}`);
  }

  // 이중 저장: classes.roster_data에 백업 (데이터 유실 방지)
  const rosterPayload = normalized.map((s) => ({
    id: s.id,
    number: s.number,
    name: s.name,
    gender: s.gender,
    birthDate: s.birthDate ?? null,
    previousGradeClass: s.previousGradeClass ?? null,
    remarks: s.remarks ?? null,
    siblings: s.siblings ?? null,
  }));
  await supabase.from('classes').update({ roster_data: rosterPayload }).eq('id', classId);

  saveRoster(normalized);
  cachedClassId = classId;
  return true;
};

export const fetchRosterFromDb = async (): Promise<ClassStudent[]> => {
  if (!supabase) return getRoster();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return getRoster();
  const { getCurrentUserProfile } = await import('../src/lib/supabase/auth');
  const profile = await getCurrentUserProfile();
  const classId = profile?.class_id;
  if (!classId) return getRoster();

  cachedClassId = classId;

  // 1) students 테이블에서 로드
  const { data: studentsData, error } = await supabase
    .from('students')
    .select('id, name, student_no, gender')
    .eq('class_id', classId)
    .eq('created_by', userId)
    .order('student_no', { ascending: true });

  if (!error && studentsData && studentsData.length > 0) {
    const mapped: ClassStudent[] = studentsData.map((s, idx) => ({
      id: s.id,
      name: s.name,
      number: s.student_no ?? idx + 1,
      gender: s.gender === 'male' || s.gender === 'female' ? s.gender : undefined,
    }));
    // roster_data에서 생년월일·이전학년반 병합
    const { data: classRow } = await supabase
      .from('classes')
      .select('roster_data')
      .eq('id', classId)
      .maybeSingle();
    const rosterData = classRow?.roster_data as Array<{ id: string; number: number; name: string; gender?: string; birthDate?: string; previousGradeClass?: string; remarks?: string; siblings?: string }> | null;
    if (rosterData && Array.isArray(rosterData)) {
      const byId = new Map(rosterData.map((r) => [r.id, r]));
      mapped.forEach((s) => {
        const extra = byId.get(s.id);
        if (extra) {
          s.birthDate = extra.birthDate ?? undefined;
          s.previousGradeClass = extra.previousGradeClass ?? undefined;
          s.remarks = extra.remarks ?? undefined;
          s.siblings = extra.siblings ?? undefined;
        }
      });
    }
    const normalized = normalizeRoster(mapped);
    saveRoster(normalized);
    return normalized;
  }

  if (error) {
    console.error('[studentService] fetchRosterFromDb students error', {
      code: error.code,
      message: error.message,
    });
  }

  // 2) classes.roster_data 백업에서 로드 (데이터 유실 방지)
  const { data: classRow } = await supabase
    .from('classes')
    .select('roster_data')
    .eq('id', classId)
    .maybeSingle();

  const rosterData = classRow?.roster_data as Array<{ id: string; number: number; name: string; gender?: string; birthDate?: string; previousGradeClass?: string; remarks?: string; siblings?: string }> | null;
  if (rosterData && Array.isArray(rosterData) && rosterData.length > 0) {
    const mapped: ClassStudent[] = rosterData.map((s) => ({
      id: s.id || generateUUID(),
      name: s.name,
      number: s.number ?? 0,
      gender: s.gender === 'male' || s.gender === 'female' ? s.gender : undefined,
      birthDate: s.birthDate ?? undefined,
      previousGradeClass: s.previousGradeClass ?? undefined,
      remarks: s.remarks ?? undefined,
      siblings: s.siblings ?? undefined,
    }));
    const normalized = normalizeRoster(mapped);
    saveRoster(normalized);
    return normalized;
  }

  // 3) 빈 데이터로 덮어쓰지 않음 - 기존 로컬 유지
  return getRoster();
};

export const fetchRosterByJoinCode = async (joinCode: string): Promise<ClassStudent[]> => {
  if (!supabase) throw new Error('참여 코드를 확인할 수 없습니다.');
  const normalizedCode = joinCode.trim().toUpperCase();
  if (!normalizedCode) return [];
  const { data: payload, error } = await supabase.rpc('get_class_and_roster_by_join_code', {
    p_join_code: normalizedCode,
  });
  if (error) {
    console.error('[studentService] fetchRosterByJoinCode RPC error', { code: error.code, message: error.message, hint: error.hint });
    throw new Error('참여 코드를 확인할 수 없습니다. 코드를 다시 입력하거나 잠시 후 시도해주세요.');
  }
  if (!payload || !payload.id) {
    throw new Error('참여 코드가 올바르지 않습니다. 선생님이 알려주신 6자리 코드를 확인해주세요.');
  }
  const students = (payload.students as Array<{ id: string; name: string; student_no?: number; gender?: string }>) ?? [];
  const mapped: ClassStudent[] = students.map((s, idx) => ({
    id: s.id,
    name: s.name,
    number: s.student_no ?? idx + 1,
    gender: s.gender === 'male' || s.gender === 'female' ? s.gender : undefined,
  }));
  return normalizeRoster(mapped);
};

// Helper to reset to default (with samples)
export const resetRoster = () => {
    const classId = getCurrentClassId();
    const key = getClassRosterKey(classId);
    localStorage.removeItem(key);
    
    // Initialize with default samples
    const students: ClassStudent[] = DEFAULT_ROSTER.map((name, i) => ({
      id: generateUUID(),
      number: i + 1,
      name
    }));
    saveRoster(students);
    return students;
}

// Clear roster (empty, no samples)
export const clearRoster = () => {
    const classId = getCurrentClassId();
    const key = getClassRosterKey(classId);
    localStorage.removeItem(key);
    return [];
}
