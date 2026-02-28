import { DAILY_IMAGE_LIMIT } from '../../constants/limits';

const LS_KEY = 'edu_upload_quota_daily_local';

const getTodayKey = () => new Date().toISOString().slice(0, 10);

export const checkAndIncrementLocalQuota = () => {
  const today = getTodayKey();
  const raw = localStorage.getItem(LS_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  const currentCount = parsed[today] || 0;
  if (currentCount >= DAILY_IMAGE_LIMIT) {
    return { allowed: false, currentCount };
  }
  parsed[today] = currentCount + 1;
  localStorage.setItem(LS_KEY, JSON.stringify(parsed));
  return { allowed: true, nextCount: currentCount + 1 };
};
