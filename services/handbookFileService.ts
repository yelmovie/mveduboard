/**
 * 교무수첩 파일 업로드/조회 서비스
 * 학사일정, 연간시간표, 시수표, 진도표 - Supabase 연동
 */
import { generateUUID } from '../src/utils/uuid';
import { supabase } from '../src/lib/supabase/client';
import { getCurrentUserProfile } from '../src/lib/supabase/auth';
import { createSignedUrl } from '../src/lib/supabase/storage';
import { blobToBase64 } from './studyService';

const STUDY_BUCKET = 'board-images';
const LS_KEY = 'edu_handbook_files';
let suppressHandbookFilesError = false;

export type HandbookFileType = 'academic_schedule_1' | 'academic_schedule_2' | 'annual_timetable' | 'class_hour_1' | 'class_hour_2' | 'progress_chart';

export interface HandbookFileItem {
  id: string;
  fileUrl: string;
  fileType: 'pdf' | 'image';
  fileStorage: 'local' | 'supabase';
  filePath?: string;
  updatedAt: string;
}

export type HandbookFilesData = Partial<Record<HandbookFileType, HandbookFileItem>>;

const getKey = (classId?: string | null) => (classId ? `${LS_KEY}_${classId}` : LS_KEY);

const getLocal = (classId?: string | null): HandbookFilesData => {
  const stored = localStorage.getItem(getKey(classId));
  if (stored) return JSON.parse(stored) as HandbookFilesData;
  const legacy = localStorage.getItem(LS_KEY);
  if (legacy) return JSON.parse(legacy) as HandbookFilesData;
  return {};
};

const saveLocal = (data: HandbookFilesData, classId?: string | null) => {
  const key = getKey(classId);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (classId) localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    console.warn('[handbookFileService] localStorage quota exceeded');
  }
};

const ensureSigned = async (item: HandbookFileItem | undefined): Promise<HandbookFileItem | undefined> => {
  if (!item || !supabase || item.fileStorage !== 'supabase' || !item.filePath) return item;
  const url = await createSignedUrl(item.filePath, 60 * 60 * 24 * 7);
  if (!url) return item;
  return { ...item, fileUrl: url };
};

const ensureAllSigned = async (data: HandbookFilesData): Promise<HandbookFilesData> => {
  const entries = Object.entries(data);
  const resolved = await Promise.all(
    entries.map(async ([k, v]) => [k, await ensureSigned(v)] as const)
  );
  return Object.fromEntries(resolved.filter(([, v]) => v));
}

export const getHandbookFilesAsync = async (): Promise<HandbookFilesData> => {
  let profile = await getCurrentUserProfile();
  if (!profile?.class_id && supabase) {
    await new Promise(r => setTimeout(r, 500));
    profile = await getCurrentUserProfile();
  }
  const classId = profile?.class_id ?? null;
  const local = getLocal(classId);
  if (!supabase || !classId || suppressHandbookFilesError) {
    return ensureAllSigned(local);
  }
  const { data, error } = await supabase
    .from('classes')
    .select('handbook_files')
    .eq('id', classId)
    .maybeSingle();
  if (error) {
    if (error.message?.includes('handbook_files')) suppressHandbookFilesError = true;
    return ensureAllSigned(local);
  }
  if (data?.handbook_files && typeof data.handbook_files === 'object') {
    const remote = data.handbook_files as HandbookFilesData;
    saveLocal(remote, classId);
    return ensureAllSigned(remote);
  }
  return ensureAllSigned(local);
};

const saveToDb = async (data: HandbookFilesData) => {
  const profile = await getCurrentUserProfile();
  const classId = profile?.class_id ?? null;
  saveLocal(data, classId);
  if (!supabase || !classId || profile?.role !== 'teacher' || suppressHandbookFilesError) return;
  const { error } = await supabase
    .from('classes')
    .update({ handbook_files: data })
    .eq('id', classId);
  if (error) {
    if (error.message?.includes('handbook_files')) suppressHandbookFilesError = true;
    console.warn('[handbookFileService] saveToDb error', error.message);
  }
};

const compressImage = async (base64Str: string, maxWidth = 1024, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxWidth) { h *= maxWidth / w; w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const uploadHandbookFile = async (
  type: HandbookFileType,
  file: File
): Promise<HandbookFileItem> => {
  const isPdf = file.type === 'application/pdf';
  const baseItem: HandbookFileItem = {
    id: generateUUID(),
    fileUrl: '',
    fileType: isPdf ? 'pdf' : 'image',
    fileStorage: 'local',
    updatedAt: new Date().toISOString(),
  };
  const profile = await getCurrentUserProfile();
  const canUpload = !!supabase && !!profile?.class_id && !!profile?.school_id && profile.role === 'teacher';
  const current = await getHandbookFilesAsync();

  if (canUpload) {
    const ext = isPdf ? 'pdf' : (file.name.match(/\.(png|jpe?g|gif|webp)$/i)?.[1] || 'png');
    const filename = `handbook-${type}-${Date.now()}.${ext}`;
    const path = `school/${profile.school_id}/class/${profile.class_id}/handbook/${filename}`;
    const { error } = await supabase.storage.from(STUDY_BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (!error) {
      const item: HandbookFileItem = { ...baseItem, fileStorage: 'supabase', filePath: path };
      const next: HandbookFilesData = { ...current, [type]: item };
      await saveToDb(next);
      const signed = await ensureSigned(item);
      return signed ?? item;
    }
  }

  let base64 = await blobToBase64(file);
  if (file.type.startsWith('image/')) base64 = await compressImage(base64, 1200, 0.7);
  const item: HandbookFileItem = { ...baseItem, fileUrl: base64, fileStorage: 'local' };
  const next: HandbookFilesData = { ...current, [type]: item };
  await saveToDb(next);
  return item;
};

export const deleteHandbookFile = async (type: HandbookFileType): Promise<void> => {
  const current = await getHandbookFilesAsync();
  const item = current[type];
  if (supabase && item?.fileStorage === 'supabase' && item.filePath) {
    await supabase.storage.from(STUDY_BUCKET).remove([item.filePath]);
  }
  const { [type]: _, ...rest } = current;
  await saveToDb(rest);
};
