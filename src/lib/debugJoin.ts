/**
 * 배포/런타임 검증용. ?debugJoin=1 일 때만 활성화.
 * 민감정보 전체 노출 금지 — prefix/suffix만 사용.
 */

/** URL에 ?debugJoin=1 이 있을 때 true */
export function isDebugJoin(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('debugJoin') === '1';
}

/** 빌드 시 주입 가능한 커밋 해시 (vite define) */
declare global {
  interface ImportMetaEnv {
    VITE_GIT_SHA?: string;
  }
}
const GIT_SHA = import.meta.env.VITE_GIT_SHA ?? '';

export function getBuildInfo(): { gitSha: string; isProd: boolean } {
  return {
    gitSha: GIT_SHA || 'not-injected',
    isProd: import.meta.env.PROD,
  };
}

/** Supabase URL에서 host prefix만 (민감정보 최소) */
export function getSupabaseHostPrefix(url: string): string {
  if (!url || !url.startsWith('http')) return '(not-set)';
  try {
    const u = new URL(url);
    const host = u.host;
    if (host.length <= 12) return host;
    return host.slice(0, 8) + '...';
  } catch {
    return '(invalid)';
  }
}

/** anon key 앞 6자 / 뒤 4자만 (전체 노출 금지) */
export function getAnonKeySafeHint(key: string): string {
  if (!key || key.length < 10) return '(not-set)';
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export type JoinDebugLog = {
  rawCodeLength: number;
  normalizedCodeMasked: string;
  rawNameLength: number;
  normalizedNameMasked: string;
  targetRpc: string;
  resultExists: boolean;
  matchedStudentExists: boolean;
  failureReason: string;
  rpcStudentCount?: number;
};

let lastJoinDebugLog: JoinDebugLog | null = null;

export function setLastJoinDebugLog(log: JoinDebugLog): void {
  lastJoinDebugLog = log;
}

export function getLastJoinDebugLog(): JoinDebugLog | null {
  return lastJoinDebugLog;
}

/** 프로덕션에서도 ?debugJoin=1 이면 콘솔에 safe 로그 출력 */
export function logJoinDebug(label: string, data: Record<string, unknown>): void {
  if (!isDebugJoin()) return;
  console.log(`[join-debug] ${label}`, data);
}
