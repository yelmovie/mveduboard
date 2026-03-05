/**
 * classes 테이블 jsonb 컬럼과 localStorage 동기화
 * - 사용자 데이터 유실 방지: Supabase 이중 저장 + 빈 데이터 덮어쓰기 금지
 */
import { supabase } from '../src/lib/supabase/client';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';

let suppressColumnErrors: Record<string, boolean> = {};

export async function getClassIdForSync(): Promise<string | null> {
  const profile = await getCurrentUserProfile();
  return profile?.class_id ?? null;
}

/** Supabase에서 컬럼 로드. 있으면 반환, 없거나 오류면 null */
export async function loadClassColumn<T>(column: string, classId?: string | null): Promise<T | null> {
  const cid = classId ?? (await getClassIdForSync());
  if (!supabase || !cid || suppressColumnErrors[column]) return null;
  const { data, error } = await supabase
    .from('classes')
    .select(column)
    .eq('id', cid)
    .maybeSingle();
  if (error) {
    if (error.message?.includes(column)) suppressColumnErrors[column] = true;
    return null;
  }
  const val = (data as Record<string, unknown>)?.[column];
  return (val != null && val !== null) ? (val as T) : null;
}

/** Supabase에 컬럼 저장. 선생님만, 빈 데이터 덮어쓰기 방지 */
export async function saveClassColumn(column: string, data: unknown, classId?: string | null): Promise<boolean> {
  const profile = await getCurrentUserProfile();
  const cid = classId ?? profile?.class_id ?? null;
  if (!supabase || !cid || profile?.role !== 'teacher' || suppressColumnErrors[column]) return false;
  const { error } = await supabase
    .from('classes')
    .update({ [column]: data })
    .eq('id', cid);
  if (error) {
    if (error.message?.includes(column)) suppressColumnErrors[column] = true;
    return false;
  }
  return true;
}

/** 로드 시: Supabase 우선, 빈 데이터로 로컬 덮어쓰지 않음 */
export async function loadWithSupabaseFallback<T>(
  column: string,
  getLocal: () => T,
  saveLocal: (d: T) => void,
  isEmpty: (d: T) => boolean
): Promise<T> {
  const remote = await loadClassColumn<T>(column);
  if (remote != null && !isEmpty(remote)) {
    saveLocal(remote);
    return remote;
  }
  return getLocal();
}
