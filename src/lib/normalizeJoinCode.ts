/**
 * 참여 코드(입장 코드) 정규화 — 교사 표시·학생 검증 시 동일 규칙 사용.
 * 테이블: public.classes, 컬럼: join_code. RPC: get_class_and_roster_by_join_code(p_join_code).
 */
export function normalizeJoinCode(code: string): string {
  return (code ?? '').trim().toUpperCase();
}

/** 디버그 로그용: 코드 일부만 마스킹 (앞2자+뒤1자) */
export function maskJoinCodeForLog(code: string): string {
  const n = (code ?? '').trim();
  if (n.length <= 3) return '***';
  return `${n.slice(0, 2)}***${n.slice(-1)}`;
}

/**
 * 학생 이름 비교용 정규화 — trim + 연속 공백 제거(한글 이름 임의 변경 금지).
 * 명부의 name 필드와 입력값을 동일 규칙으로 비교할 때 사용.
 */
export function normalizeStudentNameForCompare(name: string): string {
  return (name ?? '').trim().replace(/\s+/g, '');
}
