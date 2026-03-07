import { Notice } from '../types';
import { loadWithSupabaseFallback, saveClassColumn } from '../lib/classDataSync';

const LS_KEY_PREFIX = 'edu_notice_';
const INIT_KEY = 'edu_notice_initialized';

export type NoticeDataMap = Record<string, Notice>;

const SAMPLE_NOTICE = `[알림장]
1. 내일 준비물: 색종이, 가위, 풀 ✂️
2. 받아쓰기 공책 가져오기 (3급) 📝
3. 우유 급식 신청서 제출 (~금요일)
4. 도서관에서 빌린 책 반납하기 📚
5. 손 깨끗이 씻고 다니기! 🧼`;

const initializeNotice = () => {
  if (!localStorage.getItem(INIT_KEY)) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${LS_KEY_PREFIX}${today}`;
    const notice: Notice = {
      date: today,
      content: SAMPLE_NOTICE,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(notice));
    localStorage.setItem(INIT_KEY, 'true');
  }
};

function getLocalNoticeMap(): NoticeDataMap {
  initializeNotice();
  const map: NoticeDataMap = {};
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === INIT_KEY || !key.startsWith(LS_KEY_PREFIX)) continue;
    const datePart = key.slice(LS_KEY_PREFIX.length);
    if (!datePattern.test(datePart)) continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const notice = JSON.parse(raw) as Notice;
      if (notice && typeof notice.date === 'string' && typeof notice.content === 'string') {
        map[datePart] = {
          date: notice.date,
          content: notice.content,
          updatedAt: notice.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      // skip invalid
    }
  }
  return map;
}

function saveLocalNoticeMap(data: NoticeDataMap): void {
  for (const date of Object.keys(data)) {
    localStorage.setItem(`${LS_KEY_PREFIX}${date}`, JSON.stringify(data[date]));
  }
}

function isEmptyNoticeMap(d: NoticeDataMap): boolean {
  return Object.keys(d).length === 0;
}

const SYNC_TIMEOUT_MS = 8000;

/** Supabase + localStorage에서 해당 날짜 알림장 로드 (저장 기능 연동, 타임아웃 시 로컬만 사용) */
export async function getNoticeAsync(date: string): Promise<Notice | null> {
  try {
    const merged = await Promise.race([
      loadWithSupabaseFallback<NoticeDataMap>(
        'notice_data',
        getLocalNoticeMap,
        saveLocalNoticeMap,
        isEmptyNoticeMap
      ),
      new Promise<NoticeDataMap>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), SYNC_TIMEOUT_MS)
      ),
    ]);
    return merged[date] || null;
  } catch {
    return getNotice(date);
  }
}

/** 동기 로드: localStorage만 (기존 호환) */
export const getNotice = (date: string): Notice | null => {
  initializeNotice();
  const key = `${LS_KEY_PREFIX}${date}`;
  const stored = localStorage.getItem(key);
  return stored ? (JSON.parse(stored) as Notice) : null;
};

/** 알림장 저장 (로컬 즉시 저장 + Supabase 동기화 시도, Supabase 실패해도 로컬 저장 성공으로 처리) */
export async function saveNoticeAsync(date: string, content: string): Promise<Notice> {
  const notice: Notice = {
    date,
    content,
    updatedAt: new Date().toISOString(),
  };
  const key = `${LS_KEY_PREFIX}${date}`;
  localStorage.setItem(key, JSON.stringify(notice));

  try {
    const merged = await Promise.race([
      loadWithSupabaseFallback<NoticeDataMap>(
        'notice_data',
        getLocalNoticeMap,
        saveLocalNoticeMap,
        isEmptyNoticeMap
      ),
      new Promise<NoticeDataMap>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), SYNC_TIMEOUT_MS)
      ),
    ]);
    merged[date] = notice;
    saveLocalNoticeMap(merged);
    await Promise.race([
      saveClassColumn('notice_data', merged),
      new Promise<boolean>((r) => setTimeout(() => r(false), 6000)),
    ]);
  } catch {
    // 로컬은 이미 저장됨. Supabase 동기화 실패해도 저장 성공으로 반환
  }
  return notice;
}

/** 동기 저장: localStorage만 (기존 호환) */
export const saveNotice = (date: string, content: string): Notice => {
  const notice: Notice = {
    date,
    content,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(`${LS_KEY_PREFIX}${date}`, JSON.stringify(notice));
  return notice;
};

/** 알림장 삭제 (로컬 즉시 반영 + Supabase 동기화 시도) */
export async function deleteNoticeAsync(date: string): Promise<void> {
  localStorage.removeItem(`${LS_KEY_PREFIX}${date}`);

  try {
    const merged = await Promise.race([
      loadWithSupabaseFallback<NoticeDataMap>(
        'notice_data',
        getLocalNoticeMap,
        saveLocalNoticeMap,
        isEmptyNoticeMap
      ),
      new Promise<NoticeDataMap>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), SYNC_TIMEOUT_MS)
      ),
    ]);
    delete merged[date];
    saveLocalNoticeMap(merged);
    await Promise.race([
      saveClassColumn('notice_data', merged),
      new Promise<boolean>((r) => setTimeout(() => r(false), 6000)),
    ]);
  } catch {
    // 로컬 삭제는 이미 적용됨
  }
}

/** 동기 삭제: localStorage만 (기존 호환) */
export const deleteNotice = (date: string) => {
  localStorage.removeItem(`${LS_KEY_PREFIX}${date}`);
};
