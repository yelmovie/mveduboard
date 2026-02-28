import { Notice } from '../types';

const LS_KEY_PREFIX = 'edu_notice_';
const INIT_KEY = 'edu_notice_initialized';

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

export const getNotice = (date: string): Notice | null => {
  initializeNotice();
  const key = `${LS_KEY_PREFIX}${date}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

export const saveNotice = (date: string, content: string): Notice => {
  const key = `${LS_KEY_PREFIX}${date}`;
  const notice: Notice = {
    date,
    content,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(notice));
  return notice;
};

export const deleteNotice = (date: string) => {
  const key = `${LS_KEY_PREFIX}${date}`;
  localStorage.removeItem(key);
};