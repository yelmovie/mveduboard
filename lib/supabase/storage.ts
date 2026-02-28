import { supabase } from './client';
import { isSupabaseConfigured } from '../../config/supabase';
import { DAILY_IMAGE_LIMIT } from '../../constants/limits';
import { logBetaEvent } from './events';

const BUCKET = 'board-images';

const ensureSessionUserId = async () => {
  const sessionResult = await supabase.auth.getSession();
  if (sessionResult.data.session?.user?.id) {
    return sessionResult.data.session.user.id;
  }

  const anonResult = await supabase.auth.signInAnonymously();
  const anonUserId = anonResult.data.user?.id;
  if (!anonUserId) {
    throw new Error('세션을 확인할 수 없습니다.');
  }
  return anonUserId;
};

const getTodayKey = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const checkAndIncrementQuota = async (userId: string) => {
  const today = getTodayKey();
  const { data, error } = await supabase
    .from('upload_quota_daily')
    .select('count')
    .eq('user_id', userId)
    .eq('day', today)
    .maybeSingle();

  if (error) {
    throw new Error('업로드 제한 확인에 실패했습니다.');
  }

  const currentCount = data?.count ?? 0;
  if (currentCount >= DAILY_IMAGE_LIMIT) {
    await logBetaEvent('upload_blocked_daily_limit', { day: today });
    const limitError = new Error('DAILY_LIMIT_REACHED');
    // @ts-expect-error custom code
    limitError.code = 'DAILY_LIMIT_REACHED';
    throw limitError;
  }

  const nextCount = currentCount + 1;
  const { error: upsertError } = await supabase
    .from('upload_quota_daily')
    .upsert({ user_id: userId, day: today, count: nextCount }, { onConflict: 'user_id,day' });

  if (upsertError) {
    throw new Error('업로드 제한 기록에 실패했습니다.');
  }
};

export const buildStoragePath = (filename: string, postId: string, classId?: string, schoolId?: string) => {
  const safeName = filename.replace(/\s+/g, '-');
  const schoolPart = schoolId ? `school/${schoolId}` : 'school/unknown';
  const classPart = classId ? `class/${classId}` : 'class/unknown';
  return `${schoolPart}/${classPart}/posts/${postId}/images/${Date.now()}-${safeName}`;
};

export const uploadImageWithQuota = async (file: Blob, path: string, contentType: string) => {
  if (!isSupabaseConfigured) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }

  const userId = await ensureSessionUserId();
  await checkAndIncrementQuota(userId);

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });

  if (error) {
    throw new Error('이미지 업로드에 실패했습니다.');
  }

  await logBetaEvent('upload_success', { path });
  return { path };
};

export const createSignedImageUrl = async (path: string, expiresSeconds = 60) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresSeconds);
  if (error || !data?.signedUrl) {
    throw new Error('이미지 URL 생성에 실패했습니다.');
  }
  return data.signedUrl;
};
